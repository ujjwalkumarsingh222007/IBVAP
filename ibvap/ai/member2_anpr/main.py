"""
IBVAP - Member 2 ANPR Module - main.py

Minimal runnable entry point for the ANPR module.

Run with:
    python -m ai.member2_anpr.main
or:
    python ai/member2_anpr/main.py

Demonstrates the pipeline using mock components and a synthetic test
frame -- no camera, model, or GPU required.
"""

from __future__ import annotations

import logging
import sys

import numpy as np

from .pipeline import ANPRPipeline
from .detector import MockPlateDetector
from .ocr import MockOCREngine
from .recognizer import PlateRecognizer
from .watchlist import InMemoryWatchlistMatcher
from .event_generator import ANPREventGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s -- %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def run_demo() -> None:
    """Run a quick end-to-end demo using mock components."""
    logger.info("=" * 60)
    logger.info("IBVAP - Member 2 ANPR Module - Phase 1 Demo")
    logger.info("=" * 60)

    frame = np.full((480, 640, 3), fill_value=128, dtype=np.uint8)
    logger.info("Synthetic frame: shape=%s  dtype=%s", frame.shape, frame.dtype)

    pipeline = ANPRPipeline(
        detector=MockPlateDetector(confidence=0.90),
        ocr_engine=MockOCREngine(mock_text="TN 09 AB 1234", mock_confidence=0.91),
        recognizer=PlateRecognizer(),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
    )

    results = pipeline.process_frame(
        frame=frame,
        camera_id="CAM-01",
        timestamp="2026-08-28T15:30:00+05:30",
    )

    logger.info("Pipeline returned %d result(s)", len(results))

    for i, result in enumerate(results, start=1):
        logger.info("-" * 40)
        logger.info("Result %d:", i)
        if result.error:
            logger.error("  Error: %s", result.error)
        else:
            logger.info("  Plate number     : %s", result.plate_number)
            logger.info("  Plate confidence : %.2f", result.plate_confidence)
            logger.info("  OCR confidence   : %.2f", result.ocr_confidence)
            logger.info("  Watchlist match  : %s", result.watchlist_match)
            if result.event:
                logger.info("  Event type       : %s", result.event.event_type)
                logger.info("  Event timestamp  : %s", result.event.timestamp)
                logger.info("  Event metadata   : %s", result.event.metadata)

    logger.info("=" * 60)
    logger.info("Demo: watchlist match with plate TN09AB1234")
    logger.info("=" * 60)

    wl_pipeline = ANPRPipeline(
        ocr_engine=MockOCREngine(mock_text="TN09AB1234", mock_confidence=0.95),
    )
    wl_results = wl_pipeline.process_frame(frame=frame, camera_id="CAM-02")

    for result in wl_results:
        if result.event:
            logger.info("  Event type: %s", result.event.event_type)
            logger.info("  Metadata  : %s", result.event.metadata)


if __name__ == "__main__":
    run_demo()
