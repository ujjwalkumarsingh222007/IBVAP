"""
IBVAP - Member 2 ANPR Module - watchlist.py

Watchlist matching abstraction layer.

Architecture
------------
BaseWatchlistMatcher
    |-- InMemoryWatchlistMatcher   (dict-backed - Phase 1 / testing)
    |-- [future] PostgresWatchlistMatcher  (Member 3 integration)
"""

from __future__ import annotations

import abc
import logging
from typing import Dict, Optional

from .schemas import WatchlistResult

logger = logging.getLogger(__name__)

WatchlistStore = Dict[str, Dict[str, str]]


DEFAULT_WATCHLIST: WatchlistStore = {
    "TN09AB1234": {
        "status": "WATCHLIST",
        "reason": "Sample watchlist entry for testing",
    },
    "MH12DE1433": {
        "status": "STOLEN",
        "reason": "Reported stolen - 2026-01-15",
    },
    "DL3CAM0001": {
        "status": "WANTED",
        "reason": "Associated with border violation case #BV-2026-007",
    },
}


class BaseWatchlistMatcher(abc.ABC):
    """Abstract base class for watchlist matcher implementations."""

    @abc.abstractmethod
    def match(self, plate_number: str) -> WatchlistResult:
        """
        Check whether *plate_number* appears on the watchlist.

        Returns
        -------
        WatchlistResult
            Always returns a result object.
            ``is_match=False`` means the plate is not on the watchlist.

        Raises
        ------
        ValueError
            If *plate_number* is empty or None.
        """

    def _validate_plate(self, plate_number: Optional[str]) -> str:
        if not plate_number or not plate_number.strip():
            raise ValueError("plate_number must be a non-empty string")
        return plate_number.strip().upper()


class InMemoryWatchlistMatcher(BaseWatchlistMatcher):
    """
    Simple in-memory watchlist backed by a Python dict.

    Parameters
    ----------
    watchlist:
        Mapping of plate_number -> {status, reason}.
        Defaults to DEFAULT_WATCHLIST if None.
    """

    def __init__(self, watchlist: Optional[WatchlistStore] = None) -> None:
        self._store: WatchlistStore = (
            dict(watchlist) if watchlist is not None else dict(DEFAULT_WATCHLIST)
        )
        logger.debug(
            "InMemoryWatchlistMatcher initialised with %d entries", len(self._store)
        )

    def match(self, plate_number: str) -> WatchlistResult:
        """Return a WatchlistResult indicating whether the plate is listed."""
        normalised = self._validate_plate(plate_number)
        entry = self._store.get(normalised)

        if entry:
            logger.info("WATCHLIST HIT: %s - status=%s", normalised, entry.get("status"))
            return WatchlistResult(
                plate_number=normalised,
                is_match=True,
                status=entry.get("status"),
                reason=entry.get("reason"),
            )

        logger.debug("Watchlist: no match for %s", normalised)
        return WatchlistResult(plate_number=normalised, is_match=False)

    def add_entry(self, plate_number: str, status: str, reason: str = "") -> None:
        """Dynamically add an entry (useful for integration tests)."""
        key = plate_number.strip().upper()
        self._store[key] = {"status": status, "reason": reason}

    def remove_entry(self, plate_number: str) -> bool:
        """Remove an entry. Returns True if the entry existed."""
        key = plate_number.strip().upper()
        existed = key in self._store
        self._store.pop(key, None)
        return existed

    def __len__(self) -> int:
        return len(self._store)
