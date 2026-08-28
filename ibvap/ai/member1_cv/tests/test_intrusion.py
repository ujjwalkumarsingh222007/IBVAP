"""
tests/test_intrusion.py — Phase 1C unit tests.

Run with:
    pytest tests/ -v                      # all phases
    pytest tests/test_intrusion.py -v     # Phase 1C only

Coverage
--------
1.  Point inside polygon.
2.  Point outside polygon.
3.  Point on boundary treated as inside.
4.  Bounding-box centre calculation.
5.  Object outside fence: no intrusion event.
6.  Object entering fence: exactly ONE event on the entry frame.
7.  Object remaining inside: no repeated events on subsequent frames.
8.  Object leaving and re-entering: new event on re-entry.
9.  Detections without track_id are skipped gracefully.
10. Multiple track IDs maintain fully independent states.
11. Two objects crossing simultaneously each generate an event.
12. IntrusionEvent contains track_id.
13. IntrusionEvent contains class_name.
14. IntrusionEvent contains confidence.
15. IntrusionEvent contains bounding box.
16. IntrusionEvent.as_dict() is complete and JSON-serialisable.
17. VirtualFence requires at least 3 vertices.
18. IntrusionDetector.reset() clears state.
19. is_inside() returns False for unknown track IDs.
20. ZoneState transitions work correctly.

No webcam, no video file, no YOLO model required.
All tests are purely in-memory and deterministic.
"""

from __future__ import annotations

import json
import sys
import os

# Allow running from the module root without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest

from detection.detector import BoundingBox, DetectionResult
from intrusion.fence import VirtualFence, DEFAULT_FENCE_POLYGON
from intrusion.detector import IntrusionDetector, IntrusionEvent, ZoneState


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# A simple rectangular fence for deterministic tests
FENCE_POLY = [(100, 100), (500, 100), (500, 400), (100, 400)]


@pytest.fixture
def fence() -> VirtualFence:
    return VirtualFence(FENCE_POLY)


@pytest.fixture
def intr(fence: VirtualFence) -> IntrusionDetector:
    return IntrusionDetector(fence)


def _make_det(
    track_id: int | None,
    x1: int, y1: int, x2: int, y2: int,
    class_name: str = "person",
    confidence: float = 0.90,
) -> DetectionResult:
    """Helper: create a DetectionResult with the given bounding box."""
    return DetectionResult(
        class_id=0,
        class_name=class_name,
        confidence=confidence,
        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
        track_id=track_id,
    )


# ---------------------------------------------------------------------------
# 1. Geometry tests — VirtualFence
# ---------------------------------------------------------------------------

class TestVirtualFenceGeometry:
    def test_point_inside_polygon(self, fence: VirtualFence):
        """Centre of the fence polygon must report as inside."""
        assert fence.contains_point((300, 250)) is True

    def test_point_outside_polygon(self, fence: VirtualFence):
        """A clearly external point must report as outside."""
        assert fence.contains_point((10, 10)) is False

    def test_point_on_boundary_is_inside(self, fence: VirtualFence):
        """OpenCV pointPolygonTest returns ≥0 for boundary; we treat as inside."""
        # Top edge: y=100, x between 100 and 500
        assert fence.contains_point((300, 100)) is True

    def test_point_just_outside_top_edge(self, fence: VirtualFence):
        assert fence.contains_point((300, 99)) is False

    def test_corner_point_is_inside(self, fence: VirtualFence):
        assert fence.contains_point((100, 100)) is True

    def test_far_outside(self, fence: VirtualFence):
        assert fence.contains_point((9999, 9999)) is False

    def test_minimum_three_vertices(self):
        """VirtualFence must accept exactly 3 vertices."""
        f = VirtualFence([(0, 0), (100, 0), (50, 100)])
        assert f.contains_point((50, 50)) is True

    def test_fewer_than_three_raises(self):
        with pytest.raises(ValueError, match="at least 3"):
            VirtualFence([(0, 0), (100, 0)])

    def test_polygon_property_returns_copy(self, fence: VirtualFence):
        poly = fence.polygon
        assert poly == FENCE_POLY
        # Mutating the copy must not affect the fence
        poly.append((999, 999))
        assert fence.polygon == FENCE_POLY


class TestBboxCenter:
    def test_centre_symmetric_box(self):
        cx, cy = VirtualFence.bbox_center(100, 100, 200, 300)
        assert cx == 150
        assert cy == 200

    def test_centre_zero_box(self):
        cx, cy = VirtualFence.bbox_center(0, 0, 0, 0)
        assert cx == 0
        assert cy == 0

    def test_centre_large_box(self):
        cx, cy = VirtualFence.bbox_center(0, 0, 640, 480)
        assert cx == 320
        assert cy == 240


# ---------------------------------------------------------------------------
# 2. Intrusion detection state machine
# ---------------------------------------------------------------------------

class TestIntrusionDetector:
    def test_outside_no_event(self, intr: IntrusionDetector):
        """Object outside fence → no event."""
        # Bounding box centre at (20, 20) — outside FENCE_POLY
        det = _make_det(track_id=1, x1=10, y1=10, x2=30, y2=30)
        events = intr.process([det])
        assert events == []

    def test_entry_generates_exactly_one_event(self, intr: IntrusionDetector):
        """
        Object transitions from outside to inside — exactly one event on the
        frame of entry, nothing on subsequent frames while it stays inside.
        """
        # Frame A: outside
        det_out = _make_det(track_id=7, x1=10, y1=10, x2=30, y2=30)
        events_a = intr.process([det_out])
        assert events_a == [], "No event while outside"

        # Frame B: inside (centre at 300, 250)
        det_in = _make_det(track_id=7, x1=250, y1=200, x2=350, y2=300)
        events_b = intr.process([det_in])
        assert len(events_b) == 1, "Exactly one event on entry"
        assert events_b[0].track_id == 7

        # Frame C: still inside — no new event
        events_c = intr.process([det_in])
        assert events_c == [], "No event while already inside"

        # Frame D: still inside — no new event
        events_d = intr.process([det_in])
        assert events_d == [], "Still no event"

    def test_no_event_on_repeated_inside_frames(self, intr: IntrusionDetector):
        """Simulate 10 consecutive frames inside — must produce exactly 1 total event."""
        # Seed: outside first
        intr.process([_make_det(track_id=2, x1=0, y1=0, x2=20, y2=20)])

        det_in = _make_det(track_id=2, x1=200, y1=150, x2=400, y2=350)
        all_events = []
        for _ in range(10):
            all_events.extend(intr.process([det_in]))

        assert len(all_events) == 1, "Only one event for 10 consecutive inside frames"

    def test_exit_and_reentry_generates_new_event(self, intr: IntrusionDetector):
        """Object leaves then re-enters → second intrusion event generated."""
        # Outside
        intr.process([_make_det(track_id=3, x1=0, y1=0, x2=20, y2=20)])

        # Enter
        det_in = _make_det(track_id=3, x1=200, y1=150, x2=400, y2=350)
        ev1 = intr.process([det_in])
        assert len(ev1) == 1, "First entry event"

        # Exit
        intr.process([_make_det(track_id=3, x1=0, y1=0, x2=20, y2=20)])

        # Re-enter
        ev2 = intr.process([det_in])
        assert len(ev2) == 1, "Re-entry event"
        assert ev2[0].track_id == 3

    def test_independent_track_states(self, intr: IntrusionDetector):
        """
        Track ID 1 entering the fence must not affect Track ID 2's state.
        """
        det1_out = _make_det(track_id=1, x1=0,   y1=0,   x2=20,  y2=20)
        det2_out = _make_det(track_id=2, x1=600, y1=600, x2=620, y2=620)

        intr.process([det1_out, det2_out])

        # Only ID 1 enters
        det1_in = _make_det(track_id=1, x1=200, y1=150, x2=400, y2=350)
        events = intr.process([det1_in, det2_out])

        assert len(events) == 1
        assert events[0].track_id == 1

        # ID 2 state must still be OUTSIDE
        assert intr.get_state(2) == ZoneState.OUTSIDE
        assert intr.is_inside(2) is False

    def test_two_objects_cross_simultaneously(self, intr: IntrusionDetector):
        """Both IDs entering at the same frame → two events."""
        # Seed both as outside
        intr.process([
            _make_det(track_id=10, x1=0, y1=0, x2=20, y2=20),
            _make_det(track_id=11, x1=0, y1=0, x2=20, y2=20),
        ])
        # Both enter
        events = intr.process([
            _make_det(track_id=10, x1=200, y1=150, x2=400, y2=350),
            _make_det(track_id=11, x1=220, y1=160, x2=420, y2=360),
        ])
        assert len(events) == 2
        ids = {e.track_id for e in events}
        assert ids == {10, 11}

    def test_none_track_id_skipped(self, intr: IntrusionDetector):
        """Detection without track_id must be silently skipped."""
        det = _make_det(track_id=None, x1=200, y1=150, x2=400, y2=350)
        events = intr.process([det])
        assert events == []

    def test_empty_detection_list(self, intr: IntrusionDetector):
        """process() on an empty list must return empty list without crashing."""
        events = intr.process([])
        assert events == []

    def test_is_inside_unknown_id_returns_false(self, intr: IntrusionDetector):
        """Unseen track ID should default to not-inside."""
        assert intr.is_inside(999) is False

    def test_get_state_unknown_id_returns_none(self, intr: IntrusionDetector):
        assert intr.get_state(999) is None

    def test_reset_clears_state(self, intr: IntrusionDetector):
        # Put ID 5 inside
        intr.process([_make_det(track_id=5, x1=0, y1=0, x2=20, y2=20)])
        intr.process([_make_det(track_id=5, x1=200, y1=150, x2=400, y2=350)])
        assert intr.is_inside(5) is True

        intr.reset()
        assert intr.get_state(5) is None
        assert intr.is_inside(5) is False


# ---------------------------------------------------------------------------
# 3. IntrusionEvent contract
# ---------------------------------------------------------------------------

class TestIntrusionEvent:
    @pytest.fixture
    def event(self, intr: IntrusionDetector) -> IntrusionEvent:
        """Trigger one event and return it."""
        intr.process([_make_det(track_id=7, x1=0, y1=0, x2=20, y2=20)])
        det_in = _make_det(
            track_id=7, x1=200, y1=150, x2=400, y2=350,
            class_name="person", confidence=0.94,
        )
        events = intr.process([det_in])
        assert len(events) == 1
        return events[0]

    def test_event_type(self, event: IntrusionEvent):
        assert event.event_type == "INTRUSION"

    def test_event_track_id(self, event: IntrusionEvent):
        assert event.track_id == 7
        assert isinstance(event.track_id, int)

    def test_event_class_name(self, event: IntrusionEvent):
        assert event.class_name == "person"

    def test_event_confidence(self, event: IntrusionEvent):
        assert event.confidence == pytest.approx(0.94, abs=1e-4)

    def test_event_bbox(self, event: IntrusionEvent):
        assert event.bbox == {"x1": 200, "y1": 150, "x2": 400, "y2": 350}

    def test_event_position(self, event: IntrusionEvent):
        # Centre of (200,150)→(400,350) is (300, 250)
        assert event.position == {"x": 300, "y": 250}

    def test_event_timestamp_is_string(self, event: IntrusionEvent):
        assert isinstance(event.timestamp, str)
        assert len(event.timestamp) > 0

    def test_as_dict_keys(self, event: IntrusionEvent):
        d = event.as_dict()
        for key in ("event_type", "track_id", "class_name", "confidence",
                    "timestamp", "bbox", "position"):
            assert key in d, f"Missing key '{key}' in as_dict()"

    def test_as_dict_json_serialisable(self, event: IntrusionEvent):
        """as_dict() must be JSON-serialisable without errors."""
        d = event.as_dict()
        serialised = json.dumps(d)
        assert isinstance(serialised, str)

    def test_as_dict_bbox_schema(self, event: IntrusionEvent):
        bbox = event.as_dict()["bbox"]
        for key in ("x1", "y1", "x2", "y2"):
            assert key in bbox


# ---------------------------------------------------------------------------
# 4. Drawing helpers — no model or display needed
# ---------------------------------------------------------------------------

class TestDrawingHelpers:
    def test_fence_draw_does_not_raise(self, fence: VirtualFence):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = fence.draw(frame, intrusion_active=False)
        assert result.shape == (480, 640, 3)

    def test_fence_draw_intrusion_colour_does_not_raise(self, fence: VirtualFence):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = fence.draw(frame, intrusion_active=True)
        assert result.shape == (480, 640, 3)

    def test_intrusion_overlay_no_events_no_change(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        original = frame.copy()
        result = IntrusionDetector.draw_intrusion_overlay(frame, [])
        # Frame should be unchanged when no events
        assert np.array_equal(result, original)

    def test_intrusion_overlay_with_event_modifies_frame(self, intr: IntrusionDetector):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        intr.process([_make_det(track_id=1, x1=0, y1=0, x2=20, y2=20)])
        events = intr.process([_make_det(track_id=1, x1=200, y1=150, x2=400, y2=350)])
        assert len(events) == 1

        result = IntrusionDetector.draw_intrusion_overlay(frame.copy(), events)
        # Banner pixels at the top should be non-zero (red)
        assert result[10, 100, 2] > 0   # R channel non-zero (red banner)


# ---------------------------------------------------------------------------
# 5. Phase 1A / 1B regression guard
# ---------------------------------------------------------------------------

class TestPhase1APhase1BRegression:
    def test_detection_result_track_id_field_exists(self):
        """DetectionResult must still have track_id defaulting to None."""
        det = DetectionResult(
            class_id=0, class_name="person", confidence=0.8,
            bbox=BoundingBox(0, 0, 50, 100),
        )
        assert det.track_id is None

    def test_detection_result_as_dict_no_track_id_when_none(self):
        det = DetectionResult(
            class_id=0, class_name="car", confidence=0.7,
            bbox=BoundingBox(10, 20, 100, 200),
        )
        d = det.as_dict()
        assert "track_id" not in d

    def test_detection_result_as_dict_with_track_id(self):
        det = DetectionResult(
            class_id=0, class_name="person", confidence=0.9,
            bbox=BoundingBox(10, 20, 100, 200),
            track_id=42,
        )
        d = det.as_dict()
        assert d["track_id"] == 42

    def test_bounding_box_width_height_unchanged(self):
        bb = BoundingBox(x1=10, y1=20, x2=110, y2=220)
        assert bb.width == 100
        assert bb.height == 200
