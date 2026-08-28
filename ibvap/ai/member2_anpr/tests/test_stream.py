"""
Tests for RTSPStreamReader and RTSP URL masking (stream.py).
"""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.stream import RTSPStreamReader, mask_rtsp_url


class MockVideoCapture:
    """Mock OpenCV VideoCapture for deterministic unit tests without network."""

    def __init__(
        self,
        frames: list[np.ndarray | None] | None = None,
        is_opened_initially: bool = True,
        fail_after_reads: int | None = None,
    ) -> None:
        self._frames = frames if frames is not None else [
            np.full((480, 640, 3), 128, dtype=np.uint8) for _ in range(10)
        ]
        self._is_opened = is_opened_initially
        self._read_idx = 0
        self._fail_after = fail_after_reads
        self.released = False

    def isOpened(self) -> bool:
        return self._is_opened and not self.released

    def read(self) -> tuple[bool, np.ndarray | None]:
        if not self.isOpened():
            return False, None

        if self._fail_after is not None and self._read_idx >= self._fail_after:
            return False, None

        if self._read_idx < len(self._frames):
            frame = self._frames[self._read_idx]
            self._read_idx += 1
            if frame is None:
                return False, None
            return True, frame

        return False, None

    def release(self) -> None:
        self.released = True
        self._is_opened = False


class TestMaskRTSPUrl:

    def test_mask_rtsp_with_username_and_password(self):
        url = "rtsp://admin:superSecret123@192.168.1.100:554/h264Preview_01_main"
        masked = mask_rtsp_url(url)
        assert "superSecret123" not in masked
        assert masked == "rtsp://admin:***@192.168.1.100:554/h264Preview_01_main"

    def test_mask_rtsp_without_password(self):
        url = "rtsp://192.168.1.50:554/live"
        assert mask_rtsp_url(url) == "rtsp://192.168.1.50:554/live"

    def test_mask_device_index(self):
        assert mask_rtsp_url(0) == "0"

    def test_mask_file_path(self):
        assert mask_rtsp_url("video.mp4") == "video.mp4"


class TestRTSPStreamReader:

    def test_init_validation(self):
        with pytest.raises(ValueError, match="reconnect_attempts"):
            RTSPStreamReader(reconnect_attempts=-1)

        with pytest.raises(ValueError, match="reconnect_delay_sec"):
            RTSPStreamReader(reconnect_delay_sec=-0.5)

    def test_open_success_with_mock_capture(self):
        cap = MockVideoCapture()
        reader = RTSPStreamReader(source="rtsp://fake-stream", capture_instance=cap)
        assert reader.open() is True
        assert reader.is_opened() is True

    def test_read_frames_successfully(self):
        frame = np.full((100, 100, 3), 200, dtype=np.uint8)
        cap = MockVideoCapture(frames=[frame, frame])
        reader = RTSPStreamReader(source="test.mp4", capture_instance=cap)

        success, out_frame = reader.read()
        assert success is True
        assert out_frame is not None
        assert out_frame.shape == (100, 100, 3)

        success2, out_frame2 = reader.read()
        assert success2 is True

        # End of stream
        success3, out_frame3 = reader.read()
        assert success3 is False
        assert out_frame3 is None

    def test_release_resources(self):
        cap = MockVideoCapture()
        reader = RTSPStreamReader(source=0, capture_instance=cap)
        assert reader.is_opened() is True
        reader.release()
        assert reader.is_opened() is False
        assert cap.released is True

    def test_failed_reconnection_exhausts_attempts(self):
        cap = MockVideoCapture(is_opened_initially=False)
        reader = RTSPStreamReader(
            source="rtsp://non-existent",
            reconnect_attempts=2,
            reconnect_delay_sec=0.01,
            capture_instance=cap,
        )
        assert reader.reconnect() is False
        assert reader.total_reconnects == 0
