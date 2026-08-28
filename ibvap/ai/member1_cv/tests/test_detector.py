"""
tests/test_detector.py — Phase 1A unit tests.

Run with:
    python -m pytest tests/ -v
    # or from the module root:
    pytest ai/member1_cv/tests/ -v

These tests verify:
1.  Detector initialises without raising.
2.  The model loads (is_ready() returns True).
3.  A synthetic frame can be processed.
4.  Every returned detection has the expected structure / types.
5.  Detections below the confidence threshold are absent.
6.  BoundingBox width/height properties work correctly.
7.  DetectionResult.as_dict() matches the output contract.

No real video stream is needed — all tests use synthetic numpy frames.
"""

from __future__ import annotations

import sys
import os

# Allow running from the module root without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest

from detection import Detector, DetectionResult
from detection.detector import BoundingBox


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def detector() -> Detector:
    """Shared detector instance — model is loaded once per test session."""
    return Detector(model_path="yolov8n.pt", confidence_threshold=0.40)


@pytest.fixture
def blank_frame() -> np.ndarray:
    """640×480 black BGR frame — unlikely to produce any detections."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


@pytest.fixture
def noise_frame() -> np.ndarray:
    """640×480 random-noise BGR frame."""
    rng = np.random.default_rng(seed=42)
    return rng.integers(0, 256, (480, 640, 3), dtype=np.uint8)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDetectorInit:
    def test_initialises(self, detector: Detector):
        assert detector is not None

    def test_model_ready(self, detector: Detector):
        assert detector.is_ready(), "Model should be ready after __init__"

    def test_repr(self, detector: Detector):
        r = repr(detector)
        assert "Detector(" in r
        assert "yolov8n" in r


class TestFrameProcessing:
    def test_detect_returns_list(self, detector: Detector, blank_frame: np.ndarray):
        results = detector.detect(blank_frame)
        assert isinstance(results, list)

    def test_blank_frame_no_crash(self, detector: Detector, blank_frame: np.ndarray):
        """A blank frame should return 0 detections without raising."""
        results = detector.detect(blank_frame)
        assert isinstance(results, list)

    def test_noise_frame_no_crash(self, detector: Detector, noise_frame: np.ndarray):
        """Random-noise frame should not raise."""
        results = detector.detect(noise_frame)
        assert isinstance(results, list)


class TestDetectionStructure:
    def test_detection_result_fields(self, detector: Detector, noise_frame: np.ndarray):
        """Every DetectionResult must have the required fields with correct types."""
        results = detector.detect(noise_frame)
        for det in results:
            assert isinstance(det, DetectionResult)
            assert isinstance(det.class_id,   int)
            assert isinstance(det.class_name, str)
            assert isinstance(det.confidence, float)
            assert isinstance(det.bbox,       BoundingBox)
            assert det.track_id is None, "track_id must be None in Phase 1A"

    def test_confidence_above_threshold(self, detector: Detector, noise_frame: np.ndarray):
        results = detector.detect(noise_frame)
        for det in results:
            assert det.confidence >= detector.confidence_threshold, (
                f"Confidence {det.confidence} is below threshold "
                f"{detector.confidence_threshold}"
            )

    def test_as_dict_schema(self, detector: Detector, noise_frame: np.ndarray):
        """as_dict() must contain exactly the keys in the output contract."""
        results = detector.detect(noise_frame)
        for det in results:
            d = det.as_dict()
            assert "class_name"  in d
            assert "confidence"  in d
            assert "bbox"        in d
            bbox = d["bbox"]
            for key in ("x1", "y1", "x2", "y2"):
                assert key in bbox, f"bbox missing key '{key}'"

    def test_class_names_are_valid(self, detector: Detector, noise_frame: np.ndarray):
        valid = {"person", "car", "motorcycle", "bus", "truck"}
        results = detector.detect(noise_frame)
        for det in results:
            assert det.class_name in valid, (
                f"Unexpected class_name '{det.class_name}'"
            )


class TestBoundingBox:
    def test_width_height(self):
        bb = BoundingBox(x1=10, y1=20, x2=110, y2=220)
        assert bb.width  == 100
        assert bb.height == 200

    def test_as_dict(self):
        bb = BoundingBox(x1=5, y1=10, x2=50, y2=100)
        d  = bb.as_dict()
        assert d == {"x1": 5, "y1": 10, "x2": 50, "y2": 100}


class TestDrawDetections:
    def test_draw_does_not_raise(self, blank_frame: np.ndarray):
        dets = [
            DetectionResult(
                class_id=0,
                class_name="person",
                confidence=0.90,
                bbox=BoundingBox(50, 50, 200, 400),
            )
        ]
        result = Detector.draw_detections(blank_frame.copy(), dets)
        assert result.shape == blank_frame.shape
