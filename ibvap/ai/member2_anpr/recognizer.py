"""
IBVAP - Member 2 ANPR Module - recognizer.py

Plate recognition, text normalisation, and Indian vehicle registration validation.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple

from .schemas import OCRResult, RecognitionResult

logger = logging.getLogger(__name__)

# Character substitutions based on likely confusion in specific positions
_ALPHA_CORRECTIONS: dict[str, str] = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "5": "S",
    "8": "B",
    "6": "G",
}

_DIGIT_CORRECTIONS: dict[str, str] = {
    "O": "0",
    "o": "0",
    "I": "1",
    "i": "1",
    "l": "1",
    "Z": "2",
    "z": "2",
    "S": "5",
    "s": "5",
    "B": "8",
    "b": "8",
    "G": "6",
    "g": "6",
}

# Recognized Indian State/UT Codes
INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DN", "DL", "GA", "GJ",
    "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TS", "TR", "UP", "UK",
    "UA", "WB", "BH"  # BH = Bharat Series
}

# Regular expressions for Indian registration formats
# Standard: State (2 letters) + RTO code (2 digits) + Series (1-3 letters) + Number (1-4 digits)
_RE_STANDARD_PLATE = re.compile(r"^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{1,4})$")
# Short / Old format (e.g. DL3C1234 or TN091234)
_RE_SHORT_PLATE = re.compile(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{0,2})([0-9]{1,4})$")
# Bharat Series: Year (2 digits) + BH + 4 digits + 1-2 letters (e.g. 22BH1234AA)
_RE_BH_PLATE = re.compile(r"^([0-9]{2})BH([0-9]{4})([A-Z]{1,2})$")


def _strip_noise(text: str) -> str:
    """Remove non-alphanumeric characters and convert to uppercase."""
    return re.sub(r"[^A-Za-z0-9]", "", text).upper().strip()


def _apply_confusion_map(text: str) -> str:
    """
    Position-aware character correction for standard Indian number plates.
    """
    if len(text) < 6:
        return text

    # Check if Bharat Series (Starts with 2 digits followed by BH)
    if len(text) >= 8 and (text[2:4] == "BH" or text[:2].isdigit()):
        # Year digits
        yr = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in text[:2])
        bh = "BH"
        # 4 numeric digits
        num_part = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in text[4:8])
        series_part = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in text[8:])
        return yr + bh + num_part + series_part

    # Standard state plate (XX 00 XX 0000)
    state = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in text[0:2])
    dist = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in text[2:4])
    
    # Rest of the plate
    remaining = text[4:]
    if not remaining:
        return state + dist

    # For standard Indian plates, the trailing registration number is typically up to 4 digits.
    # When remaining length is standard, apply position-specific mapping directly:
    if len(remaining) == 6:
        # e.g. AB1234 -> 2 letters series, 4 digits
        series = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in remaining[:2])
        number = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in remaining[2:])
        return state + dist + series + number
    elif len(remaining) == 5:
        # e.g. A1234 -> 1 letter series, 4 digits
        series = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in remaining[:1])
        number = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in remaining[1:])
        return state + dist + series + number
    elif len(remaining) == 7:
        # e.g. CAM1234 -> 3 letters series, 4 digits
        series = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in remaining[:3])
        number = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in remaining[3:])
        return state + dist + series + number
    elif len(remaining) == 4:
        # e.g. 1234 (no series) or A123 (1 letter series + 3 digits)
        if remaining[0].isalpha():
            series = "".join(_ALPHA_CORRECTIONS.get(c, c) for c in remaining[:1])
            number = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in remaining[1:])
        else:
            series = ""
            number = "".join(_DIGIT_CORRECTIONS.get(c, c) for c in remaining)
        return state + dist + series + number

    # Fallback for non-standard lengths
    letters = []
    digits = []
    found_digit = False
    for ch in remaining:
        if ch.isdigit() or found_digit:
            found_digit = True
            digits.append(_DIGIT_CORRECTIONS.get(ch, ch))
        else:
            letters.append(_ALPHA_CORRECTIONS.get(ch, ch))

    series = "".join(letters)
    number = "".join(digits)

    return state + dist + series + number


def normalise_plate(raw_text: str) -> tuple[str, bool]:
    """
    Normalise a raw OCR plate string into canonical registration form.

    Returns
    -------
    (normalised_text, was_normalised)
    """
    if not raw_text or not raw_text.strip():
        return "", False

    cleaned = _strip_noise(raw_text)
    corrected = _apply_confusion_map(cleaned)
    was_normalised = (corrected != raw_text.upper())

    logger.debug("normalise_plate: %r -> %r (modified=%s)", raw_text, corrected, was_normalised)
    return corrected, was_normalised


def validate_indian_plate(plate_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validate whether a normalised plate number matches recognised Indian patterns.

    Returns
    -------
    (is_valid, pattern_or_reason)
    """
    if not plate_number:
        return False, "Empty plate number"

    # Check Bharat Series
    if _RE_BH_PLATE.match(plate_number):
        return True, "Bharat Series (BH)"

    # Check Standard State Plate
    match = _RE_STANDARD_PLATE.match(plate_number)
    if match:
        state_code = match.group(1)
        if state_code in INDIAN_STATE_CODES:
            return True, f"Standard Indian Plate ({state_code})"
        return True, f"Standard Format (Unknown Prefix: {state_code})"

    # Check Short/Legacy Format
    match_short = _RE_SHORT_PLATE.match(plate_number)
    if match_short:
        state_code = match_short.group(1)
        if state_code in INDIAN_STATE_CODES:
            return True, f"Legacy/Short Format ({state_code})"

    # Plausible alphanumeric plate if between 6 and 11 chars
    if 6 <= len(plate_number) <= 11 and plate_number.isalnum():
        return True, "General Alphanumeric Plate"

    return False, "Unrecognized format or invalid length"


class PlateRecognizer:
    """Converts an OCRResult into a validated RecognitionResult."""

    def __init__(
        self,
        min_ocr_confidence: float = 0.30,
        min_plate_length: int = 4,
        max_plate_length: int = 12,
        strict_validation: bool = False,
    ) -> None:
        self._min_ocr_conf = min_ocr_confidence
        self._min_len = min_plate_length
        self._max_len = max_plate_length
        self._strict_validation = strict_validation

    def recognise(self, ocr_result: OCRResult) -> Optional[RecognitionResult]:
        """Normalise and validate an OCRResult."""
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

        is_valid, reason = validate_indian_plate(plate_number)
        if not is_valid and self._strict_validation:
            logger.warning("Plate %r failed validation: %s", plate_number, reason)
            return None

        return RecognitionResult(
            plate_number=plate_number,
            raw_text=ocr_result.raw_text,
            confidence=ocr_result.confidence,
            normalised=normalised,
            validation_passed=is_valid,
            validation_reason=reason,
        )
