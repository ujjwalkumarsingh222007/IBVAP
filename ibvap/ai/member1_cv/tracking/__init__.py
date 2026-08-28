"""
tracking package — Phase 1B: YOLO + ByteTrack object tracking.

Exports ObjectTracker for use by main.py and future pipeline stages.
"""

from .tracker import ObjectTracker

__all__ = ["ObjectTracker"]
