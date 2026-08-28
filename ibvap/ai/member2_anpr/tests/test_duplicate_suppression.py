"""
Tests for in-memory duplicate event suppression (suppressor.py).
"""

from __future__ import annotations

import time
import pytest

from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.suppressor import DuplicateSuppressor


class TestDuplicateSuppressor:

    def test_first_detection_not_suppressed(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        assert suppressor.should_suppress("CAM-01", "TN09AB1234") is False

    def test_subsequent_detection_within_window_suppressed(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        t0 = 1000.0
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        # 3 seconds later: within 10s window -> suppressed
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0 + 3.0) is True

    def test_detection_after_window_not_suppressed(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        t0 = 1000.0
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        # 12 seconds later: window expired -> allowed
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0 + 12.0) is False

    def test_camera_isolation(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        t0 = 1000.0
        # Same plate seen on CAM-01 and CAM-02 at the same time
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        assert suppressor.should_suppress("CAM-02", "TN09AB1234", timestamp_sec=t0) is False

    def test_plate_isolation_on_same_camera(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        t0 = 1000.0
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        assert suppressor.should_suppress("CAM-01", "MH12DE1433", timestamp_sec=t0) is False

    def test_disabled_suppression(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0, enabled=False)
        t0 = 1000.0
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0 + 1.0) is False

    def test_is_duplicate_query_does_not_update(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        t0 = 1000.0
        assert suppressor.is_duplicate("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        # Since is_duplicate did not record, a subsequent should_suppress is still False
        assert suppressor.should_suppress("CAM-01", "TN09AB1234", timestamp_sec=t0) is False
        # Now it is recorded
        assert suppressor.is_duplicate("CAM-01", "TN09AB1234", timestamp_sec=t0 + 2.0) is True

    def test_record_explicit(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        suppressor.record("CAM-01", "DL3CAM0001", timestamp_sec=100.0)
        assert suppressor.is_duplicate("CAM-01", "DL3CAM0001", timestamp_sec=105.0) is True

    def test_clear(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        suppressor.record("CAM-01", "DL3CAM0001", timestamp_sec=100.0)
        assert len(suppressor) == 1
        suppressor.clear()
        assert len(suppressor) == 0

    def test_cleanup_expired(self):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        suppressor.record("CAM-01", "PLATE1", timestamp_sec=100.0)
        suppressor.record("CAM-01", "PLATE2", timestamp_sec=108.0)

        # At t=112.0: PLATE1 is 12s old (expired), PLATE2 is 4s old (retained)
        evicted = suppressor.cleanup_expired(current_time_sec=112.0)
        assert evicted == 1
        assert len(suppressor) == 1

    def test_invalid_window_raises_value_error(self):
        with pytest.raises(ValueError, match="non-negative"):
            DuplicateSuppressor(window_seconds=-5.0)


class TestPipelineDuplicateSuppression:

    def test_pipeline_marks_duplicate_suppressed(self, valid_frame):
        suppressor = DuplicateSuppressor(window_seconds=10.0)
        pipeline = ANPRPipeline(
            ocr_engine=MockOCREngine(mock_text="TN09AB1234"),
            duplicate_suppressor=suppressor,
        )

        # Frame 1: first detection -> not duplicate
        res1 = pipeline.process_frame(valid_frame, camera_id="CAM-01")
        assert len(res1) == 1
        assert res1[0].duplicate_suppressed is False
        assert res1[0].event.metadata.get("duplicate_suppressed") is None

        # Frame 2: immediate detection -> duplicate suppressed
        res2 = pipeline.process_frame(valid_frame, camera_id="CAM-01")
        assert len(res2) == 1
        assert res2[0].duplicate_suppressed is True
        assert res2[0].event.metadata.get("duplicate_suppressed") is True
