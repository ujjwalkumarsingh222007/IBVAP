"""Tests for the watchlist matcher module."""

from __future__ import annotations

import pytest

from ai.member2_anpr.watchlist import (
    BaseWatchlistMatcher,
    DEFAULT_WATCHLIST,
    InMemoryWatchlistMatcher,
)
from ai.member2_anpr.schemas import WatchlistResult


class TestInMemoryWatchlistMatcher:

    def test_match_known_plate_returns_is_match_true(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("TN09AB1234")
        assert result.is_match is True

    def test_match_known_plate_returns_correct_status(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("TN09AB1234")
        assert result.status == "WATCHLIST"

    def test_match_stolen_plate(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("MH12DE1433")
        assert result.is_match is True
        assert result.status == "STOLEN"

    def test_match_wanted_plate(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("DL3CAM0001")
        assert result.is_match is True
        assert result.status == "WANTED"

    def test_no_match_for_unknown_plate(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("KA05MN9999")
        assert result.is_match is False

    def test_no_match_result_has_plate_number(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("KA05MN9999")
        assert result.plate_number == "KA05MN9999"

    def test_no_match_status_is_none(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("KA05MN9999")
        assert result.status is None

    def test_match_is_case_insensitive(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("tn09ab1234")
        assert result.is_match is True

    def test_match_with_spaces_normalised(self):
        matcher = InMemoryWatchlistMatcher()
        result = matcher.match("  TN09AB1234  ")
        assert result.is_match is True

    def test_empty_plate_raises_value_error(self):
        matcher = InMemoryWatchlistMatcher()
        with pytest.raises(ValueError):
            matcher.match("")

    def test_whitespace_plate_raises_value_error(self):
        matcher = InMemoryWatchlistMatcher()
        with pytest.raises(ValueError):
            matcher.match("   ")

    def test_custom_watchlist_used(self):
        custom = {"GJ01AA0001": {"status": "WANTED", "reason": "Test"}}
        matcher = InMemoryWatchlistMatcher(watchlist=custom)
        result = matcher.match("GJ01AA0001")
        assert result.is_match is True

    def test_custom_watchlist_default_not_present(self):
        custom = {"GJ01AA0001": {"status": "WANTED", "reason": "Test"}}
        matcher = InMemoryWatchlistMatcher(watchlist=custom)
        result = matcher.match("TN09AB1234")
        assert result.is_match is False

    def test_add_entry_and_match(self):
        matcher = InMemoryWatchlistMatcher(watchlist={})
        matcher.add_entry("UP32AB1111", "STOLEN", "Test addition")
        result = matcher.match("UP32AB1111")
        assert result.is_match is True

    def test_remove_entry(self):
        matcher = InMemoryWatchlistMatcher()
        existed = matcher.remove_entry("TN09AB1234")
        assert existed is True
        result = matcher.match("TN09AB1234")
        assert result.is_match is False

    def test_remove_nonexistent_entry_returns_false(self):
        matcher = InMemoryWatchlistMatcher()
        existed = matcher.remove_entry("XXXXXXXXXX")
        assert existed is False

    def test_len_reflects_store_size(self):
        matcher = InMemoryWatchlistMatcher(watchlist={})
        assert len(matcher) == 0
        matcher.add_entry("AA00BB0001", "WATCHLIST")
        assert len(matcher) == 1


def test_base_watchlist_is_abstract():
    with pytest.raises(TypeError):
        BaseWatchlistMatcher()


class TestWatchlistResult:

    def test_default_is_no_match(self):
        r = WatchlistResult(plate_number="AB12CD3456")
        assert r.is_match is False

    def test_match_result(self):
        r = WatchlistResult(plate_number="TN09AB1234", is_match=True, status="WATCHLIST")
        assert r.is_match is True
        assert r.status == "WATCHLIST"
