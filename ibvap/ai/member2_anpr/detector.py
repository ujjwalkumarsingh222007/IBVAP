"""
IBVAP - Member 2 ANPR Module - detector.py

Plate detector abstraction layer.

Architecture
------------
BasePlateDetector        (abstract interface)
    |-- MockPlateDetector   (deterministic stub - Phase 1 / testing)
    |-- [future] YOLOPlateDetector
    |-- [future] EASTPlateDetector

Only number-plate bounding boxes are produced here.
Vehicle detection and tracking are Member 1 (CV) responsibilities.
"""

from __future__ import annotations

import abc
import logging
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

    Behaviour
    ---------
    * Returns a single hardcoded PlateRegion for any valid, non-trivial frame.
    * Returns an empty list for frames smaller than 10x10 pixels.
    * Raises ValueError for None / empty frames (exercising error handling).

    Replace with a real detector by subclassing BasePlateDetector.
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
