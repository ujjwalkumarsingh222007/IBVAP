"""
IBVAP - Member 2 ANPR Module
Package initialisation.

Exposes the high-level public interface so that downstream consumers
(Member 3 Backend) only need to import from this package and never
depend on internal implementation details.
"""

from .pipeline import ANPRPipeline
from .schemas import (
    ANPRResult,
    IBVAPEvent,
    PlateRegion,
    OCRResult,
    RecognitionResult,
    WatchlistResult,
    EventType,
)

__all__ = [
    "ANPRPipeline",
    "ANPRResult",
    "IBVAPEvent",
    "PlateRegion",
    "OCRResult",
    "RecognitionResult",
    "WatchlistResult",
    "EventType",
]

__version__ = "0.1.0"
__author__ = "Member 2 - ANPR Developer"
