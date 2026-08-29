"""
Tests for production hardening, state code validation, strict mode, error resilience, and secure logging.
"""

from __future__ import annotations

import logging
import pytest

from ai.member2_anpr.config import ANPRConfig
from ai.member2_anpr.detector import YOLOPlateDetector
from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.recognizer import (
    INDIAN_STATE_CODES,
    PlateRecognizer,
    validate_indian_plate,
)
from ai.member2_anpr.schemas import OCRResult
from ai.member2_anpr.stream import mask_rtsp_url


class TestIndianStateCodeValidation:

    def test_all_standard_state_codes_recognized(self):
        assert "DL" in INDIAN_STATE_CODES
        assert "MH" in INDIAN_STATE_CODES
        assert "TN" in INDIAN_STATE_CODES
        assert "KA" in INDIAN_STATE_CODES
        assert "HR" in INDIAN_STATE_CODES
        assert "UP" in INDIAN_STATE_CODES
        assert "GJ" in INDIAN_STATE_CODES
        assert "WB" in INDIAN_STATE_CODES

    def test_valid_state_plates_pass_validation(self):
        valid_plates = ["DL01AB1234", "MH12DE1433", "TN09AB1234", "KA05MH2020", "HR26DK8337"]
        for p in valid_plates:
            is_valid, reason = validate_indian_plate(p, strict=True)
            assert is_valid is True, f"Plate {p} should be valid"
            assert "Standard" in reason

    def test_invalid_state_code_rejected_in_strict_mode(self):
        # ZZ is not a valid Indian state
        is_valid, reason = validate_indian_plate("ZZ01AB1234", strict=True)
        assert is_valid is False
        assert "Invalid State/UT Code" in reason

    def test_invalid_state_code_accepted_in_lenient_mode(self):
        is_valid, reason = validate_indian_plate("ZZ01AB1234", strict=False)
        assert is_valid is True
        assert "Unverified State" in reason

    def test_bharat_series_valid_in_strict_mode(self):
        is_valid, reason = validate_indian_plate("22BH1234AA", strict=True)
        assert is_valid is True
        assert "Bharat" in reason

    def test_strict_recognizer_rejects_invalid_state_plate(self):
        recognizer = PlateRecognizer(strict=True)
        ocr_res = OCRResult(raw_text="ZZ01AB1234", confidence=0.90)
        res = recognizer.recognise(ocr_res)
        assert res is None  # Discarded by strict validation


class TestProductionErrorResilience:

    def test_missing_model_weights_raises_filenotfound(self):
        with pytest.raises(FileNotFoundError, match="weights not found"):
            YOLOPlateDetector(model_path="non_existent_weights_path.pt")

    def test_secure_logging_credential_masking(self):
        url = "rtsp://user:mySecretPassword123@camera.border.gov.in:554/live"
        masked = mask_rtsp_url(url)
        assert "mySecretPassword123" not in masked
        assert masked == "rtsp://user:***@camera.border.gov.in:554/live"

    def test_config_min_plate_confidence_validation(self):
        cfg = ANPRConfig(min_plate_confidence=0.50)
        cfg.validate()
        assert cfg.min_plate_confidence == 0.50

        with pytest.raises(ValueError, match="min_plate_confidence"):
            bad_cfg = ANPRConfig(min_plate_confidence=1.5)
            bad_cfg.validate()
