"""
Tests for the image preprocessing module.

Covers:
  - Resizing to target width
  - Grayscale conversion
  - CLAHE contrast enhancement
  - Binarization / Thresholding
  - Handling of small/empty/invalid images
  - get_variants output
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from ai.member2_anpr.preprocessing import PlatePreprocessor


class TestPlatePreprocessor:

    def test_preprocess_standard_bgr_crop(self, valid_frame):
        preprocessor = PlatePreprocessor(target_width=320)
        crop = valid_frame[100:200, 100:400]
        out = preprocessor.preprocess(crop)

        assert out is not None
        assert isinstance(out, np.ndarray)
        assert out.shape[1] == 320  # width scaled
        assert out.ndim == 2        # grayscale/binary

    def test_preprocess_grayscale_crop(self, grayscale_frame):
        preprocessor = PlatePreprocessor(target_width=300)
        crop = grayscale_frame[50:150, 50:250]
        out = preprocessor.preprocess(crop)

        assert out.shape[1] == 300
        assert out.ndim == 2

    def test_get_variants_returns_two_images(self, valid_frame):
        preprocessor = PlatePreprocessor(target_width=320)
        crop = valid_frame[100:200, 100:350]
        gray, binary = preprocessor.get_variants(crop)

        assert gray.shape[1] == 320
        assert binary.shape[1] == 320
        assert gray.ndim == 2
        assert binary.ndim == 2

    def test_preprocess_empty_image_raises_value_error(self):
        preprocessor = PlatePreprocessor()
        with pytest.raises(ValueError, match="empty or None"):
            preprocessor.preprocess(np.zeros((0, 0, 3), dtype=np.uint8))

    def test_preprocess_none_raises_value_error(self):
        preprocessor = PlatePreprocessor()
        with pytest.raises(ValueError, match="empty or None"):
            preprocessor.preprocess(None)

    def test_preprocess_tiny_crop_raises_value_error(self):
        preprocessor = PlatePreprocessor()
        tiny = np.zeros((3, 3, 3), dtype=np.uint8)
        with pytest.raises(ValueError, match="too small"):
            preprocessor.preprocess(tiny)

    def test_custom_settings(self, valid_frame):
        preprocessor = PlatePreprocessor(target_width=200, apply_clahe=False, apply_threshold=False)
        crop = valid_frame[100:180, 100:300]
        out = preprocessor.preprocess(crop)

        assert out.shape[1] == 200
