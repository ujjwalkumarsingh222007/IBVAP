"""
main.py — IBVAP Phase 1A + 1B entry point.

Responsibility
--------------
* Parse CLI arguments (source, confidence, model, device, tracker, no-track).
* Open the video source (webcam or file) via OpenCV.
* Drive the frame loop.
* Phase 1A mode: call Detector.detect() — detection only, no track IDs.
* Phase 1B mode: call ObjectTracker.track() — detection + persistent IDs.
* Call Detector.draw_detections() to overlay results (works for both phases
  because track_id is already part of DetectionResult).
* Display the annotated frame in a window.
* Print per-frame summaries to stdout.
* Exit cleanly on 'q' key press or when the source is exhausted.

Detection / tracking logic lives in detection/ and tracking/ — NOT here.

Phase compatibility
-------------------
Phase 1A  →  python main.py --no-track
Phase 1B  →  python main.py              (tracking ON by default)
Phase 1C  →  will consume List[DetectionResult] with track_id populated
Phase 1D  →  will call det.as_dict() and forward to FastAPI
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import List, Optional, Union

import cv2

from detection import Detector, DetectionResult
from tracking import ObjectTracker

# ---------------------------------------------------------------------------
# Default configuration — override via CLI flags
# ---------------------------------------------------------------------------

DEFAULT_MODEL:      str   = "yolov8n.pt"    # ~6 MB, auto-downloaded on first run
DEFAULT_CONFIDENCE: float = 0.40
DEFAULT_SOURCE:     str   = "0"             # "0" = first webcam
DEFAULT_TRACKER:    str   = "bytetrack.yaml"  # bundled with Ultralytics
PRINT_DETECTIONS:   bool  = True            # toggle to reduce console noise


# ---------------------------------------------------------------------------
# Helper: open video source
# ---------------------------------------------------------------------------

def open_source(source: str) -> cv2.VideoCapture:
    """
    Open a webcam index or a file path.

    Parameters
    ----------
    source : str
        ``"0"`` / ``"1"`` … for webcam indices, or a path to a video file.

    Returns
    -------
    cv2.VideoCapture — guaranteed to be opened; raises SystemExit otherwise.
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
# Helper: overlay HUD stats in the top-left corner
# ---------------------------------------------------------------------------

def _draw_stats(
    frame,
    fps: float,
    n_persons: int,
    n_vehicles: int,
    tracking_enabled: bool,
) -> None:
    mode_label = "TRACKING ON" if tracking_enabled else "DETECT ONLY"
    lines = [
        f"FPS:      {fps:5.1f}",
        f"Persons:  {n_persons}",
        f"Vehicles: {n_vehicles}",
        f"Mode:     {mode_label}",
        "Press 'q' to quit",
    ]
    y = 22
    for line in lines:
        cv2.putText(
            frame, line, (8, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55,
            (0, 255, 255), 2, cv2.LINE_AA,
        )
        y += 22


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
) -> None:
    """Initialise detector/tracker, open video source, run frame loop."""

    # --- Initialise detector or tracker --------------------------------------
    if tracking_enabled:
        print(f"[INFO] Phase 1B — tracking enabled  (tracker: {tracker_config})")
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
        window_title = "IBVAP — Phase 1B: Tracking"
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

    # --- Open video source ---------------------------------------------------
    print(f"[INFO] Opening source: '{source}' …")
    cap = open_source(source)

    width   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 0
    print(f"[INFO] Stream: {width}×{height} @ {src_fps:.1f} FPS (source)")

    # --- Frame loop ----------------------------------------------------------
    frame_idx   = 0
    fps_display = 0.0
    t_prev      = time.perf_counter()

    print("[INFO] Running.  Press 'q' in the video window to quit.\n")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("[INFO] Stream ended or frame could not be read.  Exiting.")
            break

        # --- Inference (detection or tracking) -------------------------------
        if tracking_enabled:
            detections: List[DetectionResult] = processor.track(frame)   # type: ignore[union-attr]
        else:
            detections = processor.detect(frame)   # type: ignore[union-attr]

        # --- Draw results ----------------------------------------------------
        # draw_detections() already handles track_id labels from Phase 1A;
        # nothing here needs to change between phases.
        Detector.draw_detections(frame, detections, show_confidence=True)

        # --- Per-frame stats --------------------------------------------------
        t_now       = time.perf_counter()
        fps_display = 1.0 / max(t_now - t_prev, 1e-9)
        t_prev      = t_now

        n_persons  = sum(1 for d in detections if d.class_name == "person")
        n_vehicles = len(detections) - n_persons

        _draw_stats(frame, fps_display, n_persons, n_vehicles, tracking_enabled)

        # --- Console output --------------------------------------------------
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
    print("[INFO] Done.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="IBVAP Phase 1B — Person & Vehicle Detection + Tracking",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
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
    # --- Phase 1B additions ---
    parser.add_argument(
        "--tracker",
        default=DEFAULT_TRACKER,
        help='Ultralytics tracker config name (e.g. "bytetrack.yaml", "botsort.yaml").',
    )
    parser.add_argument(
        "--no-track",
        action="store_true",
        default=False,
        help="Disable tracking and run Phase 1A detection-only mode.",
    )
    return parser


if __name__ == "__main__":
    args = _build_parser().parse_args()
    run(
        source=args.source,
        model_path=args.model,
        confidence=args.confidence,
        device=args.device,
        tracker_config=args.tracker,
        tracking_enabled=not args.no_track,
    )
