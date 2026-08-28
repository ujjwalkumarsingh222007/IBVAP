"""
IBVAP - Member 2 ANPR Module - ocr.py

OCR engine abstraction layer.

Architecture
------------
BaseOCREngine           (abstract interface)
    |-- MockOCREngine      (deterministic stub - Phase 1 / testing)
    |-- [future] EasyOCREngine
    |-- [future] TesseractOCREngine
    |-- [future] PaddleOCREngine

The engine accepts a cropped plate image (NumPy array) and returns
an OCRResult containing raw text and confidence.
"""

from __future__ import annotations

import abc
import logging
from typing import Optional

import numpy as np

from .schemas import OCRResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class BaseOCREngine(abc.ABC):
    """Abstract base class for OCR engine implementations."""

    @abc.abstractmethod
    def read(self, plate_image: np.ndarray) -> OCRResult:
        """
        Perform OCR on a cropped plate image.

        Parameters
        ----------
        plate_image:
            A BGR or grayscale NumPy uint8 array containing (ideally)
            only the number-plate region.

        Returns
        -------
        OCRResult
            Raw text and confidence. An empty string in *raw_text*
            signals that the engine could not read any text; this is
            NOT an exception.

        Raises
        ------
        ValueError
            If *plate_image* is None or empty.
        RuntimeError
            If the underlying OCR engine fails catastrophically.
        """

    def _validate_image(self, image: Optional[np.ndarray]) -> None:
        """Shared validation helper."""
        if image is None:
            raise ValueError("plate_image must not be None")
        if not isinstance(image, np.ndarray):
            raise ValueError(f"plate_image must be a NumPy ndarray, got {type(image).__name__}")
        if image.size == 0:
            raise ValueError("plate_image must not be empty (zero-size array)")


# ---------------------------------------------------------------------------
# Mock implementation - Phase 1 / testing
# ---------------------------------------------------------------------------

_MOCK_DEFAULT_TEXT = "TN 09 AB 1234"
_MOCK_DEFAULT_CONFIDENCE = 0.91


class MockOCREngine(BaseOCREngine):
    """
    Deterministic mock OCR engine that does NOT require any model or GPU.

    Behaviour
    ---------
    * Returns a fixed plate text and confidence for valid images.
    * Returns empty text with low confidence for images smaller than 5x5.
    * Supports injecting a custom return value for targeted unit tests.

    Replace with a real OCR engine by subclassing BaseOCREngine.
    """

    def __init__(
        self,
        mock_text: str = _MOCK_DEFAULT_TEXT,
        mock_confidence: float = _MOCK_DEFAULT_CONFIDENCE,
    ) -> None:
        if not 0.0 <= mock_confidence <= 1.0:
            raise ValueError("mock_confidence must be in [0, 1]")
        self._mock_text = mock_text
        self._mock_confidence = mock_confidence
        logger.debug(
            "MockOCREngine initialised (text=%r, confidence=%.2f)",
            mock_text,
            mock_confidence,
        )

    def read(self, plate_image: np.ndarray) -> OCRResult:
        """Return the pre-configured mock text and confidence."""
        self._validate_image(plate_image)

        h, w = plate_image.shape[:2]

        if h < 5 or w < 5:
            logger.debug("plate_image too small for OCR -- returning empty result")
            return OCRResult(raw_text="", confidence=0.0, engine="mock")

        logger.debug("MockOCREngine.read: returning %r (conf=%.2f)", self._mock_text, self._mock_confidence)
        return OCRResult(
            raw_text=self._mock_text,
            confidence=self._mock_confidence,
            engine="mock",
        )
