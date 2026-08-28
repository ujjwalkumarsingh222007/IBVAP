"""
tests/test_event_analyzer.py — Phase 2B: AI Event Engine unit tests.

Covers:
1. Person detection -> PERSON_DETECTED.
2. Car detection -> VEHICLE_DETECTED.
3. Motorcycle detection -> VEHICLE_DETECTED.
4. Bus detection -> VEHICLE_DETECTED.
5. Truck detection -> VEHICLE_DETECTED.
6. Generic object (e.g., backpack, suitcase, dog) -> OBJECT_DETECTED.
7. Deduplication: Same track across consecutive frames does NOT re-emit.
8. Multiple track IDs are tracked and emitted independently.
9. Lifecycle: Disappeared track is cleaned up and emits a new event upon re-appearance.
10. Missing track_id (None) is safely skipped without event emission or crash.
11. Detection confidence is preserved exactly.
12. Bounding box coordinates are preserved.
13. Position center calculation is accurate.
14. Timestamp is ISO-8601 UTC formatted string.
15. AnalyticsEvent.as_dict() matches schema.
16. EventClient integration: build_payload() and send() handle AnalyticsEvent seamlessly.
17. EventAnalyzer.reset() clears active state.
"""

from __future__ import annotations

import io
import json
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from detection.detector import BoundingBox, DetectionResult
from events.analyzer import EventAnalyzer, AnalyticsEvent, VEHICLE_CLASSES
from adapter.event_client import EventClient


# ---------------------------------------------------------------------------
# Test Fixtures & Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def analyzer() -> EventAnalyzer:
    return EventAnalyzer()


def _make_det(
    track_id: int | None,
    class_name: str,
    confidence: float = 0.92,
    x1: int = 100,
    y1: int = 100,
    x2: int = 300,
    y2: int = 400,
    class_id: int = 0,
) -> DetectionResult:
    """Helper to create a DetectionResult object."""
    return DetectionResult(
        class_id=class_id,
        class_name=class_name,
        confidence=confidence,
        bbox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
        track_id=track_id,
    )


# ---------------------------------------------------------------------------
# 1. Event Type Classification Tests
# ---------------------------------------------------------------------------

class TestEventClassification:

    def test_person_generates_person_detected(self, analyzer: EventAnalyzer):
        det = _make_det(track_id=1, class_name="person")
        events = analyzer.process([det])
        assert len(events) == 1
        assert events[0].event_type == "PERSON_DETECTED"
        assert events[0].class_name == "person"
        assert events[0].track_id == 1

    @pytest.mark.parametrize("vehicle_class", ["car", "motorcycle", "bus", "truck"])
    def test_vehicle_classes_generate_vehicle_detected(
        self, analyzer: EventAnalyzer, vehicle_class: str
    ):
        det = _make_det(track_id=2, class_name=vehicle_class)
        events = analyzer.process([det])
        assert len(events) == 1
        assert events[0].event_type == "VEHICLE_DETECTED"
        assert events[0].class_name == vehicle_class
        assert events[0].track_id == 2

    @pytest.mark.parametrize("generic_class", ["backpack", "suitcase", "dog", "bicycle", "boat"])
    def test_other_objects_generate_object_detected(
        self, analyzer: EventAnalyzer, generic_class: str
    ):
        det = _make_det(track_id=3, class_name=generic_class)
        events = analyzer.process([det])
        assert len(events) == 1
        assert events[0].event_type == "OBJECT_DETECTED"
        assert events[0].class_name == generic_class
        assert events[0].track_id == 3

    def test_classify_event_type_helper(self):
        assert EventAnalyzer.classify_event_type("person") == "PERSON_DETECTED"
        assert EventAnalyzer.classify_event_type("PERSON") == "PERSON_DETECTED"
        assert EventAnalyzer.classify_event_type("car") == "VEHICLE_DETECTED"
        assert EventAnalyzer.classify_event_type("Truck") == "VEHICLE_DETECTED"
        assert EventAnalyzer.classify_event_type("handbag") == "OBJECT_DETECTED"


# ---------------------------------------------------------------------------
# 2. Deduplication & Track Lifecycle Tests
# ---------------------------------------------------------------------------

class TestDeduplicationAndLifecycle:

    def test_same_track_does_not_generate_duplicate_events(self, analyzer: EventAnalyzer):
        det = _make_det(track_id=7, class_name="person")

        # Frame 1: first sighting -> emit event
        events_f1 = analyzer.process([det])
        assert len(events_f1) == 1
        assert events_f1[0].track_id == 7

        # Frame 2: same track continues -> NO duplicate event
        events_f2 = analyzer.process([det])
        assert len(events_f2) == 0

        # Frame 3: same track continues -> NO duplicate event
        events_f3 = analyzer.process([det])
        assert len(events_f3) == 0

    def test_multiple_tracks_are_independent(self, analyzer: EventAnalyzer):
        det_person = _make_det(track_id=1, class_name="person")
        det_car = _make_det(track_id=2, class_name="car")
        det_truck = _make_det(track_id=3, class_name="truck")

        # Frame 1: 3 distinct tracks appear
        events = analyzer.process([det_person, det_car, det_truck])
        assert len(events) == 3
        ids = {e.track_id for e in events}
        assert ids == {1, 2, 3}
        types = {e.track_id: e.event_type for e in events}
        assert types[1] == "PERSON_DETECTED"
        assert types[2] == "VEHICLE_DETECTED"
        assert types[3] == "VEHICLE_DETECTED"

        # Frame 2: Person (1) disappears, new dog (4) appears, car (2) remains
        det_dog = _make_det(track_id=4, class_name="dog")
        events_f2 = analyzer.process([det_car, det_dog])
        assert len(events_f2) == 1
        assert events_f2[0].track_id == 4
        assert events_f2[0].event_type == "OBJECT_DETECTED"

    def test_disappeared_track_can_trigger_event_again_on_reappearance(
        self, analyzer: EventAnalyzer
    ):
        det = _make_det(track_id=10, class_name="car")

        # Frame 1: Track 10 appears -> event
        ev1 = analyzer.process([det])
        assert len(ev1) == 1

        # Frame 2: Track 10 disappears (empty detections)
        ev2 = analyzer.process([])
        assert len(ev2) == 0
        assert not analyzer.is_track_active(10)

        # Frame 3: Track 10 reappears -> new event emitted
        ev3 = analyzer.process([det])
        assert len(ev3) == 1
        assert ev3[0].track_id == 10

    def test_missing_track_id_handled_safely(self, analyzer: EventAnalyzer):
        """Detections with track_id=None must not emit events and not crash."""
        det_none = _make_det(track_id=None, class_name="person")
        events = analyzer.process([det_none])
        assert len(events) == 0

    def test_empty_detection_list(self, analyzer: EventAnalyzer):
        events = analyzer.process([])
        assert events == []

    def test_reset_clears_active_tracks(self, analyzer: EventAnalyzer):
        det = _make_det(track_id=5, class_name="bus")
        analyzer.process([det])
        assert analyzer.is_track_active(5)

        analyzer.reset()
        assert not analyzer.is_track_active(5)

        # After reset, track 5 can emit event again
        events = analyzer.process([det])
        assert len(events) == 1


# ---------------------------------------------------------------------------
# 3. Payload Integrity & Field Values
# ---------------------------------------------------------------------------

class TestAnalyticsEventPayload:

    def test_event_fields_integrity(self, analyzer: EventAnalyzer):
        det = _make_det(
            track_id=42,
            class_name="motorcycle",
            confidence=0.8876,
            x1=100,
            y1=150,
            x2=300,
            y2=350,
        )
        events = analyzer.process([det])
        assert len(events) == 1
        ev = events[0]

        assert ev.event_type == "VEHICLE_DETECTED"
        assert ev.track_id == 42
        assert ev.class_name == "motorcycle"
        assert abs(ev.confidence - 0.8876) < 1e-4
        assert ev.bbox == {"x1": 100, "y1": 150, "x2": 300, "y2": 350}
        assert ev.position == {"x": 200, "y": 250}
        assert isinstance(ev.timestamp, str)
        assert "T" in ev.timestamp

    def test_as_dict_format(self, analyzer: EventAnalyzer):
        det = _make_det(track_id=9, class_name="person", confidence=0.95)
        ev = analyzer.process([det])[0]
        d = ev.as_dict()

        assert d["event_type"] == "PERSON_DETECTED"
        assert d["track_id"] == 9
        assert d["class_name"] == "person"
        assert d["confidence"] == 0.95
        assert "timestamp" in d
        assert "bbox" in d
        assert "position" in d
        assert json.dumps(d)  # JSON serializable


# ---------------------------------------------------------------------------
# 4. EventClient Integration Tests
# ---------------------------------------------------------------------------

class TestEventClientIntegrationWithAnalyticsEvents:

    def test_event_client_build_payload_for_person_detected(self):
        client = EventClient(camera_id="CAM-01")
        ev = AnalyticsEvent(
            event_type="PERSON_DETECTED",
            track_id=11,
            class_name="person",
            confidence=0.93,
            timestamp="2026-08-28T15:00:00Z",
            bbox={"x1": 10, "y1": 20, "x2": 50, "y2": 100},
            position={"x": 30, "y": 60},
        )
        payload = client.build_payload(ev)

        assert payload["camera_id"] == "CAM-01"
        assert payload["event_type"] == "PERSON_DETECTED"
        assert payload["timestamp"] == "2026-08-28T15:00:00Z"
        assert payload["confidence"] == 0.93
        assert payload["metadata"]["track_id"] == 11
        assert payload["metadata"]["class_name"] == "person"
        assert payload["metadata"]["bbox"] == [10, 20, 50, 100]
        assert payload["metadata"]["position"] == {"x": 30, "y": 60}

    def test_event_client_build_payload_for_vehicle_detected(self):
        client = EventClient(camera_id="CAM-02")
        ev = AnalyticsEvent(
            event_type="VEHICLE_DETECTED",
            track_id=22,
            class_name="truck",
            confidence=0.87,
            timestamp="2026-08-28T15:05:00Z",
            bbox={"x1": 100, "y1": 200, "x2": 400, "y2": 500},
            position={"x": 250, "y": 350},
        )
        payload = client.build_payload(ev)

        assert payload["camera_id"] == "CAM-02"
        assert payload["event_type"] == "VEHICLE_DETECTED"
        assert payload["metadata"]["class_name"] == "truck"

    @patch("urllib.request.urlopen")
    def test_event_client_sends_analytics_event_successfully(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = b'{"id": 1, "status": "created"}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = EventClient(camera_id="CAM-01")
        ev = AnalyticsEvent(
            event_type="OBJECT_DETECTED",
            track_id=33,
            class_name="backpack",
            confidence=0.89,
            timestamp="2026-08-28T15:10:00Z",
            bbox={"x1": 50, "y1": 50, "x2": 150, "y2": 150},
            position={"x": 100, "y": 100},
        )
        res = client.send(ev)
        assert res.success is True
        assert res.status_code == 201

        # Verify POST payload sent
        req = mock_urlopen.call_args[0][0]
        data = json.loads(req.data.decode("utf-8"))
        assert data["event_type"] == "OBJECT_DETECTED"
        assert data["metadata"]["track_id"] == 33
