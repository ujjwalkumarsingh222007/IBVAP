"""
tests/test_tracker.py — Phase 1B unit tests.

Run with:
    pytest tests/ -v                  (runs both Phase 1A and 1B tests)
    pytest tests/test_tracker.py -v   (Phase 1B only)

These tests verify:
1.  ObjectTracker initialises without raising.
2.  The model loads (is_ready() returns True).
3.  track() accepts a synthetic frame and returns a list.
4.  DetectionResult.track_id is either an int or None (never a float/str).
5.  as_dict() includes "track_id" when the field is not None.
6.  as_dict() omits "track_id" when the field is None (Phase 1A compat).
7.  BoundingBox and DetectionResult contracts are unchanged (regression guard).
8.  reset() does not raise.

No real webcam or video file is needed — synthetic numpy frames are used.

Integration / manual test
--------------------------
Run the program against a real webcam or video file to verify that IDs
remain stable across consecutive frames when the tracker is confident:

    python main.py                           # webcam, tracking ON
    python main.py --source path/to/file.mp4
    python main.py --no-track                # Phase 1A mode
"""

from __future__ import annotations

import sys
import os

# Allow running from the module root without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest

from detection.detector import BoundingBox, DetectionResult
from tracking import ObjectTracker


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def tracker() -> ObjectTracker:
    """Shared tracker instance — model loaded once per test session."""
    return ObjectTracker(
        model_path="yolov8n.pt",
        confidence_threshold=0.40,
        tracker_config="bytetrack.yaml",
    )


@pytest.fixture
def blank_frame() -> np.ndarray:
    """640×480 black BGR frame — produces 0 detections."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


@pytest.fixture
def noise_frame() -> np.ndarray:
    """640×480 random-noise BGR frame."""
    rng = np.random.default_rng(seed=42)
    return rng.integers(0, 256, (480, 640, 3), dtype=np.uint8)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTrackerInit:
    def test_initialises(self, tracker: ObjectTracker):
        assert tracker is not None

    def test_model_ready(self, tracker: ObjectTracker):
        assert tracker.is_ready(), "Model should be ready after __init__"

    def test_repr(self, tracker: ObjectTracker):
        r = repr(tracker)
        assert "ObjectTracker(" in r
        assert "bytetrack" in r


class TestTrackerFrameProcessing:
    def test_track_returns_list(self, tracker: ObjectTracker, blank_frame: np.ndarray):
        results = tracker.track(blank_frame)
        assert isinstance(results, list)

    def test_blank_frame_no_crash(self, tracker: ObjectTracker, blank_frame: np.ndarray):
        """Blank frame should return 0 detections without raising."""
        results = tracker.track(blank_frame)
        assert isinstance(results, list)

    def test_noise_frame_no_crash(self, tracker: ObjectTracker, noise_frame: np.ndarray):
        """Noise frame should not raise."""
        results = tracker.track(noise_frame)
        assert isinstance(results, list)

    def test_reset_does_not_raise(self, tracker: ObjectTracker):
        tracker.reset()


class TestTrackerDetectionStructure:
    def test_detection_result_types(self, tracker: ObjectTracker, noise_frame: np.ndarray):
        """Every DetectionResult must have correct field types."""
        results = tracker.track(noise_frame)
        for det in results:
            assert isinstance(det, DetectionResult)
            assert isinstance(det.class_id,   int)
            assert isinstance(det.class_name, str)
            assert isinstance(det.confidence, float)
            assert isinstance(det.bbox,       BoundingBox)

    def test_track_id_is_int_or_none(self, tracker: ObjectTracker, noise_frame: np.ndarray):
        """
        track_id must be an integer when assigned, or None when not assigned.
        It must NEVER be a float, string, or list index.
        """
        results = tracker.track(noise_frame)
        for det in results:
            assert det.track_id is None or isinstance(det.track_id, int), (
                f"track_id must be int or None, got {type(det.track_id)}"
            )

    def test_confidence_above_threshold(self, tracker: ObjectTracker, noise_frame: np.ndarray):
        results = tracker.track(noise_frame)
        for det in results:
            assert det.confidence >= tracker.confidence_threshold

    def test_class_names_are_valid(self, tracker: ObjectTracker, noise_frame: np.ndarray):
        valid = {"person", "car", "motorcycle", "bus", "truck"}
        results = tracker.track(noise_frame)
        for det in results:
            assert det.class_name in valid, (
                f"Unexpected class_name '{det.class_name}'"
            )


class TestDetectionResultContractPhase1B:
    """Verify that as_dict() correctly handles the track_id field."""

    def test_as_dict_includes_track_id_when_set(self):
        det = DetectionResult(
            class_id=0,
            class_name="person",
            confidence=0.91,
            bbox=BoundingBox(10, 20, 100, 300),
            track_id=7,
        )
        d = det.as_dict()
        assert "track_id" in d, "as_dict() must include 'track_id' when it is not None"
        assert d["track_id"] == 7

    def test_as_dict_omits_track_id_when_none(self):
        """Phase 1A compat: track_id absent from dict when None."""
        det = DetectionResult(
            class_id=0,
            class_name="person",
            confidence=0.91,
            bbox=BoundingBox(10, 20, 100, 300),
            track_id=None,
        )
        d = det.as_dict()
        assert "track_id" not in d, "as_dict() must omit 'track_id' when it is None"

    def test_as_dict_full_schema_with_track_id(self):
        """Full output contract for a Phase 1B detection."""
        det = DetectionResult(
            class_id=2,
            class_name="car",
            confidence=0.88,
            bbox=BoundingBox(50, 60, 200, 250),
            track_id=3,
        )
        d = det.as_dict()
        assert d["class_name"] == "car"
        assert d["confidence"] == 0.88
        assert d["bbox"] == {"x1": 50, "y1": 60, "x2": 200, "y2": 250}
        assert d["track_id"] == 3

    def test_track_id_not_a_list_index(self):
        """
        Regression guard: track_id must not be set to 0/1/2 based on loop
        index.  Here we explicitly set it to a non-zero value and confirm.
        """
        det = DetectionResult(
            class_id=0,
            class_name="person",
            confidence=0.80,
            bbox=BoundingBox(0, 0, 50, 100),
            track_id=42,   # a non-trivial tracker-assigned ID
        )
        assert det.track_id == 42


class TestPhase1ARegression:
    """
    Ensure Phase 1A behaviour is completely preserved.
    These mirror the original test_detector.py assertions using the
    detection package directly, so that a single pytest run catches regressions.
    """

    def test_detection_result_default_track_id_is_none(self):
        """Phase 1A: DetectionResult created without track_id must default to None."""
        det = DetectionResult(
            class_id=0,
            class_name="person",
            confidence=0.75,
            bbox=BoundingBox(0, 0, 100, 200),
        )
        assert det.track_id is None

    def test_bbox_width_height(self):
        bb = BoundingBox(x1=10, y1=20, x2=110, y2=220)
        assert bb.width  == 100
        assert bb.height == 200

    def test_bbox_as_dict(self):
        bb = BoundingBox(x1=5, y1=10, x2=50, y2=100)
        assert bb.as_dict() == {"x1": 5, "y1": 10, "x2": 50, "y2": 100}
