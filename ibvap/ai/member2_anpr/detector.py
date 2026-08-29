"""
IBVAP - Member 2 ANPR Module - detector.py

Plate detector abstraction layer.

Architecture
------------
BasePlateDetector        (abstract interface)
    |-- MockPlateDetector   (deterministic stub - Phase 1 / testing)
    |-- YOLOPlateDetector   (Ultralytics YOLO license plate detector - Phase 2)
"""

from __future__ import annotations

import abc
import logging
import os
from typing import List, Optional

import numpy as np

from .schemas import PlateRegion

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class BasePlateDetector(abc.ABC):
    """
    Abstract base class for all plate detector implementations.

    Implementations must override `detect()`. They must NOT perform
    vehicle detection, tracking, or OCR -- those responsibilities belong
    to other modules.
    """

    @abc.abstractmethod
    def detect(self, frame: np.ndarray) -> List[PlateRegion]:
        """
        Detect number-plate regions within *frame*.

        Parameters
        ----------
        frame:
            A BGR image as a NumPy uint8 array of shape (H, W, 3) or
            a grayscale array of shape (H, W).

        Returns
        -------
        list[PlateRegion]
            Zero or more detected plate bounding boxes, each with a
            confidence score in [0, 1]. An empty list means no plates
            were found (not an error condition).

        Raises
        ------
        ValueError
            If *frame* is None, empty, or has an unexpected shape.
        RuntimeError
            If the underlying detection model fails catastrophically.
        """

    def _validate_frame(self, frame: Optional[np.ndarray]) -> None:
        """Shared validation helper -- call this at the start of detect()."""
        if frame is None:
            raise ValueError("Frame must not be None")
        if not isinstance(frame, np.ndarray):
            raise ValueError(f"Frame must be a NumPy ndarray, got {type(frame).__name__}")
        if frame.size == 0:
            raise ValueError("Frame must not be empty (zero-size array)")
        if frame.ndim not in (2, 3):
            raise ValueError(
                f"Frame must be 2-D (grayscale) or 3-D (colour), got {frame.ndim}-D"
            )
        if frame.ndim == 3 and frame.shape[2] not in (1, 3, 4):
            raise ValueError(
                f"Frame channel count must be 1, 3, or 4; got {frame.shape[2]}"
            )


# ---------------------------------------------------------------------------
# Mock implementation - Phase 1 / testing
# ---------------------------------------------------------------------------

class MockPlateDetector(BasePlateDetector):
    """
    Deterministic mock detector that does NOT require any model files or GPU.
    """

    def __init__(self, confidence: float = 0.90) -> None:
        if not 0.0 <= confidence <= 1.0:
            raise ValueError("confidence must be in [0, 1]")
        self._confidence = confidence
        logger.debug("MockPlateDetector initialised (confidence=%.2f)", confidence)

    def detect(self, frame: np.ndarray) -> List[PlateRegion]:
        """Return a single mock plate region centred on the frame."""
        self._validate_frame(frame)

        h, w = frame.shape[:2]

        if h < 10 or w < 10:
            logger.debug("Frame too small (%dx%d) -- returning no detections", w, h)
            return []

        x1 = max(0, int(w * 0.20))
        y1 = max(0, int(h * 0.40))
        x2 = min(w - 1, int(w * 0.80))
        y2 = min(h - 1, int(h * 0.60))

        region = PlateRegion(x1=x1, y1=y1, x2=x2, y2=y2, confidence=self._confidence)
        logger.debug("MockPlateDetector: detected region %s", region)
        return [region]


# ---------------------------------------------------------------------------
# YOLO Implementation - Phase 2
# ---------------------------------------------------------------------------

class YOLOPlateDetector(BasePlateDetector):
    """
    Ultralytics YOLO-based number plate detector.

    Parameters
    ----------
    model_path:
        Path to the YOLO model weights (.pt).
    confidence_threshold:
        Detection score threshold [0, 1].
    device:
        Inference device ('cpu', 'cuda', etc.).
    model_instance:
        Optional pre-instantiated YOLO object (primarily for dependency injection in testing).
    """

    def __init__(
        self,
        model_path: str = "models/license_plate.pt",
        confidence_threshold: float = 0.40,
        device: str = "cpu",
        model_instance: Optional[object] = None,
    ) -> None:
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be in [0, 1]")

        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.device = device

        if model_instance is not None:
            self._model = model_instance
            logger.info("YOLOPlateDetector initialized with injected model instance")
        else:
            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"YOLO plate detector model weights not found at '{model_path}'. "
                    f"Please specify a valid path via PLATE_MODEL_PATH or configure the detector."
                )
            try:
                from ultralytics import YOLO  # lazy import
                self._model = YOLO(model_path)
                logger.info(
                    "YOLOPlateDetector loaded weights from %s (device=%s, conf=%.2f)",
                    model_path,
                    device,
                    confidence_threshold,
                )
            except ImportError as err:
                raise ImportError(
                    "The 'ultralytics' package is required for YOLOPlateDetector. "
                    "Install it via 'pip install ultralytics'."
                ) from err

    def detect(self, frame: np.ndarray) -> List[PlateRegion]:
        """
        Run YOLO license plate detection on frame.
        """
        self._validate_frame(frame)

        h, w = frame.shape[:2]
        if h < 10 or w < 10:
            return []

        try:
            # Predict bounding boxes
            results = self._model.predict(
                source=frame,
                conf=self.confidence_threshold,
                device=self.device,
                verbose=False,
            )
        except Exception as exc:
            logger.error("YOLO inference failed: %s", exc, exc_info=True)
            raise RuntimeError(f"YOLO inference error: {exc}") from exc

        plate_regions: List[PlateRegion] = []
        if not results:
            return plate_regions

        for r in results:
            boxes = getattr(r, "boxes", None)
            if boxes is None:
                continue

            for box in boxes:
                # Extract coordinates and confidence
                xyxy = box.xyxy[0].tolist() if hasattr(box.xyxy, "tolist") else list(box.xyxy[0])
                conf = float(box.conf[0]) if hasattr(box.conf, "__getitem__") else float(box.conf)

                x1 = max(0, int(round(xyxy[0])))
                y1 = max(0, int(round(xyxy[1])))
                x2 = min(w, int(round(xyxy[2])))
                y2 = min(h, int(round(xyxy[3])))

                if x2 > x1 and y2 > y1 and conf >= self.confidence_threshold:
                    plate_regions.append(
                        PlateRegion(
                            x1=x1,
                            y1=y1,
                            x2=x2,
                            y2=y2,
                            confidence=round(conf, 4),
                        )
                    )

        # Sort plate regions by confidence descending and apply IoU Non-Maximum Suppression
        plate_regions.sort(key=lambda r: r.confidence, reverse=True)
        filtered_regions: List[PlateRegion] = []
        for reg in plate_regions:
            overlap = False
            for kept in filtered_regions:
                ix1 = max(reg.x1, kept.x1)
                iy1 = max(reg.y1, kept.y1)
                ix2 = min(reg.x2, kept.x2)
                iy2 = min(reg.y2, kept.y2)
                if ix2 > ix1 and iy2 > iy1:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area_reg = (reg.x2 - reg.x1) * (reg.y2 - reg.y1)
                    area_kept = (kept.x2 - kept.x1) * (kept.y2 - kept.y1)
                    union = area_reg + area_kept - intersection
                    iou = intersection / union if union > 0 else 0
                    if iou > 0.35:
                        overlap = True
                        break
            if not overlap:
                filtered_regions.append(reg)

        logger.debug("YOLOPlateDetector detected %d plates after NMS", len(filtered_regions))
        return filtered_regions
