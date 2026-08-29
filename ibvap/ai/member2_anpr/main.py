"""
IBVAP - Member 2 ANPR Module - main.py

Command-line entry point, SIH demo runner, RTSP stream processor, benchmark, and validation suite.

Usage:
    # Run full SIH 2026 interactive multi-scenario demonstration
    python -m ai.member2_anpr.main --demo

    # Run mock simulation demo
    python -m ai.member2_anpr.main --mock

    # Run on a local image
    python -m ai.member2_anpr.main --image path/to/vehicle.jpg --camera-id CAM-01

    # Run on an RTSP stream / video file with frame skipping
    python -m ai.member2_anpr.main --source rtsp://192.168.1.100:554/stream --frame-skip 4 --max-frames 100

    # Run validation on a directory of images
    python -m ai.member2_anpr.main --validate --validation-dir path/to/test_images/ --mock

    # Run performance benchmark
    python -m ai.member2_anpr.main --benchmark --num-frames 30 --mock
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time

import cv2
import numpy as np

from .adapter import ANPREventClient
from .benchmark import ANPRBenchmark
from .config import default_config
from .detector import MockPlateDetector, YOLOPlateDetector
from .event_generator import ANPREventGenerator
from .ocr import EasyOCREngine, MockOCREngine
from .pipeline import ANPRPipeline
from .recognizer import PlateRecognizer
from .stream import RTSPStreamReader, mask_rtsp_url
from .stream_processor import ANPRStreamProcessor
from .suppressor import DuplicateSuppressor
from .validator import ANPRValidator
from .watchlist import InMemoryWatchlistMatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s -- %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def build_pipeline(use_mock: bool, model_path: str | None = None) -> ANPRPipeline:
    """Instantiate pipeline with real or mock components."""
    if use_mock:
        logger.info("Using Mock ANPR components")
        detector = MockPlateDetector()
        ocr = MockOCREngine()
    else:
        actual_model_path = model_path or default_config.detector_model_path
        if not os.path.exists(actual_model_path):
            raise FileNotFoundError(
                f"Cannot initialize real YOLO detector: weights not found at '{actual_model_path}'.\n"
                f"Please place your YOLO license plate model (.pt) at this path or specify --mock to run in simulation mode."
            )

        logger.info("Initializing real YOLOPlateDetector and EasyOCREngine...")
        detector = YOLOPlateDetector(model_path=actual_model_path)
        ocr = EasyOCREngine(languages=default_config.ocr_languages, gpu=default_config.ocr_gpu)

    return ANPRPipeline(
        detector=detector,
        ocr_engine=ocr,
        recognizer=PlateRecognizer(strict=default_config.strict_plate_validation),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
    )


def run_sih_demo() -> None:
    """
    Execute the official SIH 2026 interactive multi-scenario ANPR demonstration.
    Demonstrates:
      1. Standard Indian Registration & Vehicle ID Tracking
      2. High-Priority Watchlist Alert (Stolen Vehicle)
      3. Live Stream Duplicate Event Suppression
      4. Multi-Checkpoint Camera Independence
      5. Backend Integration JSON Contract
    """
    print("=" * 70)
    print("  IBVAP -- Intelligent Border Video Analytics Platform (SIH 2026)")
    print("  Member 2 -- ANPR (Automatic Number Plate Recognition) SIH Demo")
    print("=" * 70)

    # 1. Standard Indian Registration
    print("\n[SCENARIO 1] Standard Indian License Plate Detection:")
    print("  Input: Border Checkpoint Camera 'CAM-BORDER-01', Vehicle 'VEH-BORDER-101'")
    pipe1 = ANPRPipeline(
        detector=MockPlateDetector(),
        ocr_engine=MockOCREngine(mock_text="DL01AB1234", mock_confidence=0.95),
        watchlist=InMemoryWatchlistMatcher(custom_watchlist={}),
    )
    frame1 = np.full((480, 640, 3), fill_value=128, dtype=np.uint8)
    res1 = pipe1.process_frame(frame1, camera_id="CAM-BORDER-01", vehicle_id="VEH-BORDER-101")
    event1 = res1[0].event
    print(f"  -> Detected Plate     : {res1[0].plate_number}")
    print(f"  -> State Code & Format : {event1.metadata.get('validation_reason')}")
    print(f"  -> Event Emitted      : {event1.event_type.value}")
    print(f"  -> Overall Confidence : {event1.confidence:.2f}")

    # 2. Watchlist Alert
    print("\n[SCENARIO 2] Watchlist Hit (Stolen / Wanted Vehicle Alert):")
    print("  Input: Checkpoint 'CAM-BORDER-01', Plate 'MH12DE1433'")
    stolen_wl = {"MH12DE1433": {"status": "STOLEN", "reason": "Reported stolen in Pune - FIR #8821"}}
    pipe2 = ANPRPipeline(
        detector=MockPlateDetector(),
        ocr_engine=MockOCREngine(mock_text="MH12DE1433", mock_confidence=0.96),
        watchlist=InMemoryWatchlistMatcher(custom_watchlist=stolen_wl),
    )
    res2 = pipe2.process_frame(frame1, camera_id="CAM-BORDER-01", vehicle_id="VEH-SUSPECT-404")
    event2 = res2[0].event
    print(f"  -> !!! ALERT TRIGGERED : {event2.event_type.value} !!!")
    print(f"  -> Plate Number        : {res2[0].plate_number}")
    print(f"  -> Watchlist Status    : {event2.metadata.get('watchlist_status')}")
    print(f"  -> Reason              : {event2.metadata.get('watchlist_reason')}")

    # 3. Duplicate Suppression
    print("\n[SCENARIO 3] Real-Time Video Stream Duplicate Suppression (10s Window):")
    suppressor = DuplicateSuppressor(window_seconds=10.0)
    pipe3 = ANPRPipeline(
        detector=MockPlateDetector(),
        ocr_engine=MockOCREngine(mock_text="TN09AB1234"),
        duplicate_suppressor=suppressor,
    )
    t0 = time.time()
    r_f1 = pipe3.process_frame(frame1, camera_id="CAM-BORDER-01", timestamp="2026-08-28T15:30:00+00:00")
    print(f"  Frame 1 (t=0.0s) : Plate={r_f1[0].plate_number} -> Emitted (duplicate_suppressed={r_f1[0].duplicate_suppressed})")

    r_f2 = pipe3.process_frame(frame1, camera_id="CAM-BORDER-01", timestamp="2026-08-28T15:30:01+00:00")
    print(f"  Frame 2 (t=1.0s) : Plate={r_f2[0].plate_number} -> SUPPRESSED (duplicate_suppressed={r_f2[0].duplicate_suppressed})")

    # 4. Multi-Checkpoint Camera Independence
    print("\n[SCENARIO 4] Multi-Camera Checkpoint Independence:")
    r_cam2 = pipe3.process_frame(frame1, camera_id="CAM-BORDER-02", timestamp="2026-08-28T15:30:02+00:00")
    print(f"  CAM-BORDER-02 (t=2.0s) : Same Plate seen at Gate 2 -> Emitted (duplicate_suppressed={r_cam2[0].duplicate_suppressed})")

    # 5. Backend Event JSON Contract
    print("\n[SCENARIO 5] Standardized IBVAPEvent Contract for Member 3 Backend:")
    print(event1.model_dump_json(indent=2))

    print("\n" + "=" * 70)
    print("  SIH 2026 ANPR Demonstration Completed Successfully!")
    print("=" * 70 + "\n")


def run_benchmark_cli(pipeline: ANPRPipeline, num_frames: int, use_mock: bool) -> None:
    """Execute benchmark and print results."""
    mode = "mock" if use_mock else "real"
    benchmark = ANPRBenchmark(mode=mode)
    logger.info("Running benchmark (%d frames, mode=%s)...", num_frames, mode)
    report = benchmark.run_benchmark(pipeline=pipeline, num_frames=num_frames)
    print("\n" + report.summary_table() + "\n")


def run_validation_cli(
    pipeline: ANPRPipeline,
    val_dir: str | None,
    image_path: str | None,
    ground_truth: str | None,
) -> None:
    """Execute validation runner and print accuracy/latency breakdown."""
    validator = ANPRValidator(pipeline=pipeline)

    if val_dir:
        logger.info("Validating image directory: %s", val_dir)
        gt_map = None
        if ground_truth and os.path.exists(ground_truth):
            with open(ground_truth, "r", encoding="utf-8") as f:
                gt_map = json.load(f)
        report = validator.validate_directory(dir_path=val_dir, ground_truth_map=gt_map)
        print("\n" + report.summary_table() + "\n")
    elif image_path:
        logger.info("Validating single image: %s", image_path)
        res = validator.validate_image(image_input=image_path, ground_truth=ground_truth)
        print("=" * 60)
        print(f"Validation Result for: {res.source_name}")
        print(f"  Detected Plate     : {res.plate_number}")
        print(f"  Confidence (Plate) : {res.plate_confidence}")
        print(f"  Confidence (OCR)   : {res.ocr_confidence}")
        print(f"  Format Validated   : {res.validation_passed} ({res.validation_reason})")
        if res.ground_truth:
            print(f"  Ground Truth       : {res.ground_truth} -> Match: {res.is_correct}")
        print(f"  Total Latency      : {res.total_ms:.2f} ms")
        print("=" * 60)
    else:
        logger.info("Running validation demo on synthetic frame...")
        dummy = np.full((480, 640, 3), fill_value=128, dtype=np.uint8)
        res = validator.validate_image(image_input=dummy, ground_truth="TN09AB1234")
        print("=" * 60)
        print(f"Demo Validation Result:")
        print(f"  Detected Plate     : {res.plate_number}")
        print(f"  Ground Truth Match : {res.is_correct}")
        print(f"  Latency            : {res.total_ms:.2f} ms")
        print("=" * 60)


def run_stream_cli(
    source: str,
    camera_id: str,
    pipeline: ANPRPipeline,
    frame_skip: int,
    max_frames: int | None,
    vehicle_id: str | None,
    event_client: ANPREventClient | None = None,
) -> None:
    """Execute real-time RTSP/video stream processing loop."""
    logger.info("Opening stream source: %s (camera_id=%s)", mask_rtsp_url(source), camera_id)
    stream_reader = RTSPStreamReader(source=source, camera_id=camera_id)
    processor = ANPRStreamProcessor(
        stream_reader=stream_reader,
        pipeline=pipeline,
        frame_skip=frame_skip,
        camera_id=camera_id,
    )

    logger.info("Processing stream (frame_skip=%d, max_frames=%s)...", frame_skip, max_frames)
    for frame_idx, results, events in processor.process_stream(max_frames=max_frames, vehicle_id=vehicle_id):
        if events:
            for event in events:
                logger.info(
                    "[EVENT] %s on %s: Plate=%s Conf=%.2f",
                    event.event_type.value,
                    event.camera_id,
                    event.metadata.get("plate_number"),
                    event.confidence,
                )
                if event_client and event_client.enabled:
                    res = event_client.send(event)
                    if res.success:
                        logger.info("  -> Forwarded to backend successfully (HTTP %s)", res.status_code)
                    else:
                        logger.warning("  -> Backend forward note: %s", res.message)

    print("\n" + processor.stats.summary_table() + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="IBVAP Member 2 ANPR Module Runner")
    parser.add_argument("--demo", action="store_true", help="Run full SIH 2026 multi-scenario interactive demonstration")
    parser.add_argument("--source", type=str, default=None, help="RTSP URL, video file path, or webcam index")
    parser.add_argument("--camera", type=str, default=None, help="RTSP URL or Camera ID (backward compatibility)")
    parser.add_argument("--camera-id", type=str, default="CAM-01", help="Camera ID identifier (default: CAM-01)")
    parser.add_argument("--image", type=str, default=None, help="Path to input image file")
    parser.add_argument("--vehicle-id", type=str, default=None, help="Associated vehicle tracking ID")
    parser.add_argument("--mock", action="store_true", help="Force mock components")
    parser.add_argument("--model-path", type=str, default=None, help="Path to YOLO license plate model (.pt)")
    parser.add_argument("--frame-skip", type=int, default=0, help="Frames to skip between ANPR evaluations (default: 0)")
    parser.add_argument("--max-frames", type=int, default=None, help="Maximum frames to process in stream")
    parser.add_argument("--benchmark", action="store_true", help="Run performance benchmark")
    parser.add_argument("--num-frames", type=int, default=30, help="Number of benchmark iterations (default: 30)")
    parser.add_argument("--validate", action="store_true", help="Run real-model validation runner")
    parser.add_argument("--validation-dir", type=str, default=None, help="Directory of test images for validation")
    parser.add_argument("--ground-truth", type=str, default=None, help="Expected plate ground truth or path to JSON map")
    parser.add_argument("--backend-url", type=str, default="http://127.0.0.1:8000", help="IBVAP Backend API base URL")
    parser.add_argument("--no-backend", action="store_true", help="Disable forwarding events to backend")

    args = parser.parse_args()

    # 1. SIH Demo Mode
    if args.demo:
        run_sih_demo()
        return

    # Determine stream source vs camera ID
    stream_source = args.source
    camera_id = args.camera_id

    if args.camera:
        if args.camera.startswith("rtsp://") or args.camera.startswith("http://") or os.path.exists(args.camera):
            stream_source = args.camera
        else:
            camera_id = args.camera

    # Determine mock status
    if not args.image and not stream_source and not args.model_path and not args.benchmark and not args.validate:
        args.mock = True

    try:
        pipeline = build_pipeline(use_mock=args.mock, model_path=args.model_path)
    except Exception as err:
        logger.error("Pipeline initialization failed: %s", err)
        sys.exit(1)

    event_client = ANPREventClient(
        backend_url=args.backend_url,
        camera_id=camera_id,
        enabled=not args.no_backend,
    )

    # 2. Validation Mode
    if args.validate:
        run_validation_cli(
            pipeline=pipeline,
            val_dir=args.validation_dir,
            image_path=args.image,
            ground_truth=args.ground_truth,
        )
        return

    # 3. Benchmark Mode
    if args.benchmark:
        run_benchmark_cli(pipeline=pipeline, num_frames=args.num_frames, use_mock=args.mock)
        return

    # 4. RTSP / Stream Mode
    if stream_source:
        run_stream_cli(
            source=stream_source,
            camera_id=camera_id,
            pipeline=pipeline,
            frame_skip=args.frame_skip,
            max_frames=args.max_frames,
            vehicle_id=args.vehicle_id,
            event_client=event_client,
        )
        return

    # 5. Static Image / Single Frame Mode
    if args.image:
        if not os.path.exists(args.image):
            logger.error("Image file not found: %s", args.image)
            sys.exit(1)
        frame = cv2.imread(args.image)
        if frame is None:
            logger.error("Failed to decode image: %s", args.image)
            sys.exit(1)
        logger.info("Loaded image '%s' (shape: %s)", args.image, frame.shape)
    else:
        logger.info("No --image or --source specified; generating synthetic frame for demo.")
        frame = np.full((480, 640, 3), fill_value=128, dtype=np.uint8)

    logger.info("Processing single frame...")
    results = pipeline.process_frame(
        frame=frame,
        camera_id=camera_id,
        vehicle_id=args.vehicle_id,
    )

    logger.info("Pipeline returned %d result(s)", len(results))
    for i, res in enumerate(results, 1):
        print("=" * 60)
        print(f"Result {i}:")
        if res.error:
            print(f"  [ERROR] {res.error}")
        else:
            print(f"  Plate Number    : {res.plate_number}")
            print(f"  Plate Conf      : {res.plate_confidence}")
            print(f"  OCR Conf        : {res.ocr_confidence}")
            print(f"  Vehicle ID      : {res.vehicle_id}")
            print(f"  Watchlist Match : {res.watchlist_match}")
            if res.watchlist_status:
                print(f"  Watchlist Status: {res.watchlist_status}")
            if res.event:
                print(f"  Event Type      : {res.event.event_type.value}")
                print(f"  Event JSON      : {res.event.model_dump_json(indent=2)}")
                if event_client and event_client.enabled and not res.duplicate_suppressed:
                    send_res = event_client.send(res.event)
                    print(f"  Backend Sent    : {send_res.success} ({send_res.message})")


if __name__ == "__main__":
    main()
