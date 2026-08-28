"""
tracker.py — Phase 1B: YOLO + ByteTrack object tracker.

Design notes
------------
* ObjectTracker wraps Ultralytics' built-in `model.track()` API so that no
  external tracking library is needed beyond what Ultralytics already ships.
  The default algorithm is ByteTrack (lightweight, no GPU requirement).

* The tracker REPLACES the bare `model()` call used in Phase 1A detection.
  It produces the same List[DetectionResult] output, but now with track_id
  populated for every tracked object.

* `persist=True` is the critical flag — it tells Ultralytics to keep the
  internal tracker state alive between consecutive frame calls, which is what
  enables stable IDs across frames.

* Phase 1A Detector.detect() still works unchanged (used when tracking is
  disabled via --no-track flag in main.py).

Phase 1C hook
-------------
Every DetectionResult returned here already contains:
    class_name, confidence, bbox (x1/y1/x2/y2), track_id
Phase 1C (virtual fence) only needs to consume that list — no changes here.

Phase 1D hook
-------------
det.as_dict() serialises track_id automatically when it is not None.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np
from ultralytics import YOLO

# Re-use the shared data contracts from Phase 1A — do not duplicate them.
from detection.detector import (
    BoundingBox,
    DetectionResult,
    TARGET_CLASS_IDS,
)


class ObjectTracker:
    """
    Frame-by-frame object tracker using Ultralytics YOLO + ByteTrack.

    Parameters
    ----------
    model_path : str
        Path to YOLO weights (``*.pt``) or an Ultralytics model name
        (e.g. ``"yolov8n.pt"``).  The same model used in Phase 1A is fine.
    confidence_threshold : float
        Detections below this score are discarded before tracking.
    tracker_config : str
        Tracker configuration name or path accepted by Ultralytics.
        ``"bytetrack.yaml"`` (default) is bundled with Ultralytics and
        requires no extra installation.
    device : str
        Inference device: ``"cpu"``, ``"cuda"``, ``"mps"``, or ``""`` (auto).
    """

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence_threshold: float = 0.40,
        tracker_config: str = "bytetrack.yaml",
        device: str = "",
    ) -> None:
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.tracker_config = tracker_config
        self.device = device

        self._model: Optional[YOLO] = None
        self._load_model()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _load_model(self) -> None:
        """Load YOLO weights.  Raises RuntimeError on failure."""
        try:
            self._model = YOLO(self.model_path)
            # Warm-up pass so the first real frame is not penalised.
            dummy = np.zeros((64, 64, 3), dtype=np.uint8)
            self._model(dummy, verbose=False, device=self.device)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load YOLO model from '{self.model_path}': {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Core tracking — replaces Detector.detect() in the Phase 1B pipeline
    # ------------------------------------------------------------------

    def track(self, frame: np.ndarray) -> List[DetectionResult]:
        """
        Run YOLO + ByteTrack on *frame* and return tracked detections.

        The internal tracker state is preserved between calls thanks to
        ``persist=True``, which is what keeps IDs stable across consecutive
        frames for the same object.

        Parameters
        ----------
        frame : np.ndarray
            BGR image array from ``cv2.VideoCapture.read()``.

        Returns
        -------
        List[DetectionResult]
            Detections above the confidence threshold.  ``track_id`` is set
            to an integer for objects the tracker has assigned an ID to, or
            ``None`` when the tracker cannot assign one (rare edge case).

        Notes
        -----
        * Track IDs are assigned by the ByteTrack algorithm, NOT by index.
        * IDs persist as long as the tracker considers the object to be the
          same object across frames.
        * IDs may change after long occlusion or when an object re-enters
          the scene — this is expected tracker behaviour, not a bug.
        """
        if self._model is None:
            raise RuntimeError("Model is not loaded.")

        # persist=True  ← keeps tracker state alive between frame calls
        # tracker=...   ← selects ByteTrack (bundled with Ultralytics)
        results = self._model.track(
            frame,
            persist=True,
            tracker=self.tracker_config,
            conf=self.confidence_threshold,
            classes=list(TARGET_CLASS_IDS),   # only person & vehicles
            verbose=False,
            device=self.device,
        )

        detections: List[DetectionResult] = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes
            n = len(boxes)
            if n == 0:
                continue

            # boxes.id is a tensor of track IDs, or None when the tracker
            # has not yet assigned IDs (e.g. first frame with no matches).
            ids = boxes.id  # Tensor[n] or None

            for i in range(n):
                cls_id = int(boxes.cls[i].item())
                conf   = float(boxes.conf[i].item())
                x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())

                class_name = (
                    result.names.get(cls_id, str(cls_id))
                    if result.names
                    else str(cls_id)
                )

                # Extract integer track ID if available
                track_id: Optional[int] = None
                if ids is not None:
                    track_id = int(ids[i].item())

                detections.append(
                    DetectionResult(
                        class_id=cls_id,
                        class_name=class_name,
                        confidence=conf,
                        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
                        track_id=track_id,
                    )
                )

        return detections

    def reset(self) -> None:
        """
        Reset tracker state.

        Call this when switching video sources or restarting a stream so that
        IDs from the previous session do not bleed into the new one.
        """
        # Re-loading the model resets Ultralytics' internal tracker state.
        self._load_model()

    def is_ready(self) -> bool:
        """Return True if the model is loaded and ready."""
        return self._model is not None

    def __repr__(self) -> str:
        return (
            f"ObjectTracker(model='{self.model_path}', "
            f"tracker='{self.tracker_config}', "
            f"conf={self.confidence_threshold}, device='{self.device}')"
        )
