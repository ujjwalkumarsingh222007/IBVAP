"""
IBVAP - Member 2 ANPR Module - recognizer.py

Plate recognition and text normalisation layer.

Example
-------
Input  : "TN 09 AB  1234"
Output : "TN09AB1234"
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from .schemas import OCRResult, RecognitionResult

logger = logging.getLogger(__name__)

# Common OCR confusions: applied per section of the plate.
_ALPHA_TO_ALPHA: dict[str, str] = {"0": "O"}
_DIGIT_TO_DIGIT: dict[str, str] = {"O": "0", "I": "1", "l": "1", "S": "5", "B": "8"}


def _strip_noise(text: str) -> str:
    """Remove non-alphanumeric characters and collapse to uppercase."""
    return re.sub(r"[^A-Za-z0-9]", "", text).upper().strip()


def _apply_confusion_map(text: str) -> str:
    """
    Heuristic character correction based on position within an Indian plate.

    For standard plates (XX00XX0000):
    - pos 0-1  : state code (alpha)
    - pos 2-3  : district (digit)
    - pos 4-6  : series (alpha)
    - pos 7-10 : number (digit)
    """
    if len(text) < 6:
        return text

    state  = "".join(_ALPHA_TO_ALPHA.get(c, c) for c in text[0:2])
    dist   = "".join(_DIGIT_TO_DIGIT.get(c, c) for c in text[2:4])
    series = "".join(_ALPHA_TO_ALPHA.get(c, c) for c in text[4:6]) if len(text) >= 6 else ""
    number = "".join(_DIGIT_TO_DIGIT.get(c, c) for c in text[6:]) if len(text) > 6 else ""

    return state + dist + series + number


def normalise_plate(raw_text: str) -> tuple[str, bool]:
    """
    Normalise a raw OCR plate string.

    Returns
    -------
    (normalised_text, was_normalised)
    """
    if not raw_text or not raw_text.strip():
        return "", False

    cleaned = _strip_noise(raw_text)
    corrected = _apply_confusion_map(cleaned)
    was_normalised = corrected != raw_text.upper()

    logger.debug("normalise_plate: %r -> %r (modified=%s)", raw_text, corrected, was_normalised)
    return corrected, was_normalised


class PlateRecognizer:
    """Converts an OCRResult into a RecognitionResult via normalisation."""

    def __init__(
        self,
        min_ocr_confidence: float = 0.30,
        min_plate_length: int = 4,
        max_plate_length: int = 12,
    ) -> None:
        self._min_ocr_conf = min_ocr_confidence
        self._min_len = min_plate_length
        self._max_len = max_plate_length

    def recognise(self, ocr_result: OCRResult) -> Optional[RecognitionResult]:
        """Normalise an OCRResult. Returns None if quality thresholds are not met."""
        if ocr_result.confidence < self._min_ocr_conf:
            logger.warning(
                "OCR confidence %.2f below threshold %.2f -- rejecting",
                ocr_result.confidence,
                self._min_ocr_conf,
            )
            return None

        plate_number, normalised = normalise_plate(ocr_result.raw_text)

        if len(plate_number) < self._min_len:
            logger.warning(
                "Normalised plate %r too short (%d < %d) -- rejecting",
                plate_number, len(plate_number), self._min_len,
            )
            return None

        if len(plate_number) > self._max_len:
            logger.warning(
                "Normalised plate %r too long (%d > %d) -- rejecting",
                plate_number, len(plate_number), self._max_len,
            )
            return None

        return RecognitionResult(
            plate_number=plate_number,
            raw_text=ocr_result.raw_text,
            confidence=ocr_result.confidence,
            normalised=normalised,
        )
