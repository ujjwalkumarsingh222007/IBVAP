"""
detector.py — Core YOLO-based person & vehicle detector.

Phase 1A: Detection only (no tracking, no virtual fence, no CEF output).

Design notes
------------
* Detector is a plain class with no dependency on OpenCV's GUI or video loop.
  All drawing helpers are separate so the class stays testable without a display.
* DetectionResult is a typed dataclass so downstream phases (1B, 1C, 1D) can
  consume structured data rather than raw YOLO tensors.
* The COCO class IDs that count as "vehicle" are declared as a module constant
  so they can be adjusted without touching inference logic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import cv2
import numpy as np
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# COCO class IDs that IBVAP Phase 1A cares about.
# Reference: https://docs.ultralytics.com/datasets/detect/coco/#categories
# ---------------------------------------------------------------------------

# person
PERSON_CLASS_ID: int = 0

# vehicle subset
VEHICLE_CLASS_IDS: set[int] = {
    2,   # car
    3,   # motorcycle
    5,   # bus
    7,   # truck
}

TARGET_CLASS_IDS: set[int] = {PERSON_CLASS_ID} | VEHICLE_CLASS_IDS

# Colour palette: BGR, one colour per relevant COCO class id
_CLASS_COLOURS: dict[int, tuple[int, int, int]] = {
    0:  (0,   255,  0),   # person  — green
    2:  (255, 100,  0),   # car     — blue-orange
    3:  (0,   200, 255),  # motorcycle — yellow-ish
    5:  (255,   0, 200),  # bus     — magenta
    7:  (50,   50, 255),  # truck   — red
}
_DEFAULT_COLOUR: tuple[int, int, int] = (200, 200, 200)


# ---------------------------------------------------------------------------
# Data contract — shared across all future phases
# ---------------------------------------------------------------------------

@dataclass
class BoundingBox:
    """Pixel-space bounding box (top-left / bottom-right corners)."""
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1

    def as_dict(self) -> dict:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2}


@dataclass
class DetectionResult:
    """
    A single detection returned by Detector.detect().

    Structured so that Phase 1B (tracking) can attach a track_id,
    Phase 1C (virtual fence) can check spatial overlap, and
    Phase 1D (CEF) can serialise directly.
    """
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox
    # Reserved for Phase 1B — leave None in Phase 1A
    track_id: Optional[int] = field(default=None)

    def as_dict(self) -> dict:
        """Serialisable dict matching the output contract in the spec."""
        return {
            "class_name":  self.class_name,
            "confidence":  round(self.confidence, 4),
            "bbox":        self.bbox.as_dict(),
            # track_id omitted when None to keep Phase 1A output clean
            **({"track_id": self.track_id} if self.track_id is not None else {}),
        }


# ---------------------------------------------------------------------------
# Main detector class
# ---------------------------------------------------------------------------

class Detector:
    """
    YOLO-based person & vehicle detector.

    Parameters
    ----------
    model_path : str
        Path to a YOLO weights file (``*.pt``) **or** a model name that
        Ultralytics will auto-download, e.g. ``"yolov8n.pt"``.
        Downloaded weights are cached in ``~/.cache/ultralytics/`` by default.
    confidence_threshold : float
        Detections below this score are discarded (0.0 – 1.0).
    device : str
        Inference device.  ``"cpu"``, ``"cuda"``, ``"mps"``, or ``""`` to
        let Ultralytics pick automatically.
    """

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence_threshold: float = 0.40,
        device: str = "",
    ) -> None:
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
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
            # Warm-up: run one blank inference so the first real frame is fast
            dummy = np.zeros((64, 64, 3), dtype=np.uint8)
            self._model(dummy, verbose=False, device=self.device)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load YOLO model from '{self.model_path}': {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Core inference — this is the only method Phase 1B/1C need to replace
    # ------------------------------------------------------------------

    def detect(self, frame: np.ndarray) -> List[DetectionResult]:
        """
        Run YOLO inference on *frame* and return filtered detections.

        Parameters
        ----------
        frame : np.ndarray
            BGR image array as produced by ``cv2.VideoCapture.read()``.

        Returns
        -------
        List[DetectionResult]
            Only detections whose class is in TARGET_CLASS_IDS and whose
            confidence is >= self.confidence_threshold.
        """
        if self._model is None:
            raise RuntimeError("Model is not loaded.  Call _load_model() first.")

        results = self._model(
            frame,
            conf=self.confidence_threshold,
            classes=list(TARGET_CLASS_IDS),   # filter at YOLO level — faster
            verbose=False,
            device=self.device,
        )

        detections: List[DetectionResult] = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes
            for i in range(len(boxes)):
                cls_id     = int(boxes.cls[i].item())
                conf       = float(boxes.conf[i].item())
                x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())

                class_name = (
                    result.names.get(cls_id, str(cls_id))
                    if result.names
                    else str(cls_id)
                )

                detections.append(
                    DetectionResult(
                        class_id=cls_id,
                        class_name=class_name,
                        confidence=conf,
                        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
                    )
                )

        return detections

    # ------------------------------------------------------------------
    # Drawing helpers (optional — only called by the video loop in main.py)
    # ------------------------------------------------------------------

    @staticmethod
    def draw_detections(
        frame: np.ndarray,
        detections: List[DetectionResult],
        show_confidence: bool = True,
    ) -> np.ndarray:
        """
        Overlay bounding boxes and labels onto *frame* (in-place).

        Kept as a static method so it can be called without an active model,
        which makes unit-testing the drawing logic straightforward.
        """
        for det in detections:
            colour = _CLASS_COLOURS.get(det.class_id, _DEFAULT_COLOUR)
            b = det.bbox

            # Bounding box
            cv2.rectangle(frame, (b.x1, b.y1), (b.x2, b.y2), colour, 2)

            # Label string
            label = det.class_name
            if show_confidence:
                label = f"{label} {det.confidence:.2f}"
            if det.track_id is not None:
                label = f"#{det.track_id} {label}"

            # Background pill for readability
            (text_w, text_h), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2
            )
            label_y_top = max(b.y1 - text_h - baseline - 4, 0)
            cv2.rectangle(
                frame,
                (b.x1, label_y_top),
                (b.x1 + text_w + 4, b.y1),
                colour,
                cv2.FILLED,
            )
            cv2.putText(
                frame,
                label,
                (b.x1 + 2, b.y1 - baseline - 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 0),   # black text on coloured background
                2,
                cv2.LINE_AA,
            )

        return frame

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def is_ready(self) -> bool:
        """Return True if the model is loaded and ready to run inference."""
        return self._model is not None

    def __repr__(self) -> str:
        return (
            f"Detector(model='{self.model_path}', "
            f"conf={self.confidence_threshold}, device='{self.device}')"
        )
