"""Tests for the plate recognizer / normalisation module."""

from __future__ import annotations

import pytest

from ai.member2_anpr.recognizer import PlateRecognizer, normalise_plate
from ai.member2_anpr.schemas import OCRResult, RecognitionResult


class TestNormalisePlate:

    def test_removes_spaces(self):
        result, _ = normalise_plate("TN 09 AB 1234")
        assert " " not in result

    def test_converts_to_uppercase(self):
        result, _ = normalise_plate("tn09ab1234")
        assert result == result.upper()

    def test_removes_hyphens(self):
        result, _ = normalise_plate("TN-09-AB-1234")
        assert "-" not in result

    def test_standard_indian_plate(self):
        result, _ = normalise_plate("TN 09 AB 1234")
        assert result == "TN09AB1234"

    def test_already_clean_plate(self):
        result, _ = normalise_plate("MH12DE1433")
        assert result == "MH12DE1433"

    def test_empty_string_returns_empty(self):
        result, was_normalised = normalise_plate("")
        assert result == ""
        assert was_normalised is False

    def test_whitespace_only_returns_empty(self):
        result, _ = normalise_plate("   ")
        assert result == ""

    def test_removes_special_characters(self):
        result, _ = normalise_plate("TN$09#AB@1234!")
        assert result == "TN09AB1234"


class TestPlateRecognizer:

    def _ocr(self, text: str, conf: float = 0.91) -> OCRResult:
        return OCRResult(raw_text=text, confidence=conf)

    def test_recognise_returns_recognition_result(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("TN 09 AB 1234"))
        assert isinstance(result, RecognitionResult)

    def test_recognise_normalises_text(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("TN 09 AB 1234"))
        assert result is not None
        assert result.plate_number == "TN09AB1234"

    def test_recognise_preserves_raw_text(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("TN 09 AB 1234"))
        assert result is not None
        assert result.raw_text == "TN 09 AB 1234"

    def test_recognise_confidence_matches_ocr(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("TN09AB1234", conf=0.88))
        assert result is not None
        assert result.confidence == pytest.approx(0.88)

    def test_low_confidence_returns_none(self):
        recognizer = PlateRecognizer(min_ocr_confidence=0.50)
        result = recognizer.recognise(self._ocr("TN09AB1234", conf=0.20))
        assert result is None

    def test_too_short_returns_none(self):
        recognizer = PlateRecognizer(min_plate_length=6)
        result = recognizer.recognise(self._ocr("AB12", conf=0.90))
        assert result is None

    def test_too_long_returns_none(self):
        recognizer = PlateRecognizer(max_plate_length=8)
        result = recognizer.recognise(self._ocr("ABCDEFGHIJKLMN", conf=0.90))
        assert result is None

    def test_bh_series_plate(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("22 BH 1234 AA"))
        assert result is not None
        assert " " not in result.plate_number

    def test_normalised_flag(self):
        recognizer = PlateRecognizer()
        result = recognizer.recognise(self._ocr("TN 09 AB 1234"))
        assert result is not None
        assert result.normalised is True
