"""
IBVAP - Member 2 ANPR Module - stream.py

RTSP and IP-camera video stream capture with automatic reconnection,
error recovery, and credential masking for secure logging.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Optional, Tuple, Union

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def mask_rtsp_url(url: Union[str, int]) -> str:
    """
    Mask credentials in an RTSP URL for safe logging.
    e.g. 'rtsp://admin:secret123@192.168.1.100:554/live'
      -> 'rtsp://admin:***@192.168.1.100:554/live'
    """
    if not isinstance(url, str):
        return str(url)

    pattern = r"(rtsp://[^:]+:)([^@]+)(@.+)"
    return re.sub(pattern, r"\1***\3", url)


class RTSPStreamReader:
    """
    Manages video frame acquisition from RTSP streams, IP cameras, video files, or webcams.

    Parameters
    ----------
    source:
        RTSP URL (str), video file path (str), or webcam device index (int).
    camera_id:
        Identifier for the camera stream.
    reconnect_attempts:
        Maximum consecutive reconnection attempts before declaring stream failure.
    reconnect_delay_sec:
        Delay in seconds between reconnection attempts.
    capture_instance:
        Optional pre-existing cv2.VideoCapture instance (for dependency injection & testing).
    """

    def __init__(
        self,
        source: Union[str, int] = 0,
        camera_id: str = "CAM-01",
        reconnect_attempts: int = 3,
        reconnect_delay_sec: float = 2.0,
        capture_instance: Optional[object] = None,
    ) -> None:
        if reconnect_attempts < 0:
            raise ValueError("reconnect_attempts must be non-negative")
        if reconnect_delay_sec < 0:
            raise ValueError("reconnect_delay_sec must be non-negative")

        self.source = source
        self.camera_id = camera_id.strip() if camera_id else "CAM-01"
        self.reconnect_attempts = reconnect_attempts
        self.reconnect_delay_sec = reconnect_delay_sec

        self._cap = capture_instance
        self._consecutive_failures = 0
        self._total_reconnects = 0

        logger.info(
            "RTSPStreamReader initialized for camera '%s' with source '%s'",
            self.camera_id,
            mask_rtsp_url(self.source),
        )

    def open(self) -> bool:
        """
        Open connection to the video source.

        Returns
        -------
        bool
            True if connection succeeded, False otherwise.
        """
        if self._cap is not None:
            if hasattr(self._cap, "isOpened"):
                return bool(self._cap.isOpened())
            return True

        try:
            logger.info("Connecting to video source: %s", mask_rtsp_url(self.source))
            self._cap = cv2.VideoCapture(self.source)
            if not self._cap.isOpened():
                logger.warning(
                    "Failed to open video source: %s", mask_rtsp_url(self.source)
                )
                return False

            self._consecutive_failures = 0
            logger.info("Successfully connected to source: %s", mask_rtsp_url(self.source))
            return True
        except Exception as exc:
            logger.error("Exception opening video source %s: %s", mask_rtsp_url(self.source), exc)
            return False

    def is_opened(self) -> bool:
        """Check if video capture stream is currently open."""
        if self._cap is None:
            return False
        if hasattr(self._cap, "isOpened"):
            return bool(self._cap.isOpened())
        return True

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Read the next frame from the stream.
        Attempts automatic reconnection if reading fails.

        Returns
        -------
        Tuple[bool, Optional[np.ndarray]]
            (success_flag, frame_array_or_None)
        """
        if not self.is_opened():
            if not self.open():
                return False, None

        try:
            ret, frame = self._cap.read()
            if ret and frame is not None and frame.size > 0:
                self._consecutive_failures = 0
                return True, frame

            logger.warning(
                "Failed to read frame from source '%s'", mask_rtsp_url(self.source)
            )
            self._consecutive_failures += 1
        except Exception as exc:
            logger.warning("Exception reading frame from %s: %s", mask_rtsp_url(self.source), exc)
            self._consecutive_failures += 1

        # Attempt reconnection if failures exceed threshold
        if self._consecutive_failures > 0 and self.reconnect_attempts > 0:
            reconnected = self.reconnect()
            if reconnected:
                try:
                    ret, frame = self._cap.read()
                    if ret and frame is not None and frame.size > 0:
                        self._consecutive_failures = 0
                        return True, frame
                except Exception:
                    pass

        return False, None

    def reconnect(self) -> bool:
        """
        Attempt to release and re-establish connection to the stream.

        Returns
        -------
        bool
            True if reconnected successfully, False if all attempts exhausted.
        """
        self.release()

        for attempt in range(1, self.reconnect_attempts + 1):
            logger.info(
                "Reconnection attempt %d/%d for '%s'...",
                attempt,
                self.reconnect_attempts,
                mask_rtsp_url(self.source),
            )
            if self.reconnect_delay_sec > 0:
                time.sleep(self.reconnect_delay_sec)

            if self.open():
                self._total_reconnects += 1
                logger.info(
                    "Reconnection successful for '%s' on attempt %d",
                    mask_rtsp_url(self.source),
                    attempt,
                )
                return True

        logger.error(
            "All %d reconnection attempts failed for '%s'",
            self.reconnect_attempts,
            mask_rtsp_url(self.source),
        )
        return False

    def release(self) -> None:
        """Release underlying OpenCV VideoCapture resources."""
        if self._cap is not None:
            try:
                if hasattr(self._cap, "release"):
                    self._cap.release()
                logger.debug("Released video capture for %s", mask_rtsp_url(self.source))
            except Exception as exc:
                logger.warning("Error releasing capture for %s: %s", mask_rtsp_url(self.source), exc)
            finally:
                self._cap = None

    @property
    def total_reconnects(self) -> int:
        """Total number of successful reconnections performed."""
        return self._total_reconnects
