"""
Tests for ANPRConfig validation and environment overrides.
"""

from __future__ import annotations

import pytest

from ai.member2_anpr.config import ANPRConfig


class TestANPRConfig:

    def test_default_config_valid(self):
        cfg = ANPRConfig()
        cfg.validate()
        assert cfg.detector_confidence_threshold == 0.40
        assert cfg.ocr_confidence_threshold == 0.40
        assert cfg.preprocess_target_width == 320
        assert cfg.duplicate_suppression_enabled is True
        assert cfg.duplicate_suppression_window_seconds == 10.0

    def test_invalid_detector_confidence_raises(self):
        cfg = ANPRConfig(detector_confidence_threshold=1.5)
        with pytest.raises(ValueError, match="detector_confidence_threshold"):
            cfg.validate()

    def test_invalid_ocr_confidence_raises(self):
        cfg = ANPRConfig(ocr_confidence_threshold=-0.1)
        with pytest.raises(ValueError, match="ocr_confidence_threshold"):
            cfg.validate()

    def test_invalid_preprocess_width_raises(self):
        cfg = ANPRConfig(preprocess_target_width=10)
        with pytest.raises(ValueError, match="preprocess_target_width"):
            cfg.validate()

    def test_invalid_suppression_window_raises(self):
        cfg = ANPRConfig(duplicate_suppression_window_seconds=-1.0)
        with pytest.raises(ValueError, match="duplicate_suppression_window_seconds"):
            cfg.validate()

    def test_empty_languages_raises(self):
        cfg = ANPRConfig(ocr_languages=[])
        with pytest.raises(ValueError, match="ocr_languages"):
            cfg.validate()
