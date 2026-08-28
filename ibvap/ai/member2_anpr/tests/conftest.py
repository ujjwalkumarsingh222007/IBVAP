"""
Shared test fixtures for the ANPR module test suite.

All fixtures use mock/stub implementations -- no GPU, no real camera,
no external model files, no PostgreSQL, no FastAPI.
"""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.detector import MockPlateDetector
from ai.member2_anpr.event_generator import ANPREventGenerator
from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.recognizer import PlateRecognizer
from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher


@pytest.fixture
def valid_frame() -> np.ndarray:
    """A standard 640x480 BGR frame."""
    return np.full((480, 640, 3), fill_value=128, dtype=np.uint8)


@pytest.fixture
def small_frame() -> np.ndarray:
    return np.zeros((5, 5, 3), dtype=np.uint8)


@pytest.fixture
def empty_frame() -> np.ndarray:
    return np.zeros((0, 0, 3), dtype=np.uint8)


@pytest.fixture
def grayscale_frame() -> np.ndarray:
    return np.full((480, 640), fill_value=200, dtype=np.uint8)


@pytest.fixture
def mock_detector():
    return MockPlateDetector(confidence=0.90)


@pytest.fixture
def mock_ocr():
    return MockOCREngine(mock_text="TN 09 AB 1234", mock_confidence=0.91)


@pytest.fixture
def mock_ocr_watchlist():
    return MockOCREngine(mock_text="TN09AB1234", mock_confidence=0.95)


@pytest.fixture
def mock_ocr_low_confidence():
    return MockOCREngine(mock_text="TN 09 AB 1234", mock_confidence=0.10)


@pytest.fixture
def mock_ocr_empty():
    return MockOCREngine(mock_text="", mock_confidence=0.80)


@pytest.fixture
def recognizer():
    return PlateRecognizer()


@pytest.fixture
def watchlist():
    return InMemoryWatchlistMatcher()


@pytest.fixture
def event_generator():
    return ANPREventGenerator()


@pytest.fixture
def default_pipeline(mock_detector, mock_ocr, recognizer, watchlist, event_generator):
    return ANPRPipeline(
        detector=mock_detector,
        ocr_engine=mock_ocr,
        recognizer=recognizer,
        watchlist=watchlist,
        event_generator=event_generator,
    )


@pytest.fixture
def watchlist_pipeline(mock_detector, mock_ocr_watchlist, recognizer, watchlist, event_generator):
    return ANPRPipeline(
        detector=mock_detector,
        ocr_engine=mock_ocr_watchlist,
        recognizer=recognizer,
        watchlist=watchlist,
        event_generator=event_generator,
    )
