"""
IBVAP - Member 2 ANPR Module - ocr.py

OCR engine abstraction layer.

Architecture
------------
BaseOCREngine           (abstract interface)
    |-- MockOCREngine      (deterministic stub - Phase 1 / testing)
    |-- EasyOCREngine      (EasyOCR integration with preprocessing - Phase 2)
"""

from __future__ import annotations

import abc
import logging
from typing import List, Optional

import numpy as np

from .preprocessing import PlatePreprocessor
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


# ---------------------------------------------------------------------------
# EasyOCR Implementation - Phase 2
# ---------------------------------------------------------------------------

class EasyOCREngine(BaseOCREngine):
    """
    EasyOCR reader implementation with integrated PlatePreprocessor.

    Parameters
    ----------
    languages:
        List of language codes to load (e.g. ['en']).
    gpu:
        Whether to use GPU acceleration.
    reader_instance:
        Optional pre-created easyocr.Reader instance (for dependency injection/testing).
    preprocessor:
        Optional custom PlatePreprocessor.
    """

    def __init__(
        self,
        languages: Optional[List[str]] = None,
        gpu: bool = False,
        reader_instance: Optional[object] = None,
        preprocessor: Optional[PlatePreprocessor] = None,
    ) -> None:
        self.languages = languages or ["en"]
        self.gpu = gpu
        self.preprocessor = preprocessor or PlatePreprocessor()

        if reader_instance is not None:
            self._reader = reader_instance
            logger.info("EasyOCREngine initialized with injected Reader instance")
        else:
            try:
                import easyocr  # lazy import
                self._reader = easyocr.Reader(self.languages, gpu=self.gpu, verbose=False)
                logger.info(
                    "EasyOCREngine initialized successfully (languages=%s, gpu=%s)",
                    self.languages,
                    self.gpu,
                )
            except ImportError as err:
                raise ImportError(
                    "The 'easyocr' package is required for EasyOCREngine. "
                    "Install it via 'pip install easyocr'."
                ) from err

    def read(self, plate_image: np.ndarray) -> OCRResult:
        """
        Run OCR on cropped plate image, testing both raw and preprocessed variants.
        """
        self._validate_image(plate_image)

        h, w = plate_image.shape[:2]
        if h < 5 or w < 5:
            return OCRResult(raw_text="", confidence=0.0, engine="easyocr")

        # 1. Run OCR on original crop
        raw_res = self._run_easyocr(plate_image)

        # 2. Run OCR on preprocessed variants
        try:
            enhanced_gray, binary, sharpened = self.preprocessor.get_variants(plate_image)
            gray_res = self._run_easyocr(enhanced_gray)
            bin_res = self._run_easyocr(binary)
            sharp_res = self._run_easyocr(sharpened)
            proc_h, proc_w = enhanced_gray.shape[:2]
        except Exception as exc:
            logger.debug("Preprocessing before OCR skipped/failed: %s", exc)
            gray_res = ("", 0.0)
            bin_res = ("", 0.0)
            sharp_res = ("", 0.0)
            proc_h, proc_w = h, w

        # Select candidate with the best confidence and non-empty text
        candidates = [raw_res, gray_res, bin_res, sharp_res]
        valid_candidates = [c for c in candidates if c[0].strip()]
        if valid_candidates:
            best_text, best_conf = max(valid_candidates, key=lambda item: item[1])
        else:
            best_text, best_conf = "", 0.0

        logger.debug(
            "[OCR] original_size=%dx%d | processed_size=%dx%d | ocr_text=%r | ocr_confidence=%.2f",
            w,
            h,
            proc_w,
            proc_h,
            best_text,
            best_conf,
        )

        return OCRResult(
            raw_text=best_text,
            confidence=round(best_conf, 4),
            engine="easyocr",
        )

    def _run_easyocr(self, img: np.ndarray) -> tuple[str, float]:
        """Internal helper to execute reader on an image array."""
        try:
            results = self._reader.readtext(
                img,
                detail=1,
                paragraph=False,
            )
        except Exception as exc:
            logger.warning("EasyOCR read error: %s", exc)
            return "", 0.0

        if not results:
            return "", 0.0

        # results format: [ (bbox, text, conf), ... ]
        text_parts = []
        conf_parts = []

        for item in results:
            if len(item) >= 3:
                _, text, conf = item[:3]
                if text and str(text).strip():
                    text_parts.append(str(text).strip())
                    conf_parts.append(float(conf))

        if not text_parts:
            return "", 0.0

        combined_text = " ".join(text_parts)
        avg_conf = sum(conf_parts) / len(conf_parts) if conf_parts else 0.0
        return combined_text, avg_conf
