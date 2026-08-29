"""
Tests for ANPRStreamProcessor and StreamStatistics (stream_processor.py).
"""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.schemas import IBVAPEvent
from ai.member2_anpr.stream import RTSPStreamReader
from ai.member2_anpr.stream_processor import ANPRStreamProcessor, StreamStatistics


class MockVideoCapture:
    def __init__(self, frame_count: int = 10):
        self._frames = [
            np.full((480, 640, 3), fill_value=(i * 10) % 255, dtype=np.uint8)
            for i in range(frame_count)
        ]
        self._idx = 0
        self.released = False

    def isOpened(self) -> bool:
        return not self.released and self._idx < len(self._frames)

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self._idx < len(self._frames):
            frame = self._frames[self._idx]
            self._idx += 1
            return True, frame
        return False, None

    def release(self) -> None:
        self.released = True


class BrokenVideoCapture:
    def isOpened(self) -> bool:
        return True

    def read(self) -> tuple[bool, None]:
        return False, None

    def release(self) -> None:
        pass


class TestANPRStreamProcessor:

    def test_init_validation(self):
        cap = MockVideoCapture(5)
        reader = RTSPStreamReader(source="test", capture_instance=cap)
        pipeline = ANPRPipeline()

        with pytest.raises(ValueError, match="frame_skip"):
            ANPRStreamProcessor(stream_reader=reader, pipeline=pipeline, frame_skip=-1)

    def test_process_stream_no_skipping(self):
        cap = MockVideoCapture(frame_count=5)
        reader = RTSPStreamReader(source="test", capture_instance=cap, camera_id="CAM-STREAM-01")
        pipeline = ANPRPipeline(ocr_engine=MockOCREngine(mock_text="TN09AB1234"))

        processor = ANPRStreamProcessor(
            stream_reader=reader,
            pipeline=pipeline,
            frame_skip=0,
        )

        results_list = list(processor.process_stream())
        assert len(results_list) == 5

        for frame_idx, results, events in results_list:
            assert frame_idx >= 1
            assert len(results) == 1
            assert results[0].success is True

        assert processor.stats.total_frames_read == 5
        assert processor.stats.frames_processed == 5
        assert processor.stats.frames_skipped == 0
        assert processor.stats.processing_fps > 0

    def test_process_stream_with_frame_skipping(self):
        # 10 frames with frame_skip=1 (processes frame 1, 3, 5, 7, 9 -> 5 processed, 5 skipped)
        cap = MockVideoCapture(frame_count=10)
        reader = RTSPStreamReader(source="test", capture_instance=cap)
        pipeline = ANPRPipeline()

        processor = ANPRStreamProcessor(
            stream_reader=reader,
            pipeline=pipeline,
            frame_skip=1,
        )

        results_list = list(processor.process_stream())
        assert len(results_list) == 10

        assert processor.stats.total_frames_read == 10
        assert processor.stats.frames_processed == 5
        assert processor.stats.frames_skipped == 5

    def test_process_stream_max_frames_limit(self):
        cap = MockVideoCapture(frame_count=20)
        reader = RTSPStreamReader(source="test", capture_instance=cap)
        pipeline = ANPRPipeline()

        processor = ANPRStreamProcessor(
            stream_reader=reader,
            pipeline=pipeline,
            frame_skip=0,
        )

        results_list = list(processor.process_stream(max_frames=4))
        assert len(results_list) == 4
        assert processor.stats.total_frames_read == 4

    def test_process_stream_events_generator(self):
        cap = MockVideoCapture(frame_count=3)
        reader = RTSPStreamReader(source="test", capture_instance=cap, camera_id="CAM-GEN-01")
        pipeline = ANPRPipeline(ocr_engine=MockOCREngine(mock_text="TN09AB1234"))

        processor = ANPRStreamProcessor(
            stream_reader=reader,
            pipeline=pipeline,
            frame_skip=0,
        )

        events = list(processor.process_stream_events(vehicle_id="VEH-STREAM-01"))
        assert len(events) >= 1
        assert isinstance(events[0], IBVAPEvent)
        assert events[0].camera_id == "CAM-GEN-01"
        assert events[0].metadata.get("vehicle_id") == "VEH-STREAM-01"

    def test_stop_condition_callback(self):
        cap = MockVideoCapture(frame_count=20)
        reader = RTSPStreamReader(source="test", capture_instance=cap)
        pipeline = ANPRPipeline()

        processor = ANPRStreamProcessor(stream_reader=reader, pipeline=pipeline)

        counter = 0

        def should_stop():
            nonlocal counter
            counter += 1
            return counter > 3

        results = list(processor.process_stream(stop_condition=should_stop))
        assert len(results) == 3

    def test_stream_statistics_summary_table(self):
        stats = StreamStatistics(
            camera_id="CAM-TEST",
            source_description="rtsp://192.168.1.10:554/stream",
            total_frames_read=100,
            frames_processed=20,
            frames_skipped=80,
            events_generated=5,
            processing_fps=15.5,
            average_latency_ms=22.3,
            uptime_seconds=5.2,
        )
        table = stats.summary_table()
        assert "CAM-TEST" in table
        assert "Total Frames Read" in table
        assert "15.50 FPS" in table
