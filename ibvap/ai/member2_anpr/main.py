"""
IBVAP - Member 2 ANPR Module - main.py

Command-line entry point, demo runner, RTSP stream processor, and benchmark for the ANPR module.

Usage:
    # Run mock simulation demo
    python -m ai.member2_anpr.main --mock

    # Run on a local image
    python -m ai.member2_anpr.main --image path/to/vehicle.jpg --camera-id CAM-01

    # Run on an RTSP stream / video file with frame skipping
    python -m ai.member2_anpr.main --source rtsp://192.168.1.100:554/stream --frame-skip 4 --max-frames 100

    # Run performance benchmark
    python -m ai.member2_anpr.main --benchmark --num-frames 30 --mock
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import cv2
import numpy as np

from .benchmark import ANPRBenchmark
from .config import default_config
from .detector import MockPlateDetector, YOLOPlateDetector
from .event_generator import ANPREventGenerator
from .ocr import EasyOCREngine, MockOCREngine
from .pipeline import ANPRPipeline
from .recognizer import PlateRecognizer
from .stream import RTSPStreamReader, mask_rtsp_url
from .stream_processor import ANPRStreamProcessor
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
        recognizer=PlateRecognizer(),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
    )


def run_benchmark_cli(pipeline: ANPRPipeline, num_frames: int, use_mock: bool) -> None:
    """Execute benchmark and print results."""
    mode = "mock" if use_mock else "real"
    benchmark = ANPRBenchmark(mode=mode)
    logger.info("Running benchmark (%d frames, mode=%s)...", num_frames, mode)
    report = benchmark.run_benchmark(pipeline=pipeline, num_frames=num_frames)
    print("\n" + report.summary_table() + "\n")


def run_stream_cli(
    source: str,
    camera_id: str,
    pipeline: ANPRPipeline,
    frame_skip: int,
    max_frames: int | None,
    vehicle_id: str | None,
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

    print("\n" + processor.stats.summary_table() + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="IBVAP Member 2 ANPR Module Runner")
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

    args = parser.parse_args()

    # Determine stream source vs camera ID
    stream_source = args.source
    camera_id = args.camera_id

    if args.camera:
        if args.camera.startswith("rtsp://") or args.camera.startswith("http://") or os.path.exists(args.camera):
            stream_source = args.camera
        else:
            camera_id = args.camera

    # Determine mock status
    if not args.image and not stream_source and not args.model_path and not args.benchmark:
        args.mock = True

    try:
        pipeline = build_pipeline(use_mock=args.mock, model_path=args.model_path)
    except Exception as err:
        logger.error("Pipeline initialization failed: %s", err)
        sys.exit(1)

    # 1. Benchmark Mode
    if args.benchmark:
        run_benchmark_cli(pipeline=pipeline, num_frames=args.num_frames, use_mock=args.mock)
        return

    # 2. RTSP / Stream Mode
    if stream_source:
        run_stream_cli(
            source=stream_source,
            camera_id=camera_id,
            pipeline=pipeline,
            frame_skip=args.frame_skip,
            max_frames=args.max_frames,
            vehicle_id=args.vehicle_id,
        )
        return

    # 3. Static Image / Single Frame Mode
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


if __name__ == "__main__":
    main()
