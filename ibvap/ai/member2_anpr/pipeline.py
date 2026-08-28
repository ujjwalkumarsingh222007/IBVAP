"""
IBVAP - Member 2 ANPR Module - pipeline.py

Top-level ANPR pipeline. Wires together:

    Frame -> BasePlateDetector -> (crop) -> BaseOCREngine
          -> PlateRecognizer -> BaseWatchlistMatcher -> ANPREventGenerator
          -> ANPRResult

Public interface
----------------
    pipeline = ANPRPipeline()
    result   = pipeline.process_frame(frame, camera_id="CAM-01")
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

import numpy as np

from .config import ANPRConfig, default_config
from .detector import BasePlateDetector, MockPlateDetector
from .event_generator import ANPREventGenerator
from .ocr import BaseOCREngine, MockOCREngine
from .recognizer import PlateRecognizer
from .schemas import ANPRResult, PlateRegion, WatchlistResult
from .watchlist import BaseWatchlistMatcher, InMemoryWatchlistMatcher

logger = logging.getLogger(__name__)


def _null_watchlist(plate_number: str) -> WatchlistResult:
    """Return a non-match WatchlistResult when watchlist is unavailable."""
    return WatchlistResult(plate_number=plate_number, is_match=False)


class ANPRPipeline:
    """
    Orchestrates the end-to-end ANPR workflow on a single video frame.

    All components are injected for easy testing and upgrading.

    Parameters
    ----------
    detector:
        Plate detector instance. Defaults to MockPlateDetector.
    ocr_engine:
        OCR engine instance. Defaults to MockOCREngine.
    recognizer:
        Plate recognizer instance. Defaults to PlateRecognizer().
    watchlist:
        Watchlist matcher instance. Defaults to InMemoryWatchlistMatcher.
    event_generator:
        Event generator instance. Defaults to ANPREventGenerator().
    config:
        Runtime configuration. Defaults to module-level default_config.
    """

    def __init__(
        self,
        detector: Optional[BasePlateDetector] = None,
        ocr_engine: Optional[BaseOCREngine] = None,
        recognizer: Optional[PlateRecognizer] = None,
        watchlist: Optional[BaseWatchlistMatcher] = None,
        event_generator: Optional[ANPREventGenerator] = None,
        config: Optional[ANPRConfig] = None,
    ) -> None:
        self._config = config if config is not None else default_config
        self._detector = detector or MockPlateDetector()
        self._ocr = ocr_engine or MockOCREngine()
        self._recognizer = recognizer or PlateRecognizer()
        self._watchlist = watchlist if watchlist is not None else InMemoryWatchlistMatcher()
        self._event_gen = event_generator or ANPREventGenerator()

        logger.info(
            "ANPRPipeline initialised -- detector=%s, ocr=%s",
            type(self._detector).__name__,
            type(self._ocr).__name__,
        )

    def process_frame(
        self,
        frame: np.ndarray,
        camera_id: str = "CAM-01",
        timestamp: Optional[str] = None,
    ) -> List[ANPRResult]:
        """
        Run the full ANPR pipeline on a single frame.

        Parameters
        ----------
        frame:
            OpenCV BGR image as a NumPy uint8 array.
        camera_id:
            Identifier of the camera that produced this frame.
        timestamp:
            ISO-8601 timestamp. Defaults to current UTC time.

        Returns
        -------
        list[ANPRResult]
            One ANPRResult per detected plate region.
            Returns a single result with ``error`` set if the frame is
            invalid or if a fatal error occurs.
            Returns an empty list when no plates are detected (no error).
        """
        validated_camera_id, frame_error = self._validate_inputs(frame, camera_id)
        if frame_error:
            return [ANPRResult(error=frame_error)]

        ts = timestamp or datetime.now(timezone.utc).isoformat()
        results: List[ANPRResult] = []

        try:
            regions: List[PlateRegion] = self._detector.detect(frame)
        except Exception as exc:
            logger.error("Plate detector failed: %s", exc, exc_info=True)
            return [ANPRResult(error=f"Plate detector error: {exc}")]

        if not regions:
            logger.debug("No plate regions detected in frame (camera=%s)", validated_camera_id)
            return []

        for region in regions:
            result = self._process_region(frame, region, validated_camera_id, ts)
            results.append(result)

        return results

    def _validate_inputs(
        self, frame, camera_id: str
    ) -> tuple[str, Optional[str]]:
        if not camera_id or not camera_id.strip():
            return "UNKNOWN", "camera_id must be a non-empty string"

        camera_id = camera_id.strip()

        if frame is None:
            return camera_id, "Frame is None"
        if not isinstance(frame, np.ndarray):
            return camera_id, f"Frame must be a NumPy ndarray, got {type(frame).__name__}"
        if frame.size == 0:
            return camera_id, "Frame is empty (zero-size array)"
        if frame.ndim not in (2, 3):
            return camera_id, f"Frame must be 2-D or 3-D; got {frame.ndim}-D"

        return camera_id, None

    def _process_region(
        self,
        frame: np.ndarray,
        region: PlateRegion,
        camera_id: str,
        timestamp: str,
    ) -> ANPRResult:
        """Process one detected plate region and return an ANPRResult."""
        try:
            plate_img = self._crop_plate(frame, region)
        except Exception as exc:
            logger.warning("Failed to crop plate region %s: %s", region, exc)
            return ANPRResult(error=f"Crop error: {exc}")

        try:
            ocr_result = self._ocr.read(plate_img)
        except Exception as exc:
            logger.warning("OCR failed for region %s: %s", region, exc)
            return ANPRResult(error=f"OCR error: {exc}")

        if not ocr_result.raw_text.strip():
            logger.warning("OCR returned empty text for region %s", region)
            return ANPRResult(error="OCR returned empty text")

        try:
            recognition = self._recognizer.recognise(ocr_result)
        except Exception as exc:
            logger.warning("Recognition failed: %s", exc)
            return ANPRResult(error=f"Recognition error: {exc}")

        if recognition is None:
            return ANPRResult(error="Recognition rejected OCR output (low confidence or invalid format)")

        try:
            watchlist_result = self._watchlist.match(recognition.plate_number)
        except Exception as exc:
            logger.warning("Watchlist lookup failed: %s", exc)
            watchlist_result = None

        try:
            event = self._event_gen.generate(
                camera_id=camera_id,
                recognition=recognition,
                watchlist=watchlist_result if watchlist_result else _null_watchlist(recognition.plate_number),
                plate_confidence=region.confidence,
                timestamp=timestamp,
            )
        except Exception as exc:
            logger.error("Event generation failed: %s", exc, exc_info=True)
            return ANPRResult(error=f"Event generation error: {exc}")

        return ANPRResult(
            plate_number=recognition.plate_number,
            plate_confidence=region.confidence,
            ocr_confidence=recognition.confidence,
            watchlist_match=watchlist_result.is_match if watchlist_result else False,
            watchlist_status=watchlist_result.status if watchlist_result else None,
            watchlist_reason=watchlist_result.reason if watchlist_result else None,
            event=event,
        )

    @staticmethod
    def _crop_plate(frame: np.ndarray, region: PlateRegion) -> np.ndarray:
        h, w = frame.shape[:2]
        x1 = max(0, region.x1)
        y1 = max(0, region.y1)
        x2 = min(w, region.x2)
        y2 = min(h, region.y2)

        if x2 <= x1 or y2 <= y1:
            raise ValueError(
                f"Invalid crop region after clamping: ({x1},{y1})-({x2},{y2})"
            )

        return frame[y1:y2, x1:x2]
