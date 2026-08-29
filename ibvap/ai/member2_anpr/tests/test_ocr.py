"""Tests for the OCR engine module."""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.ocr import BaseOCREngine, MockOCREngine
from ai.member2_anpr.schemas import OCRResult


class TestMockOCREngine:

    def test_read_valid_image_returns_ocr_result(self, valid_frame):
        engine = MockOCREngine()
        result = engine.read(valid_frame)
        assert isinstance(result, OCRResult)

    def test_read_returns_configured_text(self, valid_frame):
        engine = MockOCREngine(mock_text="DL3CAM0001")
        result = engine.read(valid_frame)
        assert result.raw_text == "DL3CAM0001"

    def test_read_returns_configured_confidence(self, valid_frame):
        engine = MockOCREngine(mock_confidence=0.85)
        result = engine.read(valid_frame)
        assert result.confidence == pytest.approx(0.85)

    def test_read_engine_name_is_mock(self, valid_frame):
        engine = MockOCREngine()
        result = engine.read(valid_frame)
        assert result.engine == "mock"

    def test_small_image_returns_empty_text(self):
        engine = MockOCREngine()
        tiny = np.zeros((3, 3, 3), dtype=np.uint8)
        result = engine.read(tiny)
        assert result.raw_text == ""
        assert result.confidence == 0.0

    def test_none_image_raises_value_error(self):
        engine = MockOCREngine()
        with pytest.raises(ValueError, match="None"):
            engine.read(None)

    def test_empty_array_raises_value_error(self):
        engine = MockOCREngine()
        with pytest.raises(ValueError):
            engine.read(np.zeros((0, 0, 3), dtype=np.uint8))

    def test_wrong_type_raises_value_error(self):
        engine = MockOCREngine()
        with pytest.raises(ValueError):
            engine.read("not an image")

    def test_invalid_confidence_raises_value_error(self):
        with pytest.raises(ValueError):
            MockOCREngine(mock_confidence=-0.1)


class TestOCRResult:

    def test_valid_result(self):
        r = OCRResult(raw_text="TN09AB1234", confidence=0.9)
        assert r.raw_text == "TN09AB1234"

    def test_confidence_out_of_range(self):
        with pytest.raises(Exception):
            OCRResult(raw_text="X", confidence=1.5)

    def test_default_engine_is_unknown(self):
        r = OCRResult(raw_text="X", confidence=0.5)
        assert r.engine == "unknown"


def test_base_ocr_engine_is_abstract():
    with pytest.raises(TypeError):
        BaseOCREngine()
