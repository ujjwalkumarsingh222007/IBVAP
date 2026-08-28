"""
detection package — Phase 1A: YOLO-based person & vehicle detection.

Exports the core Detector class for use by main.py and future pipeline stages.
"""

from .detector import Detector, DetectionResult

__all__ = ["Detector", "DetectionResult"]
