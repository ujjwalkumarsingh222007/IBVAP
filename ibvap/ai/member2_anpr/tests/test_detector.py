"""Tests for the plate detector module."""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.detector import BasePlateDetector, MockPlateDetector
from ai.member2_anpr.schemas import PlateRegion


class TestMockPlateDetector:

    def test_detect_valid_frame_returns_list(self, valid_frame):
        detector = MockPlateDetector()
        results = detector.detect(valid_frame)
        assert isinstance(results, list)

    def test_detect_valid_frame_returns_one_region(self, valid_frame):
        detector = MockPlateDetector()
        results = detector.detect(valid_frame)
        assert len(results) == 1

    def test_detect_returns_plate_region_type(self, valid_frame):
        detector = MockPlateDetector()
        region = detector.detect(valid_frame)[0]
        assert isinstance(region, PlateRegion)

    def test_detect_confidence_within_bounds(self, valid_frame):
        conf = 0.75
        detector = MockPlateDetector(confidence=conf)
        region = detector.detect(valid_frame)[0]
        assert region.confidence == conf

    def test_detect_coordinates_are_non_negative(self, valid_frame):
        detector = MockPlateDetector()
        region = detector.detect(valid_frame)[0]
        assert region.x1 >= 0
        assert region.y1 >= 0
        assert region.x2 >= 0
        assert region.y2 >= 0

    def test_detect_x2_gt_x1(self, valid_frame):
        detector = MockPlateDetector()
        region = detector.detect(valid_frame)[0]
        assert region.x2 > region.x1

    def test_detect_y2_gt_y1(self, valid_frame):
        detector = MockPlateDetector()
        region = detector.detect(valid_frame)[0]
        assert region.y2 > region.y1

    def test_detect_small_frame_returns_empty(self):
        detector = MockPlateDetector()
        tiny = np.zeros((5, 5, 3), dtype=np.uint8)
        assert detector.detect(tiny) == []

    def test_detect_grayscale_frame(self, grayscale_frame):
        detector = MockPlateDetector()
        results = detector.detect(grayscale_frame)
        assert len(results) == 1

    def test_detect_none_frame_raises_value_error(self):
        detector = MockPlateDetector()
        with pytest.raises(ValueError, match="None"):
            detector.detect(None)

    def test_detect_empty_frame_raises_value_error(self, empty_frame):
        detector = MockPlateDetector()
        with pytest.raises(ValueError):
            detector.detect(empty_frame)

    def test_detect_wrong_type_raises_value_error(self):
        detector = MockPlateDetector()
        with pytest.raises(ValueError):
            detector.detect("not a frame")

    def test_invalid_confidence_raises_value_error(self):
        with pytest.raises(ValueError):
            MockPlateDetector(confidence=1.5)


class TestPlateRegion:

    def test_valid_region(self):
        region = PlateRegion(x1=10, y1=20, x2=200, y2=80, confidence=0.9)
        assert region.x1 == 10

    def test_negative_coordinate_raises(self):
        with pytest.raises(Exception):
            PlateRegion(x1=-1, y1=20, x2=200, y2=80, confidence=0.9)

    def test_confidence_out_of_range_raises(self):
        with pytest.raises(Exception):
            PlateRegion(x1=10, y1=20, x2=200, y2=80, confidence=1.5)

    def test_width_property(self):
        region = PlateRegion(x1=10, y1=20, x2=210, y2=80, confidence=0.9)
        assert region.width == 200

    def test_height_property(self):
        region = PlateRegion(x1=10, y1=20, x2=210, y2=80, confidence=0.9)
        assert region.height == 60

    def test_area_property(self):
        region = PlateRegion(x1=10, y1=20, x2=210, y2=80, confidence=0.9)
        assert region.area == 200 * 60


def test_base_detector_is_abstract():
    with pytest.raises(TypeError):
        BasePlateDetector()
