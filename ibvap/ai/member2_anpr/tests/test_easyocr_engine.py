"""
Tests for EasyOCREngine with mock reader instances.
"""

from __future__ import annotations

from unittest.mock import MagicMock
import numpy as np
import pytest

from ai.member2_anpr.ocr import EasyOCREngine
from ai.member2_anpr.schemas import OCRResult


class MockReader:
    def __init__(self, return_values=None):
        # return_values format: [ (bbox, text, conf), ... ]
        self.return_values = return_values if return_values is not None else [
            ([[0, 0], [100, 0], [100, 30], [0, 30]], "TN09AB1234", 0.94)
        ]

    def readtext(self, img, detail=1, paragraph=False):
        return self.return_values


class TestEasyOCREngine:

    def test_read_valid_crop(self, valid_frame):
        reader = MockReader([
            ([[0, 0], [100, 0], [100, 30], [0, 30]], "TN09AB1234", 0.92)
        ])
        engine = EasyOCREngine(reader_instance=reader)
        crop = valid_frame[50:100, 50:200]

        result = engine.read(crop)
        assert isinstance(result, OCRResult)
        assert "TN09AB1234" in result.raw_text
        assert result.confidence > 0.8
        assert result.engine == "easyocr"

    def test_read_multi_part_text(self, valid_frame):
        reader = MockReader([
            ([[0, 0], [40, 0], [40, 30], [0, 30]], "MH12", 0.90),
            ([[50, 0], [100, 0], [100, 30], [50, 30]], "DE1433", 0.94),
        ])
        engine = EasyOCREngine(reader_instance=reader)
        crop = valid_frame[50:100, 50:200]

        result = engine.read(crop)
        assert result.raw_text == "MH12 DE1433"
        assert result.confidence == pytest.approx(0.92, abs=1e-2)

    def test_read_empty_results(self, valid_frame):
        reader = MockReader(return_values=[])
        engine = EasyOCREngine(reader_instance=reader)
        crop = valid_frame[50:100, 50:200]

        result = engine.read(crop)
        assert result.raw_text == ""
        assert result.confidence == 0.0

    def test_read_tiny_crop(self):
        reader = MockReader()
        engine = EasyOCREngine(reader_instance=reader)
        tiny = np.zeros((3, 3, 3), dtype=np.uint8)

        result = engine.read(tiny)
        assert result.raw_text == ""
        assert result.confidence == 0.0

    def test_read_invalid_input(self):
        reader = MockReader()
        engine = EasyOCREngine(reader_instance=reader)

        with pytest.raises(ValueError):
            engine.read(None)
