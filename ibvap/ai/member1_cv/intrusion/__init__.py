"""
intrusion package — Phase 1C: Virtual fence + intrusion detection.

Exports:
    VirtualFence       — configurable polygonal restricted zone
    IntrusionDetector  — stateful detector that fires once per entry
    IntrusionEvent     — structured event dataclass
"""

from .fence import VirtualFence
from .detector import IntrusionDetector, IntrusionEvent

__all__ = ["VirtualFence", "IntrusionDetector", "IntrusionEvent"]
