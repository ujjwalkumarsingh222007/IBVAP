"""
Tests for public backend integration interface and process_frame_to_events().
"""

from __future__ import annotations

import json
import numpy as np
import pytest

from ai.member2_anpr import (
    ANPRPipeline,
    IBVAPEvent,
    MockOCREngine,
    MockPlateDetector,
    process_frame_to_events,
)
from ai.member2_anpr.suppressor import DuplicateSuppressor


class TestIntegrationInterface:

    def test_process_frame_to_events_default_pipeline(self, valid_frame):
        events = process_frame_to_events(
            frame=valid_frame,
            camera_id="CAM-BORDER-01",
            vehicle_id="VEH-991",
        )

        assert isinstance(events, list)
        assert len(events) >= 1
        event = events[0]
        assert isinstance(event, IBVAPEvent)
        assert event.camera_id == "CAM-BORDER-01"
        assert event.metadata.get("vehicle_id") == "VEH-991"
        assert "plate_number" in event.metadata

    def test_process_frame_to_events_suppresses_stream_duplicates(self, valid_frame):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        pipeline = ANPRPipeline(
            ocr_engine=MockOCREngine(mock_text="TN09AB1234"),
            duplicate_suppressor=suppressor,
        )

        # Frame 1: emitted
        events1 = process_frame_to_events(
            frame=valid_frame,
            camera_id="CAM-01",
            pipeline=pipeline,
            suppress_duplicates=True,
        )
        assert len(events1) == 1

        # Frame 2: duplicate suppressed -> empty event list
        events2 = process_frame_to_events(
            frame=valid_frame,
            camera_id="CAM-01",
            pipeline=pipeline,
            suppress_duplicates=True,
        )
        assert len(events2) == 0

        # When suppress_duplicates=False, returns all events even if marked duplicate
        events3 = process_frame_to_events(
            frame=valid_frame,
            camera_id="CAM-01",
            pipeline=pipeline,
            suppress_duplicates=False,
        )
        assert len(events3) == 1
        assert events3[0].metadata.get("duplicate_suppressed") is True

    def test_event_json_serialization_matches_backend_contract(self, valid_frame):
        events = process_frame_to_events(valid_frame, camera_id="CAM-01")
        assert len(events) == 1

        event = events[0]
        event_dict = event.model_dump()
        event_json = event.model_dump_json()

        # Check top-level contract
        assert "camera_id" in event_dict
        assert "event_type" in event_dict
        assert "timestamp" in event_dict
        assert "confidence" in event_dict
        assert "metadata" in event_dict

        # Verify JSON is valid string
        parsed = json.loads(event_json)
        assert parsed["camera_id"] == "CAM-01"

    def test_empty_frame_returns_empty_events_list(self):
        empty = np.zeros((0, 0, 3), dtype=np.uint8)
        events = process_frame_to_events(empty, camera_id="CAM-01")
        assert events == []

    def test_none_frame_returns_empty_events_list(self):
        events = process_frame_to_events(None, camera_id="CAM-01")  # type: ignore[arg-type]
        assert events == []
