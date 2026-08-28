"""
IBVAP - Member 2 ANPR Module
Package initialisation.

Exposes the high-level public interface so that downstream consumers
(Member 3 Backend) only need to import from this package and never
depend on internal implementation details.
"""

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
from .watchlist import BaseWatchlistMatcher, InMemoryWatchlistMatcher

__all__ = [
    "ANPRPipeline",
    "ANPRConfig",
    "default_config",
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

__version__ = "0.3.0"
__author__ = "Member 2 - ANPR Developer"
