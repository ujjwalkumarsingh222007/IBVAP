"""
IBVAP - Member 2 ANPR Module
Package initialisation & Public Integration Interface.

Backend Integration Contract (Member 3):
----------------------------------------
Member 3 should import `process_frame_to_events` or `IBVAPEvent` from this package.
The backend does NOT need to import or configure internal detector, OCR, or preprocessing classes.

Example for Member 3 (FastAPI Event Ingestion):
    from ai.member2_anpr import process_frame_to_events, IBVAPEvent

    # On video frame arrival:
    events: list[IBVAPEvent] = process_frame_to_events(
        frame=cv2_frame,
        camera_id="CAM-01",
        vehicle_id="VEH-102",
    )
    for event in events:
        await backend_event_store.save(event.model_dump())
"""

from __future__ import annotations

from typing import List, Optional
import numpy as np

from .benchmark import ANPRBenchmark, BenchmarkReport, ComponentTiming
from .config import ANPRConfig, default_config
from .detector import BasePlateDetector, MockPlateDetector, YOLOPlateDetector
from .event_generator import ANPREventGenerator
from .ocr import BaseOCREngine, MockOCREngine, EasyOCREngine
from .pipeline import ANPRPipeline
from .preprocessing import PlatePreprocessor
from .recognizer import PlateRecognizer, normalise_plate, validate_indian_plate
from .schemas import (
    ANPRResult,
    EventType,
    IBVAPEvent,
    OCRResult,
    PlateRegion,
    RecognitionResult,
    WatchlistResult,
)
from .suppressor import DuplicateSuppressor
from .watchlist import BaseWatchlistMatcher, InMemoryWatchlistMatcher

# Module-level cached pipeline for convenient zero-config backend ingestion
_DEFAULT_BACKEND_PIPELINE: Optional[ANPRPipeline] = None


def process_frame_to_events(
    frame: np.ndarray,
    camera_id: str = "CAM-01",
    timestamp: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    pipeline: Optional[ANPRPipeline] = None,
    suppress_duplicates: bool = True,
) -> List[IBVAPEvent]:
    """
    High-level integration function for Member 3 (Backend).

    Processes an OpenCV frame and directly returns a list of standardized IBVAPEvents.
    All internal ANPR complexity (detection, OCR, normalisation, watchlist matching, duplicate
    suppression) is handled automatically.

    Parameters
    ----------
    frame:
        OpenCV BGR image as a NumPy uint8 array.
    camera_id:
        Identifier of the camera that captured this frame.
    timestamp:
        Optional ISO-8601 timestamp string (auto-generated if None).
    vehicle_id:
        Optional vehicle tracking identifier passed from Member 1 / CV tracker.
    pipeline:
        Optional custom ANPRPipeline instance. If None, uses a default singleton pipeline.
    suppress_duplicates:
        If True (default), suppresses duplicate events for the same plate within the configured window.

    Returns
    -------
    List[IBVAPEvent]
        List of generated IBVAP events ready for backend database persistence or REST emission.
    """
    global _DEFAULT_BACKEND_PIPELINE

    active_pipeline = pipeline
    if active_pipeline is None:
        if _DEFAULT_BACKEND_PIPELINE is None:
            _DEFAULT_BACKEND_PIPELINE = ANPRPipeline()
        active_pipeline = _DEFAULT_BACKEND_PIPELINE

    results = active_pipeline.process_frame(
        frame=frame,
        camera_id=camera_id,
        timestamp=timestamp,
        vehicle_id=vehicle_id,
    )

    events: List[IBVAPEvent] = []
    for r in results:
        if r.success and r.event is not None:
            if suppress_duplicates and r.duplicate_suppressed:
                continue
            events.append(r.event)

    return events


__all__ = [
    "process_frame_to_events",
    "ANPRPipeline",
    "ANPRConfig",
    "default_config",
    "DuplicateSuppressor",
    "ANPRBenchmark",
    "BenchmarkReport",
    "ComponentTiming",
    "BasePlateDetector",
    "MockPlateDetector",
    "YOLOPlateDetector",
    "BaseOCREngine",
    "MockOCREngine",
    "EasyOCREngine",
    "PlatePreprocessor",
    "PlateRecognizer",
    "normalise_plate",
    "validate_indian_plate",
    "BaseWatchlistMatcher",
    "InMemoryWatchlistMatcher",
    "ANPREventGenerator",
    "ANPRResult",
    "IBVAPEvent",
    "PlateRegion",
    "OCRResult",
    "RecognitionResult",
    "WatchlistResult",
    "EventType",
]

__version__ = "0.4.0"
__author__ = "Member 2 - ANPR Developer"
