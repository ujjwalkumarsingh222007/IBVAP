"""
IBVAP - Member 2 ANPR Module - suppressor.py

Lightweight in-memory duplicate event suppression for continuous video streams.
Prevents event flooding when the same vehicle/plate is detected across consecutive frames.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class DuplicateSuppressor:
    """
    In-memory, thread-safe duplicate event suppression.

    Tracks the timestamp of the most recent event for each (camera_id, normalized_plate) pair.
    If a subsequent detection occurs within `window_seconds`, it is considered a duplicate.

    Parameters
    ----------
    window_seconds:
        Duration in seconds within which repeated detections of the same plate are suppressed.
    enabled:
        Master switch to enable or disable suppression (default True).
    """

    def __init__(
        self,
        window_seconds: float = 10.0,
        enabled: bool = True,
    ) -> None:
        if window_seconds < 0:
            raise ValueError("window_seconds must be non-negative")

        self.window_seconds = float(window_seconds)
        self.enabled = bool(enabled)
        self._cache: Dict[Tuple[str, str], float] = {}
        self._lock = threading.Lock()

        logger.debug(
            "DuplicateSuppressor initialized (window=%.1fs, enabled=%s)",
            self.window_seconds,
            self.enabled,
        )

    def should_suppress(
        self,
        camera_id: str,
        plate_number: str,
        timestamp_sec: Optional[float] = None,
    ) -> bool:
        """
        Check if an event for (camera_id, plate_number) should be suppressed.
        If NOT suppressed, records the current timestamp.

        Parameters
        ----------
        camera_id:
            Originating camera identifier.
        plate_number:
            Normalized plate string (e.g. 'TN09AB1234').
        timestamp_sec:
            Optional epoch timestamp in seconds. Defaults to time.time().

        Returns
        -------
        bool
            True if this detection is a duplicate within the suppression window, False otherwise.
        """
        if not self.enabled or self.window_seconds <= 0:
            return False

        if not camera_id or not plate_number:
            return False

        now = timestamp_sec if timestamp_sec is not None else time.time()
        key = (camera_id.strip().upper(), plate_number.strip().upper())

        with self._lock:
            last_seen = self._cache.get(key)
            if last_seen is not None and (now - last_seen) < self.window_seconds:
                logger.debug(
                    "Duplicate suppressed for plate %s on %s (%.2fs < %.1fs)",
                    plate_number,
                    camera_id,
                    now - last_seen,
                    self.window_seconds,
                )
                return True

            self._cache[key] = now
            return False

    def is_duplicate(
        self,
        camera_id: str,
        plate_number: str,
        timestamp_sec: Optional[float] = None,
    ) -> bool:
        """
        Query whether an event would be considered a duplicate without updating the cache.
        """
        if not self.enabled or self.window_seconds <= 0:
            return False

        if not camera_id or not plate_number:
            return False

        now = timestamp_sec if timestamp_sec is not None else time.time()
        key = (camera_id.strip().upper(), plate_number.strip().upper())

        with self._lock:
            last_seen = self._cache.get(key)
            if last_seen is not None and (now - last_seen) < self.window_seconds:
                return True
            return False

    def record(
        self,
        camera_id: str,
        plate_number: str,
        timestamp_sec: Optional[float] = None,
    ) -> None:
        """Explicitly record a detection timestamp."""
        if not camera_id or not plate_number:
            return

        now = timestamp_sec if timestamp_sec is not None else time.time()
        key = (camera_id.strip().upper(), plate_number.strip().upper())

        with self._lock:
            self._cache[key] = now

    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self, current_time_sec: Optional[float] = None) -> int:
        """
        Remove entries older than window_seconds to bound memory consumption.

        Returns
        -------
        int
            Count of evicted entries.
        """
        now = current_time_sec if current_time_sec is not None else time.time()
        evicted = 0

        with self._lock:
            expired_keys = [
                k for k, last_seen in self._cache.items()
                if (now - last_seen) >= self.window_seconds
            ]
            for k in expired_keys:
                del self._cache[k]
                evicted += 1

        if evicted:
            logger.debug("DuplicateSuppressor cleaned up %d expired entries", evicted)
        return evicted

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)
