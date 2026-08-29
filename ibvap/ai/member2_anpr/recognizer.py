"""
IBVAP - Member 2 ANPR Module - recognizer.py

Normalises raw OCR output, validates Indian registration formats, corrects
common character confusion, and builds a RecognitionResult.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Set, Tuple

from .schemas import OCRResult, RecognitionResult

logger = logging.getLogger(__name__)

# Official 2-letter State & Union Territory codes of India
INDIAN_STATE_CODES: Set[str] = {
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN",
    "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
    "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "PB", "PY", "RJ",
    "SK", "TN", "TR", "TS", "UK", "UP", "WB",
}

# Standard patterns for Indian registrations:
# 1. Standard: State (2 letters) + District (2 digits) + Series (0-3 letters) + Number (4 digits)
_STD_INDIAN_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$")

# 2. Bharat (BH) Series: Year (2 digits) + BH + Number (4 digits) + Series (1-2 letters)
_BH_SERIES_PATTERN = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")

# 3. Short / Legacy formats (e.g. DL 1C 1234 or TN 09 1234)
_SHORT_INDIAN_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{1,4}$")


def validate_indian_plate(plate_text: str, strict: bool = False) -> Tuple[bool, str]:
    """
    Validate whether a normalised plate matches valid Indian registration formats.

    Parameters
    ----------
    plate_text:
        Normalised uppercase alphanumeric string (e.g. 'TN09AB1234', '22BH1234AA').
    strict:
        If True, requires strict state code matching and exact standard lengths.

    Returns
    -------
    Tuple[bool, str]
        (is_valid, validation_reason_or_description)
    """
    if not plate_text:
        return False, "Empty plate string"

    text = plate_text.strip().upper()

    # Check Bharat (BH) Series first: YY BH #### XX
    if _BH_SERIES_PATTERN.match(text):
        return True, "Bharat (BH) Series"

    # Check Standard Series: SS DD [SSS] ####
    if _STD_INDIAN_PATTERN.match(text):
        state_prefix = text[:2]
        if state_prefix in INDIAN_STATE_CODES:
            return True, f"Standard Indian Plate ({state_prefix})"
        if strict:
            return False, f"Invalid State/UT Code: {state_prefix}"
        return True, f"Standard Format (Unverified State: {state_prefix})"

    # Check Short/Legacy format
    if _SHORT_INDIAN_PATTERN.match(text):
        state_prefix = text[:2]
        if state_prefix in INDIAN_STATE_CODES:
            return True, f"Legacy/Short Format ({state_prefix})"
        if strict:
            return False, f"Invalid State/UT Code: {state_prefix}"
        return True, "Legacy/Short Format"

    return False, "Does not match any recognized Indian plate format"


# Context-dependent OCR character confusion substitutions
_TO_DIGIT = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
_TO_ALPHA = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}


def _apply_confusion_map(text: str) -> str:
    """
    Apply position-aware character confusion heuristics for Indian license plates.
    """
    if len(text) < 6:
        return text

    chars = list(text)

    # Bharat (BH) Series: YY BH #### XX
    if len(text) in (9, 10) and (text[2:4] == "BH" or (text[2] in "8B" and text[3] == "H")):
        chars[0] = _TO_DIGIT.get(chars[0], chars[0])
        chars[1] = _TO_DIGIT.get(chars[1], chars[1])
        chars[2] = "B"
        chars[3] = "H"
        for i in range(4, 8):
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])
        for i in range(8, len(chars)):
            chars[i] = _TO_ALPHA.get(chars[i], chars[i])
        return "".join(chars)

    # Standard Format: State(2) + District(2) + [Series + Number]
    # Pos 0, 1: State code letters
    chars[0] = _TO_ALPHA.get(chars[0], chars[0])
    chars[1] = _TO_ALPHA.get(chars[1], chars[1])

    # Pos 2, 3: District digits
    if len(chars) >= 4:
        chars[2] = _TO_DIGIT.get(chars[2], chars[2])
        chars[3] = _TO_DIGIT.get(chars[3], chars[3])

    # Suffix evaluation (Positions 4+)
    remaining = len(chars) - 4
    if remaining == 6:  # e.g. AB1234 -> 2 letters + 4 digits
        chars[4] = _TO_ALPHA.get(chars[4], chars[4])
        chars[5] = _TO_ALPHA.get(chars[5], chars[5])
        for i in range(6, 10):
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])
    elif remaining == 5:  # e.g. A1234 -> 1 letter + 4 digits
        chars[4] = _TO_ALPHA.get(chars[4], chars[4])
        for i in range(5, 9):
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])
    elif remaining == 4:  # e.g. 1234 -> 4 digits
        for i in range(4, 8):
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])
    elif remaining == 7:  # e.g. ABC1234 -> 3 letters + 4 digits
        chars[4] = _TO_ALPHA.get(chars[4], chars[4])
        chars[5] = _TO_ALPHA.get(chars[5], chars[5])
        chars[6] = _TO_ALPHA.get(chars[6], chars[6])
        for i in range(7, 11):
            chars[i] = _TO_DIGIT.get(chars[i], chars[i])

    return "".join(chars)


def normalise_plate(raw_text: str, country: str = "IN") -> Tuple[str, bool]:
    """
    Clean and standardise raw OCR text for number plates.

    Returns
    -------
    Tuple[str, bool]
        (normalised_plate_text, was_modified)
    """
    if not raw_text:
        return "", False

    original = raw_text.strip()
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text)
    cleaned = cleaned.upper()

    if not cleaned:
        return "", False

    if country == "IN":
        cleaned = _apply_confusion_map(cleaned)

    was_modified = (cleaned != original)
    return cleaned, was_modified


class PlateRecognizer:
    """
    Normalises, validates, and evaluates raw OCR output into structured RecognitionResults.
    """

    def __init__(
        self,
        min_ocr_confidence: Optional[float] = None,
        min_confidence: Optional[float] = None,
        min_plate_length: Optional[int] = None,
        min_length: Optional[int] = None,
        max_plate_length: Optional[int] = None,
        max_length: Optional[int] = None,
        country: str = "IN",
        strict_validation: bool = False,
        strict: bool = False,
    ) -> None:
        if min_ocr_confidence is not None:
            self.min_confidence = min_ocr_confidence
        elif min_confidence is not None:
            self.min_confidence = min_confidence
        else:
            self.min_confidence = 0.40

        self.min_length = min_plate_length if min_plate_length is not None else (min_length if min_length is not None else 4)
        self.max_length = max_plate_length if max_plate_length is not None else (max_length if max_length is not None else 15)
        self.country = country
        self.strict = strict or strict_validation

    def recognise(
        self,
        ocr_result: OCRResult,
        strict: Optional[bool] = None,
    ) -> Optional[RecognitionResult]:
        """
        Convert an OCRResult into a normalised RecognitionResult.
        """
        if ocr_result.confidence < self.min_confidence:
            logger.debug(
                "OCR confidence %.2f below threshold %.2f -- discarding",
                ocr_result.confidence,
                self.min_confidence,
            )
            return None

        plate_number, was_norm = normalise_plate(ocr_result.raw_text, country=self.country)

        if len(plate_number) < self.min_length or len(plate_number) > self.max_length:
            logger.debug(
                "Normalised plate '%s' length %d outside [%d, %d] -- discarding",
                plate_number,
                len(plate_number),
                self.min_length,
                self.max_length,
            )
            return None

        use_strict = self.strict if strict is None else strict
        is_valid, reason = validate_indian_plate(plate_number, strict=use_strict)

        if use_strict and not is_valid:
            logger.debug(
                "Plate '%s' rejected by strict Indian plate validation: %s",
                plate_number,
                reason,
            )
            return None

        return RecognitionResult(
            plate_number=plate_number,
            raw_text=ocr_result.raw_text,
            confidence=ocr_result.confidence,
            normalised=was_norm,
            validation_passed=is_valid,
            validation_reason=reason,
        )
