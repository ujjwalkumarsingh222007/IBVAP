"""
main.py — IBVAP Phase 1A + 1B + 1C + 1D + 2B entry point.

Responsibility
--------------
* Parse CLI arguments (source, confidence, model, device, tracker, no-track,
  no-fence, fence, camera-id, backend-url, no-backend, no-object-events).
* Open the video source (webcam or file) via OpenCV.
* Drive the frame loop.
* Phase 1A mode  (--no-track):        Detector.detect() — bounding boxes only
* Phase 1B mode  (--no-fence):        ObjectTracker.track() — + persistent IDs
* Phase 1C mode  (default):           IntrusionDetector.process() — + intrusion
* Phase 1D mode  (default):           EventClient.send() — POST to backend
* Phase 2B mode  (default):           EventAnalyzer.process() — + person/vehicle/object events
* Call drawing helpers for detections, fence overlay, intrusion banner.
* Display the annotated frame in a window.
* Print per-frame summaries and analytics events to stdout.
* Exit cleanly on 'q' key press or when the source is exhausted.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from typing import List, Optional, Union

import cv2

from detection import Detector, DetectionResult
from tracking import ObjectTracker
from intrusion import VirtualFence, IntrusionDetector, IntrusionEvent
from intrusion.fence import DEFAULT_FENCE_POLYGON
from adapter import EventClient
from adapter.event_client import DEFAULT_BACKEND_URL, DEFAULT_CAMERA_ID
from events import EventAnalyzer, AnalyticsEvent

# ---------------------------------------------------------------------------
# Logging setup — INFO to stdout, WARNING+ always visible
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

# ---------------------------------------------------------------------------
# Default configuration — override via CLI flags
# ---------------------------------------------------------------------------

DEFAULT_MODEL:      str   = "yolov8n.pt"
DEFAULT_CONFIDENCE: float = 0.40
DEFAULT_SOURCE:     str   = "0"
DEFAULT_TRACKER:    str   = "bytetrack.yaml"
PRINT_DETECTIONS:   bool  = True   # set False to reduce console noise


# ---------------------------------------------------------------------------
# Helper: open video source
# ---------------------------------------------------------------------------

def open_source(source: str) -> cv2.VideoCapture:
    """
    Open a webcam index or a file path.

    Returns a guaranteed-open VideoCapture; calls sys.exit(1) on failure.
    """
    cam_index: Optional[int] = None
    try:
        cam_index = int(source)
    except ValueError:
        pass

    cap = cv2.VideoCapture(cam_index if cam_index is not None else source)

    if not cap.isOpened():
        kind = (
            f"webcam index {cam_index}"
            if cam_index is not None
            else f"file '{source}'"
        )
        print(
            f"[ERROR] Could not open {kind}.  "
            "Check the path or that the webcam is connected.",
            file=sys.stderr,
        )
        sys.exit(1)

    return cap


# ---------------------------------------------------------------------------
# Helper: HUD stats overlay
# ---------------------------------------------------------------------------

def _draw_stats(
    frame,
    fps: float,
    n_persons: int,
    n_vehicles: int,
    tracking_enabled: bool,
    fence_enabled: bool,
    object_events_enabled: bool,
    backend_enabled: bool,
    n_intrusions_total: int,
    n_ai_events_total: int,
) -> None:
    """Draw informational stats in the top-left corner of the frame."""
    if fence_enabled:
        y_start = 62
    else:
        y_start = 22

    if fence_enabled and backend_enabled:
        mode_label = "TRACKING+FENCE+AI_EVENTS+BACKEND" if object_events_enabled else "TRACKING+FENCE+BACKEND"
    elif fence_enabled:
        mode_label = "TRACKING+FENCE+AI_EVENTS" if object_events_enabled else "TRACKING+FENCE"
    elif tracking_enabled:
        mode_label = "TRACKING+AI_EVENTS" if object_events_enabled else "TRACKING"
    else:
        mode_label = "DETECT ONLY"

    lines = [
        f"FPS:       {fps:5.1f}",
        f"Persons:   {n_persons}",
        f"Vehicles:  {n_vehicles}",
        f"Mode:      {mode_label}",
        f"Intrusions:{n_intrusions_total:4d} (session)",
        f"AI Events: {n_ai_events_total:4d} (session)",
        "Press 'q' to quit",
    ]
    y = y_start
    for line in lines:
        cv2.putText(
            frame, line, (8, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45,
            (0, 255, 255), 1, cv2.LINE_AA,
        )
        y += 20


# ---------------------------------------------------------------------------
# Main video loop
# ---------------------------------------------------------------------------

def run(
    source: str,
    model_path: str,
    confidence: float,
    device: str,
    tracker_config: str,
    tracking_enabled: bool,
    fence_polygon: list,
    fence_enabled: bool,
    object_events_enabled: bool,
    backend_enabled: bool,
    backend_url: str,
    camera_id: str,
) -> None:
    """Initialise detector/tracker/fence/client/engine, open video source, run frame loop."""

    # --- Guard: fence and object events require tracking ---------------------
    if fence_enabled and not tracking_enabled:
        print(
            "[WARN] Virtual-fence intrusion detection requires tracking. "
            "Fence disabled because --no-track was used.",
            file=sys.stderr,
        )
        fence_enabled = False

    if object_events_enabled and not tracking_enabled:
        print(
            "[WARN] Object detection events require tracking for deduplication. "
            "Object events disabled because --no-track was used.",
            file=sys.stderr,
        )
        object_events_enabled = False

    # --- Guard: backend requires at least one active event source ------------
    if backend_enabled and not fence_enabled and not object_events_enabled:
        print(
            "[INFO] Backend integration disabled: no active event generators "
            "(fence and object events are both off).",
            file=sys.stderr,
        )
        backend_enabled = False

    # --- Initialise detector or tracker --------------------------------------
    if tracking_enabled:
        phase = "2B — Tracking + AI Event Engine"
        print(f"[INFO] Phase {phase}  (tracker: {tracker_config})")
        print(f"[INFO] Loading model '{model_path}' with ObjectTracker …")
        try:
            processor: Union[ObjectTracker, Detector] = ObjectTracker(
                model_path=model_path,
                confidence_threshold=confidence,
                tracker_config=tracker_config,
                device=device,
            )
        except RuntimeError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            sys.exit(1)
        window_title = "IBVAP — Phase 2B: Full AI Event Pipeline"
    else:
        print("[INFO] Phase 1A — detection only  (tracking disabled via --no-track)")
        print(f"[INFO] Loading model '{model_path}' …")
        try:
            processor = Detector(
                model_path=model_path,
                confidence_threshold=confidence,
                device=device,
            )
        except RuntimeError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            sys.exit(1)
        window_title = "IBVAP — Phase 1A: Detection"

    print(f"[INFO] {processor}")

    # --- Initialise fence and intrusion detector (Phase 1C) ------------------
    fence: Optional[VirtualFence] = None
    intr:  Optional[IntrusionDetector] = None

    if fence_enabled:
        fence = VirtualFence(fence_polygon)
        intr  = IntrusionDetector(fence)
        print(f"[INFO] Virtual fence: {fence}")

    # --- Initialise AI Event Engine (Phase 2B) -------------------------------
    event_analyzer: Optional[EventAnalyzer] = None
    if object_events_enabled and tracking_enabled:
        event_analyzer = EventAnalyzer()
        print(f"[INFO] AI Event Engine initialized: {event_analyzer}")

    # --- Initialise backend event client (Phase 1D) --------------------------
    client: Optional[EventClient] = None

    if backend_enabled:
        client = EventClient(
            backend_url=backend_url,
            camera_id=camera_id,
        )
        print(f"[INFO] Backend client: {client}")
        print(f"[INFO] Events will be POSTed to: {backend_url}/api/v1/events")
    else:
        print("[INFO] Backend integration disabled (--no-backend or no events enabled).")

    # --- Open video source ---------------------------------------------------
    print(f"[INFO] Opening source: '{source}' …")
    cap = open_source(source)

    width   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 0
    print(f"[INFO] Stream: {width}×{height} @ {src_fps:.1f} FPS (source)")

    # --- Frame loop ----------------------------------------------------------
    frame_idx        = 0
    fps_display      = 0.0
    t_prev           = time.perf_counter()
    total_intrusions = 0   # session counter
    total_ai_events  = 0   # session counter

    print("[INFO] Running.  Press 'q' in the video window to quit.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[INFO] Stream ended or frame could not be read.  Exiting.")
            break

        # --- Inference -------------------------------------------------------
        if tracking_enabled:
            detections: List[DetectionResult] = processor.track(frame)   # type: ignore
        else:
            detections = processor.detect(frame)                          # type: ignore

        # --- Phase 2B: Person, Vehicle, Object Analytics Events --------------
        if object_events_enabled and event_analyzer is not None:
            analytics_events: List[AnalyticsEvent] = event_analyzer.process(detections)
            total_ai_events += len(analytics_events)

            for a_ev in analytics_events:
                print(f"\n[AI EVENT — Phase 2B: {a_ev.event_type}]")
                print(json.dumps(a_ev.as_dict(), indent=2))

                if backend_enabled and client is not None:
                    result = client.send(a_ev)
                    if result.success:
                        print(
                            f"[Phase 2B] ✓ {a_ev.event_type} sent  "
                            f"track_id={a_ev.track_id}  status={result.status_code}"
                        )
                    else:
                        print(
                            f"[Phase 2B] ✗ Send failed  "
                            f"track_id={a_ev.track_id}  {result.message}",
                            file=sys.stderr,
                        )

        # --- Phase 1C: intrusion detection -----------------------------------
        frame_events: List[IntrusionEvent] = []
        if fence_enabled and intr is not None and fence is not None:
            frame_events = intr.process(detections)
            total_intrusions += len(frame_events)

            # Console: print Phase 1C event on the frame they occur
            for ev in frame_events:
                print("\n[INTRUSION EVENT — Phase 1C]")
                print(json.dumps(ev.as_dict(), indent=2))

                # --- Phase 1D: send intrusion to backend ---------------------
                if backend_enabled and client is not None:
                    result = client.send(ev)
                    if result.success:
                        print(
                            f"[Phase 1D] ✓ INTRUSION_DETECTED sent  "
                            f"track_id={ev.track_id}  status={result.status_code}"
                        )
                    else:
                        print(
                            f"[Phase 1D] ✗ Send failed  "
                            f"track_id={ev.track_id}  {result.message}",
                            file=sys.stderr,
                        )

        # --- Draw detections (bounding boxes, labels, track IDs) ------------
        Detector.draw_detections(frame, detections, show_confidence=True)

        # --- Draw per-detection zone status badges ---------------------------
        if fence_enabled and intr is not None and fence is not None:
            for det in detections:
                if det.track_id is not None:
                    inside = intr.is_inside(det.track_id)
                    center = VirtualFence.bbox_center(
                        det.bbox.x1, det.bbox.y1, det.bbox.x2, det.bbox.y2
                    )
                    VirtualFence.draw_center_point(frame, center, inside)
                    IntrusionDetector.draw_zone_status(frame, det, inside)

        # --- Draw virtual fence polygon --------------------------------------
        if fence_enabled and fence is not None:
            any_inside = intr is not None and any(
                intr.is_inside(d.track_id)
                for d in detections
                if d.track_id is not None
            )
            fence.draw(frame, intrusion_active=any_inside)

        # --- Draw intrusion banner -------------------------------------------
        if fence_enabled:
            IntrusionDetector.draw_intrusion_overlay(frame, frame_events)

        # --- Per-frame stats HUD ---------------------------------------------
        t_now       = time.perf_counter()
        fps_display = 1.0 / max(t_now - t_prev, 1e-9)
        t_prev      = t_now

        n_persons  = sum(1 for d in detections if d.class_name == "person")
        n_vehicles = len(detections) - n_persons

        _draw_stats(
            frame, fps_display, n_persons, n_vehicles,
            tracking_enabled, fence_enabled, object_events_enabled,
            backend_enabled, total_intrusions, total_ai_events,
        )

        # --- Console: per-frame detection summary ----------------------------
        if PRINT_DETECTIONS and detections:
            print(
                f"Frame {frame_idx:05d} | FPS {fps_display:5.1f} "
                f"| persons={n_persons} vehicles={n_vehicles}"
            )
            for det in detections:
                print(f"   {det.as_dict()}")

        # --- Display ---------------------------------------------------------
        cv2.imshow(window_title, frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("[INFO] 'q' pressed — shutting down.")
            break

        frame_idx += 1

    # --- Clean up ------------------------------------------------------------
    cap.release()
    cv2.destroyAllWindows()
    print(
        f"[INFO] Done. Session intrusions: {total_intrusions}, "
        f"AI analytics events: {total_ai_events}"
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_fence(raw: str) -> list:
    """
    Parse a CLI polygon string like "200,100;600,100;600,400;200,400" into
    a list of (x, y) tuples.
    """
    try:
        points = []
        for pair in raw.split(";"):
            x_str, y_str = pair.strip().split(",")
            points.append((int(x_str.strip()), int(y_str.strip())))
        if len(points) < 3:
            raise ValueError("Need at least 3 vertices.")
        return points
    except Exception as exc:
        raise argparse.ArgumentTypeError(
            f"Invalid fence polygon '{raw}'. "
            "Expected format: 'x1,y1;x2,y2;x3,y3;...'  "
            f"Error: {exc}"
        ) from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="IBVAP Phase 2B — Complete AI Event Engine + Tracking + Virtual Fence",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # ---- Phase 1A flags (unchanged) ----
    parser.add_argument(
        "--source", "-s",
        default=DEFAULT_SOURCE,
        help='Video source: webcam index (e.g. "0") or path to a video file.',
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        help="YOLO model weights file or Ultralytics model name.",
    )
    parser.add_argument(
        "--confidence", "-c",
        type=float,
        default=DEFAULT_CONFIDENCE,
        help="Minimum detection confidence (0.0 – 1.0).",
    )
    parser.add_argument(
        "--device", "-d",
        default="",
        help='Inference device: "cpu", "cuda", "mps", or "" to auto-select.',
    )
    # ---- Phase 1B flags (unchanged) ----
    parser.add_argument(
        "--tracker",
        default=DEFAULT_TRACKER,
        help='Ultralytics tracker config name (e.g. "bytetrack.yaml").',
    )
    parser.add_argument(
        "--no-track",
        action="store_true",
        default=False,
        help="Disable tracking — run Phase 1A detection-only mode.",
    )
    # ---- Phase 1C flags (unchanged) ----
    parser.add_argument(
        "--no-fence",
        action="store_true",
        default=False,
        help="Disable virtual fence / intrusion detection.",
    )
    parser.add_argument(
        "--fence",
        type=_parse_fence,
        default=None,
        metavar="x1,y1;x2,y2;...",
        help=(
            "Custom fence polygon as semicolon-separated x,y pairs.  "
            "Example: --fence '200,100;600,100;600,400;200,400'.  "
            "Defaults to DEFAULT_FENCE_POLYGON in intrusion/fence.py."
        ),
    )
    # ---- Phase 1D flags (unchanged) ----
    parser.add_argument(
        "--no-backend",
        action="store_true",
        default=False,
        help=(
            "Disable HTTP backend integration. Detection, tracking, "
            "and event generation continue; events are NOT POSTed."
        ),
    )
    parser.add_argument(
        "--backend-url",
        default=DEFAULT_BACKEND_URL,
        help="Base URL of the Member 3 backend.",
    )
    parser.add_argument(
        "--camera-id",
        default=DEFAULT_CAMERA_ID,
        help="Camera identifier included in every Common Event payload.",
    )
    # ---- Phase 2B flags (new) ----
    parser.add_argument(
        "--no-object-events",
        action="store_true",
        default=False,
        help=(
            "Disable detection analytics events (PERSON_DETECTED, VEHICLE_DETECTED, "
            "OBJECT_DETECTED). INTRUSION_DETECTED events remain active."
        ),
    )
    return parser


if __name__ == "__main__":
    args = _build_parser().parse_args()

    # Resolve fence polygon: CLI > default constant
    fence_poly = args.fence if args.fence is not None else list(DEFAULT_FENCE_POLYGON)

    run(
        source=args.source,
        model_path=args.model,
        confidence=args.confidence,
        device=args.device,
        tracker_config=args.tracker,
        tracking_enabled=not args.no_track,
        fence_polygon=fence_poly,
        fence_enabled=not args.no_fence,
        object_events_enabled=not args.no_object_events,
        backend_enabled=not args.no_backend,
        backend_url=args.backend_url,
        camera_id=args.camera_id,
    )
