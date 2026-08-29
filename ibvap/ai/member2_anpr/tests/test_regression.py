"""
Phase 7 Final Regression Test Suite for Member 2 ANPR Module.
Validates the complete end-to-end flow, event contract, backend integration,
watchlist matching, duplicate suppression, vehicle ID propagation, and stream safety.
"""

from __future__ import annotations

import json
import numpy as np
import pytest

from ai.member2_anpr import (
    ANPRConfig,
    ANPRPipeline,
    ANPRStreamProcessor,
    ANPRValidator,
    DuplicateSuppressor,
    EventType,
    IBVAPEvent,
    InMemoryWatchlistMatcher,
    MockOCREngine,
    MockPlateDetector,
    PlatePreprocessor,
    PlateRecognizer,
    RTSPStreamReader,
    mask_rtsp_url,
    normalise_plate,
    process_frame_to_events,
    validate_indian_plate,
)


class TestFullPipelineRegression:
    """1. Complete ANPR Flow & Schema Contract Verification."""

    def test_complete_anpr_pipeline_flow(self, valid_frame):
        pipeline = ANPRPipeline(
            detector=MockPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="DL01AB1234", mock_confidence=0.94),
            recognizer=PlateRecognizer(strict=True),
            watchlist=InMemoryWatchlistMatcher(custom_watchlist={}),
        )

        results = pipeline.process_frame(
            frame=valid_frame,
            camera_id="CAM-BORDER-01",
            timestamp="2026-08-28T15:30:00+00:00",
            vehicle_id="VEH-BORDER-991",
        )

        assert len(results) == 1
        res = results[0]
        assert res.success is True
        assert res.plate_number == "DL01AB1234"
        assert res.vehicle_id == "VEH-BORDER-991"
        assert res.watchlist_match is False

        event = res.event
        assert isinstance(event, IBVAPEvent)
        assert event.camera_id == "CAM-BORDER-01"
        assert event.event_type == EventType.ANPR_DETECTED
        assert event.timestamp == "2026-08-28T15:30:00+00:00"
        assert event.confidence > 0.90

        # Verify all metadata fields exist
        meta = event.metadata
        assert meta["plate_number"] == "DL01AB1234"
        assert meta["raw_ocr_text"] == "DL01AB1234"
        assert meta["plate_confidence"] == 0.9
        assert meta["ocr_confidence"] == 0.94
        assert meta["vehicle_id"] == "VEH-BORDER-991"
        assert meta["watchlist_match"] is False
        assert meta["validation_passed"] is True
        assert "Standard Indian Plate (DL)" in meta["validation_reason"]

        # Verify JSON serialization
        event_dict = event.model_dump()
        event_json = event.model_dump_json()
        parsed = json.loads(event_json)
        assert parsed["camera_id"] == "CAM-BORDER-01"
        assert parsed["metadata"]["plate_number"] == "DL01AB1234"


class TestBackendIntegrationRegression:
    """2. Backend Integration Helper process_frame_to_events()."""

    def test_process_frame_to_events_success(self, valid_frame):
        events = process_frame_to_events(
            frame=valid_frame,
            camera_id="CAM-CHECKPOINT-A",
            vehicle_id="VEH-TRUCK-55",
            suppress_duplicates=True,
        )

        assert isinstance(events, list)
        assert len(events) == 1
        ev = events[0]
        assert ev.camera_id == "CAM-CHECKPOINT-A"
        assert ev.metadata["vehicle_id"] == "VEH-TRUCK-55"


class TestWatchlistRegression:
    """3. Watchlist Matching & Event Type Verification."""

    def test_watchlist_hit_triggers_watchlist_match_event(self, valid_frame):
        wl = {"KA05MH2020": {"status": "WANTED", "reason": "Border contraband suspect"}}
        pipeline = ANPRPipeline(
            detector=MockPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="KA05MH2020", mock_confidence=0.96),
            watchlist=InMemoryWatchlistMatcher(custom_watchlist=wl),
        )

        results = pipeline.process_frame(valid_frame, camera_id="CAM-GATE-01")
        assert len(results) == 1
        res = results[0]
        assert res.watchlist_match is True
        assert res.watchlist_status == "WANTED"

        event = res.event
        assert event.event_type == EventType.WATCHLIST_MATCH
        assert event.metadata["watchlist_status"] == "WANTED"
        assert event.metadata["watchlist_reason"] == "Border contraband suspect"

    def test_watchlist_case_and_whitespace_normalization(self):
        wl = InMemoryWatchlistMatcher(custom_watchlist={"MH12DE1433": {"status": "STOLEN", "reason": "FIR 102"}})
        res1 = wl.match("mh 12 de 1433")
        assert res1.is_match is True
        assert res1.status == "STOLEN"

        res2 = wl.match("  MH12DE1433  ")
        assert res2.is_match is True


class TestDuplicateSuppressionRegression:
    """4. Stream Duplicate Suppression & Multi-Camera Independence."""

    def test_stream_duplicate_suppression_behavior(self, valid_frame):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        pipeline = ANPRPipeline(
            ocr_engine=MockOCREngine(mock_text="HR26DK8337"),
            duplicate_suppressor=suppressor,
        )

        # 1. Frame 1 on CAM-01 at t=100.0s -> emitted
        events1 = process_frame_to_events(valid_frame, camera_id="CAM-01", pipeline=pipeline)
        assert len(events1) == 1

        # 2. Frame 2 on CAM-01 at t=101.0s -> duplicate suppressed
        events2 = process_frame_to_events(valid_frame, camera_id="CAM-01", pipeline=pipeline)
        assert len(events2) == 0

        # 3. Frame 3 on CAM-02 (different checkpoint) at t=102.0s -> independent, emitted
        events3 = process_frame_to_events(valid_frame, camera_id="CAM-02", pipeline=pipeline)
        assert len(events3) == 1


class TestStreamSafetyAndMasking:
    """5. RTSP Credential Masking & Safe Logging."""

    def test_credential_masking_in_urls(self):
        urls = [
            ("rtsp://admin:pass123@192.168.1.1:554/stream", "rtsp://admin:***@192.168.1.1:554/stream"),
            ("rtsp://root:TopSecret@border-cam.gov:8554/live", "rtsp://root:***@border-cam.gov:8554/live"),
            ("0", "0"),
            ("local_video.mp4", "local_video.mp4"),
        ]
        for inp, expected in urls:
            assert mask_rtsp_url(inp) == expected
