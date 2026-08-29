"""Tests for the ANPR event generator."""

from __future__ import annotations

import pytest

from ai.member2_anpr.event_generator import ANPREventGenerator
from ai.member2_anpr.schemas import (
    EventType,
    IBVAPEvent,
    RecognitionResult,
    WatchlistResult,
)


def _make_recognition(plate: str = "TN09AB1234", conf: float = 0.91) -> RecognitionResult:
    return RecognitionResult(
        plate_number=plate,
        raw_text=plate,
        confidence=conf,
        normalised=True,
        validation_passed=True,
        validation_reason="Standard Indian Plate (TN)",
    )


def _make_watchlist(plate: str = "TN09AB1234", is_match: bool = False) -> WatchlistResult:
    if is_match:
        return WatchlistResult(plate_number=plate, is_match=True, status="WATCHLIST", reason="Test entry")
    return WatchlistResult(plate_number=plate, is_match=False)


class TestANPRDetectedEvent:

    def _generate(self, **kwargs) -> IBVAPEvent:
        gen = ANPREventGenerator()
        return gen.generate(
            camera_id=kwargs.get("camera_id", "CAM-01"),
            recognition=kwargs.get("recognition", _make_recognition()),
            watchlist=kwargs.get("watchlist", _make_watchlist()),
            plate_confidence=kwargs.get("plate_confidence", 0.90),
            timestamp=kwargs.get("timestamp", "2026-08-28T15:30:00+05:30"),
            vehicle_id=kwargs.get("vehicle_id", None),
        )

    def test_returns_ibvap_event(self):
        assert isinstance(self._generate(), IBVAPEvent)

    def test_event_type_is_anpr_detected(self):
        assert self._generate().event_type == EventType.ANPR_DETECTED

    def test_camera_id_preserved(self):
        assert self._generate(camera_id="CAM-99").camera_id == "CAM-99"

    def test_timestamp_preserved(self):
        ts = "2026-08-28T15:30:00+05:30"
        assert self._generate(timestamp=ts).timestamp == ts

    def test_confidence_within_bounds(self):
        event = self._generate()
        assert 0.0 <= event.confidence <= 1.0

    def test_metadata_contains_plate_number(self):
        event = self._generate()
        assert event.metadata["plate_number"] == "TN09AB1234"

    def test_metadata_contains_plate_confidence(self):
        assert "plate_confidence" in self._generate().metadata

    def test_metadata_contains_ocr_confidence(self):
        assert "ocr_confidence" in self._generate().metadata

    def test_metadata_watchlist_match_is_false(self):
        assert self._generate().metadata["watchlist_match"] is False

    def test_metadata_vehicle_id_preserved(self):
        event = self._generate(vehicle_id="VEH-001")
        assert event.metadata["vehicle_id"] == "VEH-001"

    def test_empty_camera_id_raises(self):
        gen = ANPREventGenerator()
        with pytest.raises(ValueError):
            gen.generate(camera_id="", recognition=_make_recognition(),
                         watchlist=_make_watchlist(), plate_confidence=0.90)

    def test_auto_timestamp_when_none(self):
        gen = ANPREventGenerator()
        event = gen.generate(camera_id="CAM-01", recognition=_make_recognition(),
                             watchlist=_make_watchlist(), plate_confidence=0.90, timestamp=None)
        assert event.timestamp


class TestWatchlistMatchEvent:

    def _generate_wl(self) -> IBVAPEvent:
        gen = ANPREventGenerator()
        return gen.generate(
            camera_id="CAM-01",
            recognition=_make_recognition("TN09AB1234"),
            watchlist=_make_watchlist("TN09AB1234", is_match=True),
            plate_confidence=0.90,
            timestamp="2026-08-28T15:30:00+05:30",
        )

    def test_event_type_is_watchlist_match(self):
        assert self._generate_wl().event_type == EventType.WATCHLIST_MATCH

    def test_metadata_watchlist_match_is_true(self):
        assert self._generate_wl().metadata["watchlist_match"] is True

    def test_metadata_contains_watchlist_status(self):
        event = self._generate_wl()
        assert event.metadata.get("watchlist_status") == "WATCHLIST"

    def test_metadata_contains_watchlist_reason(self):
        assert "watchlist_reason" in self._generate_wl().metadata


class TestIBVAPEventSchema:

    def test_valid_event(self):
        event = IBVAPEvent(
            camera_id="CAM-01",
            event_type=EventType.ANPR_DETECTED,
            timestamp="2026-08-28T15:30:00",
            confidence=0.90,
            metadata={"plate_number": "TN09AB1234"},
        )
        assert event.camera_id == "CAM-01"

    def test_empty_camera_id_raises(self):
        with pytest.raises(Exception):
            IBVAPEvent(camera_id="", event_type=EventType.ANPR_DETECTED,
                       timestamp="2026-08-28T15:30:00", confidence=0.90)

    def test_confidence_out_of_range_raises(self):
        with pytest.raises(Exception):
            IBVAPEvent(camera_id="CAM-01", event_type=EventType.ANPR_DETECTED,
                       timestamp="2026-08-28T15:30:00", confidence=1.5)
