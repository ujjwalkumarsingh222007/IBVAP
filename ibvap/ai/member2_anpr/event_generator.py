"""
IBVAP - Member 2 ANPR Module - event_generator.py

Converts ANPR pipeline results into standardised IBVAPEvent objects.

Member 2 generates two event types:
  * ANPR_DETECTED   -- a plate was read successfully (no watchlist hit)
  * WATCHLIST_MATCH -- the plate matched a watchlist entry
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from .schemas import (
    EventType,
    IBVAPEvent,
    RecognitionResult,
    WatchlistResult,
)

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _ensure_timestamp(ts: Optional[str]) -> str:
    if ts and ts.strip():
        return ts.strip()
    generated = _utc_now_iso()
    logger.debug("No timestamp supplied -- using generated UTC: %s", generated)
    return generated


class ANPREventGenerator:
    """
    Produces standardised IBVAPEvent objects from ANPR pipeline results.
    """

    def generate(
        self,
        camera_id: str,
        recognition: RecognitionResult,
        watchlist: WatchlistResult,
        plate_confidence: float,
        timestamp: Optional[str] = None,
    ) -> IBVAPEvent:
        """
        Build an IBVAPEvent from ANPR component results.

        Parameters
        ----------
        camera_id:
            Identifier of the originating camera.
        recognition:
            Output of PlateRecognizer.recognise().
        watchlist:
            Output of BaseWatchlistMatcher.match().
        plate_confidence:
            Confidence from the plate detector (0-1).
        timestamp:
            ISO-8601 string. Auto-generated if None or empty.
        """
        if not camera_id or not camera_id.strip():
            raise ValueError("camera_id must be a non-empty string")

        ts = _ensure_timestamp(timestamp)
        overall_confidence = self._harmonic_mean(plate_confidence, recognition.confidence)

        if watchlist.is_match:
            event_type = EventType.WATCHLIST_MATCH
            logger.warning(
                "WATCHLIST_MATCH event: camera=%s plate=%s status=%s",
                camera_id, recognition.plate_number, watchlist.status,
            )
        else:
            event_type = EventType.ANPR_DETECTED
            logger.info(
                "ANPR_DETECTED event: camera=%s plate=%s conf=%.2f",
                camera_id, recognition.plate_number, overall_confidence,
            )

        metadata = {
            "plate_number": recognition.plate_number,
            "raw_ocr_text": recognition.raw_text,
            "plate_confidence": round(plate_confidence, 4),
            "ocr_confidence": round(recognition.confidence, 4),
            "vehicle_id": None,
            "watchlist_match": watchlist.is_match,
        }

        if watchlist.is_match:
            metadata["watchlist_status"] = watchlist.status
            metadata["watchlist_reason"] = watchlist.reason

        return IBVAPEvent(
            camera_id=camera_id.strip(),
            event_type=event_type,
            timestamp=ts,
            confidence=round(overall_confidence, 4),
            metadata=metadata,
        )

    @staticmethod
    def _harmonic_mean(a: float, b: float) -> float:
        """Compute the harmonic mean of two confidence values."""
        if a <= 0 or b <= 0:
            return 0.0
        return 2 * a * b / (a + b)
