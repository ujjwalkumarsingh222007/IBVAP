"""
events package — Phase 2B: Complete AI Event Engine.

Exports:
    EventAnalyzer   — stateful detection event analyzer and deduplicator
    AnalyticsEvent  — structured detection event dataclass
    VEHICLE_CLASSES — set of YOLO class names recognized as vehicles
"""

from .analyzer import EventAnalyzer, AnalyticsEvent, VEHICLE_CLASSES

__all__ = ["EventAnalyzer", "AnalyticsEvent", "VEHICLE_CLASSES"]
