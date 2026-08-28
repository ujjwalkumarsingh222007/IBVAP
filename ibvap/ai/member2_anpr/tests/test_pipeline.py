"""Tests for the end-to-end ANPR pipeline."""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.detector import BasePlateDetector, MockPlateDetector
from ai.member2_anpr.event_generator import ANPREventGenerator
from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.recognizer import PlateRecognizer
from ai.member2_anpr.schemas import ANPRResult, EventType, PlateRegion
from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher


def _pipeline(
    ocr_text: str = "TN 09 AB 1234",
    ocr_conf: float = 0.91,
    det_conf: float = 0.90,
    watchlist_store: dict = None,
) -> ANPRPipeline:
    return ANPRPipeline(
        detector=MockPlateDetector(confidence=det_conf),
        ocr_engine=MockOCREngine(mock_text=ocr_text, mock_confidence=ocr_conf),
        recognizer=PlateRecognizer(),
        watchlist=InMemoryWatchlistMatcher(watchlist=watchlist_store if watchlist_store is not None else {}),
        event_generator=ANPREventGenerator(),
    )


class TestPipelineHappyPath:

    def test_returns_list(self, valid_frame):
        assert isinstance(_pipeline().process_frame(valid_frame), list)

    def test_returns_one_result_for_one_detection(self, valid_frame):
        assert len(_pipeline().process_frame(valid_frame)) == 1

    def test_result_is_anpr_result(self, valid_frame):
        assert isinstance(_pipeline().process_frame(valid_frame)[0], ANPRResult)

    def test_result_success(self, valid_frame):
        assert _pipeline().process_frame(valid_frame)[0].success is True

    def test_plate_number_normalised(self, valid_frame):
        result = _pipeline(ocr_text="TN 09 AB 1234").process_frame(valid_frame)[0]
        assert result.plate_number == "TN09AB1234"

    def test_plate_confidence_set(self, valid_frame):
        result = _pipeline(det_conf=0.88).process_frame(valid_frame)[0]
        assert result.plate_confidence == pytest.approx(0.88)

    def test_ocr_confidence_set(self, valid_frame):
        result = _pipeline(ocr_conf=0.77).process_frame(valid_frame)[0]
        assert result.ocr_confidence == pytest.approx(0.77)

    def test_event_generated(self, valid_frame):
        assert _pipeline().process_frame(valid_frame)[0].event is not None

    def test_event_type_anpr_detected(self, valid_frame):
        result = _pipeline().process_frame(valid_frame)[0]
        assert result.event.event_type == EventType.ANPR_DETECTED

    def test_camera_id_propagated_to_event(self, valid_frame):
        results = _pipeline().process_frame(valid_frame, camera_id="CAM-BORDER-01")
        assert results[0].event.camera_id == "CAM-BORDER-01"

    def test_timestamp_propagated_to_event(self, valid_frame):
        ts = "2026-08-28T15:30:00+05:30"
        results = _pipeline().process_frame(valid_frame, timestamp=ts)
        assert results[0].event.timestamp == ts

    def test_vehicle_id_propagated(self, valid_frame):
        results = _pipeline().process_frame(valid_frame, vehicle_id="VEH-TRACK-42")
        assert results[0].vehicle_id == "VEH-TRACK-42"
        assert results[0].event.metadata.get("vehicle_id") == "VEH-TRACK-42"


class MultiPlateDetector(BasePlateDetector):
    def detect(self, frame):
        return [
            PlateRegion(x1=50, y1=50, x2=200, y2=100, confidence=0.91),
            PlateRegion(x1=250, y1=200, x2=400, y2=250, confidence=0.89),
        ]


class TestPipelineMultiplePlates:

    def test_multiple_plates_in_single_frame(self, valid_frame):
        pipeline = ANPRPipeline(
            detector=MultiPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="TN09AB1234"),
        )
        results = pipeline.process_frame(valid_frame)

        assert len(results) == 2
        assert results[0].success is True
        assert results[1].success is True


class TestPipelineFrameValidation:

    def test_none_frame_returns_error_result(self):
        results = _pipeline().process_frame(None)
        assert results[0].error is not None

    def test_empty_frame_returns_error_result(self, empty_frame):
        results = _pipeline().process_frame(empty_frame)
        assert results[0].error is not None

    def test_wrong_type_frame_returns_error_result(self):
        results = _pipeline().process_frame("not a frame")
        assert results[0].error is not None

    def test_empty_camera_id_returns_error_result(self, valid_frame):
        results = _pipeline().process_frame(valid_frame, camera_id="")
        assert results[0].error is not None

    def test_whitespace_camera_id_returns_error_result(self, valid_frame):
        results = _pipeline().process_frame(valid_frame, camera_id="   ")
        assert results[0].error is not None


class TestPipelineNoPlateDetected:

    def test_small_frame_returns_empty_list(self):
        tiny = np.zeros((5, 5, 3), dtype=np.uint8)
        assert _pipeline().process_frame(tiny) == []


class TestPipelineOCRFailure:

    def test_empty_ocr_text_returns_error_result(self, valid_frame):
        pipeline = ANPRPipeline(
            detector=MockPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="", mock_confidence=0.90),
        )
        results = pipeline.process_frame(valid_frame)
        assert results[0].error is not None

    def test_low_ocr_confidence_returns_error_result(self, valid_frame):
        pipeline = ANPRPipeline(
            detector=MockPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="TN09AB1234", mock_confidence=0.05),
            recognizer=PlateRecognizer(min_ocr_confidence=0.50),
        )
        results = pipeline.process_frame(valid_frame)
        assert results[0].error is not None


class TestPipelineWatchlist:

    def test_watchlist_match_detected(self, valid_frame):
        wl = {"TN09AB1234": {"status": "WATCHLIST", "reason": "Test"}}
        results = _pipeline(ocr_text="TN 09 AB 1234", watchlist_store=wl).process_frame(valid_frame)
        assert results[0].watchlist_match is True

    def test_watchlist_match_event_type(self, valid_frame):
        wl = {"TN09AB1234": {"status": "WATCHLIST", "reason": "Test"}}
        results = _pipeline(ocr_text="TN 09 AB 1234", watchlist_store=wl).process_frame(valid_frame)
        assert results[0].event.event_type == EventType.WATCHLIST_MATCH

    def test_watchlist_match_status_in_result(self, valid_frame):
        wl = {"TN09AB1234": {"status": "STOLEN", "reason": "Test"}}
        results = _pipeline(ocr_text="TN 09 AB 1234", watchlist_store=wl).process_frame(valid_frame)
        assert results[0].watchlist_status == "STOLEN"

    def test_watchlist_no_match(self, valid_frame):
        results = _pipeline(ocr_text="KA05MN9999").process_frame(valid_frame)
        assert results[0].watchlist_match is False

    def test_watchlist_no_match_event_type_is_anpr(self, valid_frame):
        results = _pipeline(ocr_text="KA05MN9999").process_frame(valid_frame)
        assert results[0].event.event_type == EventType.ANPR_DETECTED


class TestANPRResultSchema:

    def test_error_result_success_is_false(self):
        assert ANPRResult(error="something went wrong").success is False

    def test_successful_result_success_is_true(self):
        assert ANPRResult(plate_number="TN09AB1234", plate_confidence=0.9).success is True

    def test_default_watchlist_match_is_false(self):
        assert ANPRResult().watchlist_match is False
