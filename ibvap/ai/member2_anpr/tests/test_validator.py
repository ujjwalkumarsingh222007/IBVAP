"""
Tests for ANPRValidator, ValidationReport, and ValidationResult (validator.py).
"""

from __future__ import annotations

import os
import tempfile
import cv2
import numpy as np
import pytest

from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.validator import ANPRValidator, ValidationReport, ValidationResult


class TestValidationDataModels:

    def test_validation_result_to_dict(self):
        res = ValidationResult(
            source_name="img1.jpg",
            plate_number="TN09AB1234",
            plate_confidence=0.95,
            ocr_confidence=0.92,
            validation_passed=True,
            ground_truth="TN09AB1234",
            is_correct=True,
            total_ms=12.5,
        )
        d = res.to_dict()
        assert d["source_name"] == "img1.jpg"
        assert d["is_correct"] is True
        assert d["total_ms"] == 12.5

    def test_validation_report_summary_table(self):
        report = ValidationReport(
            total_samples=10,
            successful_detections=9,
            failed_detections=1,
            validation_passed_count=9,
            ground_truth_evaluated=10,
            ground_truth_matches=9,
            accuracy_percentage=90.0,
            detection_rate_percentage=90.0,
            total_elapsed_sec=0.25,
            throughput_fps=40.0,
            mean_detector_ms=1.5,
            mean_preprocessor_ms=0.8,
            mean_ocr_ms=2.1,
            mean_recognizer_ms=0.4,
            mean_total_ms=4.8,
            median_total_ms=4.7,
            min_total_ms=3.2,
            max_total_ms=6.5,
        )
        table = report.summary_table()
        assert "Real-Model Validation & Performance Report" in table
        assert "90.0%" in table
        assert "40.00 FPS" in table
        assert "Component Mean Latency Breakdown" in table

    def test_validation_report_to_json(self):
        report = ValidationReport(total_samples=5, successful_detections=5)
        json_str = report.to_json()
        assert '"total_samples": 5' in json_str


class TestANPRValidator:

    @pytest.fixture
    def mock_validator(self):
        pipeline = ANPRPipeline(ocr_engine=MockOCREngine(mock_text="TN09AB1234"))
        return ANPRValidator(pipeline=pipeline)

    def test_validate_image_array_with_ground_truth(self, mock_validator, valid_frame):
        res = mock_validator.validate_image(
            image_input=valid_frame,
            ground_truth="TN 09 AB 1234",
            source_name="synthetic_frame",
        )
        assert res.plate_number == "TN09AB1234"
        assert res.is_correct is True
        assert res.validation_passed is True
        assert res.total_ms > 0
        assert res.detector_ms > 0
        assert res.ocr_ms > 0

    def test_validate_image_array_mismatch_ground_truth(self, mock_validator, valid_frame):
        res = mock_validator.validate_image(
            image_input=valid_frame,
            ground_truth="DL01AB9999",
            source_name="synthetic_frame",
        )
        assert res.plate_number == "TN09AB1234"
        assert res.is_correct is False

    def test_validate_nonexistent_image_file_returns_error(self, mock_validator):
        res = mock_validator.validate_image(image_input="non_existent_image_12345.jpg")
        assert res.error is not None
        assert "not found" in res.error

    def test_validate_directory_with_temp_images(self, mock_validator):
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Create 3 dummy image files
            for i in range(3):
                img = np.full((100, 100, 3), (i * 50) % 255, dtype=np.uint8)
                cv2.imwrite(os.path.join(tmp_dir, f"sample_{i}.png"), img)

            gt_map = {
                "sample_0.png": "TN09AB1234",
                "sample_1.png": "TN09AB1234",
                "sample_2.png": "MH12DE1433",  # Will mismatch mock text
            }

            report = mock_validator.validate_directory(
                dir_path=tmp_dir,
                ground_truth_map=gt_map,
            )

            assert report.total_samples == 3
            assert report.successful_detections == 3
            assert report.ground_truth_evaluated == 3
            assert report.ground_truth_matches == 2  # 2 match, 1 mismatch
            assert report.accuracy_percentage == pytest.approx(66.67, rel=1e-2)
            assert report.throughput_fps > 0

    def test_validate_empty_directory_returns_empty_report(self, mock_validator):
        with tempfile.TemporaryDirectory() as tmp_dir:
            report = mock_validator.validate_directory(dir_path=tmp_dir)
            assert report.total_samples == 0

    def test_validate_nonexistent_directory_raises(self, mock_validator):
        with pytest.raises(FileNotFoundError):
            mock_validator.validate_directory(dir_path="invalid_dir_99999")
