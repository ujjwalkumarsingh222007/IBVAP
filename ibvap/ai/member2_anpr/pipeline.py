"""
IBVAP - Member 2 ANPR Module - pipeline.py

Top-level ANPR pipeline. Wires together:

    Frame -> BasePlateDetector -> (crop) -> BaseOCREngine
          -> PlateRecognizer -> BaseWatchlistMatcher -> DuplicateSuppressor
          -> ANPREventGenerator -> ANPRResult

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
from .suppressor import DuplicateSuppressor
from .watchlist import BaseWatchlistMatcher, InMemoryWatchlistMatcher

logger = logging.getLogger(__name__)


def _null_watchlist(plate_number: str) -> WatchlistResult:
    """Return a non-match WatchlistResult when watchlist is unavailable."""
    return WatchlistResult(plate_number=plate_number, is_match=False)


class ANPRPipeline:
    """
    Orchestrates the end-to-end ANPR workflow on a video frame.

    All components are injected for easy testing, swappability, and upgrades.
    """

    def __init__(
        self,
        detector: Optional[BasePlateDetector] = None,
        ocr_engine: Optional[BaseOCREngine] = None,
        recognizer: Optional[PlateRecognizer] = None,
        watchlist: Optional[BaseWatchlistMatcher] = None,
        event_generator: Optional[ANPREventGenerator] = None,
        duplicate_suppressor: Optional[DuplicateSuppressor] = None,
        config: Optional[ANPRConfig] = None,
    ) -> None:
        self._config = config if config is not None else default_config
        self._detector = detector if detector is not None else MockPlateDetector()
        self._ocr = ocr_engine if ocr_engine is not None else MockOCREngine()
        self._recognizer = recognizer if recognizer is not None else PlateRecognizer()
        self._watchlist = watchlist if watchlist is not None else InMemoryWatchlistMatcher()
        self._event_gen = event_generator if event_generator is not None else ANPREventGenerator()

        # Initialize duplicate suppressor from config if not injected
        if duplicate_suppressor is not None:
            self._suppressor = duplicate_suppressor
        elif self._config.duplicate_suppression_enabled:
            self._suppressor = DuplicateSuppressor(
                window_seconds=self._config.duplicate_suppression_window_seconds,
                enabled=True,
            )
        else:
            self._suppressor = None

        logger.info(
            "[ANPR DEBUG] pipeline initialized -- detector=%s, ocr=%s, suppression=%s",
            type(self._detector).__name__,
            type(self._ocr).__name__,
            "ENABLED" if self._suppressor and self._suppressor.enabled else "DISABLED",
        )

    def process_frame(
        self,
        frame: np.ndarray,
        camera_id: str = "CAM-01",
        timestamp: Optional[str] = None,
        vehicle_id: Optional[str] = None,
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
        vehicle_id:
            Optional identifier of associated vehicle (from Member 1 / tracker).

        Returns
        -------
        list[ANPRResult]
            One ANPRResult per detected plate region.
        """
        validated_camera_id, frame_error = self._validate_inputs(frame, camera_id)
        if frame_error:
            logger.warning("[ANPR DEBUG] frame validation error: %s", frame_error)
            return [ANPRResult(error=frame_error, vehicle_id=vehicle_id)]

        ts = timestamp or datetime.now(timezone.utc).isoformat()
        logger.info(
            "[ANPR DEBUG] frame shape=%s, camera_id=%s, timestamp=%s",
            frame.shape if isinstance(frame, np.ndarray) else None,
            validated_camera_id,
            ts,
        )
        logger.info("[ANPR DEBUG] detector type=%s", type(self._detector).__name__)

        results: List[ANPRResult] = []

        try:
            regions: List[PlateRegion] = self._detector.detect(frame)
        except Exception as exc:
            logger.error("[ANPR DEBUG] Plate detector failed: %s", exc, exc_info=True)
            return [ANPRResult(error=f"Plate detector error: {exc}", vehicle_id=vehicle_id)]

        logger.info("[ANPR DEBUG] plate regions count=%d, regions=%s", len(regions), regions)

        if not regions:
            logger.debug("[ANPR DEBUG] No plate regions detected in frame (camera=%s)", validated_camera_id)
            return []

        for region in regions:
            result = self._process_region(frame, region, validated_camera_id, ts, vehicle_id)
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
        vehicle_id: Optional[str] = None,
    ) -> ANPRResult:
        """Process one detected plate region and return an ANPRResult."""
        try:
            plate_img = self._crop_plate(frame, region)
        except Exception as exc:
            logger.warning("[ANPR DEBUG] Failed to crop plate region %s: %s", region, exc)
            return ANPRResult(error=f"Crop error: {exc}", vehicle_id=vehicle_id)

        try:
            ocr_result = self._ocr.read(plate_img)
        except Exception as exc:
            logger.warning("[ANPR DEBUG] OCR failed for region %s: %s", region, exc)
            return ANPRResult(error=f"OCR error: {exc}", vehicle_id=vehicle_id)

        logger.info("[ANPR DEBUG] OCR text=%r, confidence=%.4f", ocr_result.raw_text, ocr_result.confidence)

        if not ocr_result.raw_text.strip():
            logger.warning("[ANPR DEBUG] OCR returned empty text for region %s", region)
            return ANPRResult(error="OCR returned empty text", vehicle_id=vehicle_id)

        try:
            recognition = self._recognizer.recognise(ocr_result)
        except Exception as exc:
            logger.warning("[ANPR DEBUG] Recognition failed: %s", exc)
            return ANPRResult(error=f"Recognition error: {exc}", vehicle_id=vehicle_id)

        if recognition is None:
            logger.warning("[ANPR DEBUG] Recognition rejected OCR output: %r", ocr_result.raw_text)
            return ANPRResult(
                error="Recognition rejected OCR output (low confidence or invalid format)",
                vehicle_id=vehicle_id,
            )

        logger.info(
            "[ANPR DEBUG] recognized plate=%r, valid=%s, reason=%s",
            recognition.plate_number,
            recognition.validation_passed,
            recognition.validation_reason,
        )

        try:
            watchlist_result = self._watchlist.match(recognition.plate_number)
        except Exception as exc:
            logger.warning("[ANPR DEBUG] Watchlist lookup failed: %s", exc)
            watchlist_result = None

        # Check duplicate event suppression
        is_suppressed = False
        if self._suppressor is not None:
            is_suppressed = self._suppressor.should_suppress(
                camera_id=camera_id,
                plate_number=recognition.plate_number,
            )

        logger.info(
            "[ANPR DEBUG] duplicate_suppressed=%s for plate=%s on camera=%s",
            is_suppressed,
            recognition.plate_number,
            camera_id,
        )

        bbox_dict = {"x1": region.x1, "y1": region.y1, "x2": region.x2, "y2": region.y2}

        try:
            event = self._event_gen.generate(
                camera_id=camera_id,
                recognition=recognition,
                watchlist=watchlist_result if watchlist_result else _null_watchlist(recognition.plate_number),
                plate_confidence=region.confidence,
                timestamp=timestamp,
                vehicle_id=vehicle_id,
                bbox=region,
            )
            if is_suppressed and event is not None:
                event.metadata["duplicate_suppressed"] = True
        except Exception as exc:
            logger.error("[ANPR DEBUG] Event generation failed: %s", exc, exc_info=True)
            return ANPRResult(error=f"Event generation error: {exc}", vehicle_id=vehicle_id)

        logger.info(
            "[ANPR DEBUG] event_type=%s, watchlist_match=%s",
            event.event_type if event else None,
            watchlist_result.is_match if watchlist_result else False,
        )

        return ANPRResult(
            plate_number=recognition.plate_number,
            plate_confidence=region.confidence,
            ocr_confidence=recognition.confidence,
            bbox=bbox_dict,
            vehicle_id=vehicle_id,
            watchlist_match=watchlist_result.is_match if watchlist_result else False,
            watchlist_status=watchlist_result.status if watchlist_result else None,
            watchlist_reason=watchlist_result.reason if watchlist_result else None,
            duplicate_suppressed=is_suppressed,
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
