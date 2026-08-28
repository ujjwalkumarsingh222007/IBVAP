"""
analyzer.py — Phase 2B: AI Event Engine for person, vehicle, and object analytics.

Responsibility
--------------
* Analyzes frame-by-frame tracked detections from ByteTrack (Phase 1B).
* Classifies detections into domain events:
    - PERSON_DETECTED    (when class_name is "person")
    - VEHICLE_DETECTED   (when class_name is "car", "motorcycle", "bus", "truck")
    - OBJECT_DETECTED    (any other supported YOLO object class)
* Deduplicates events per track_id: emits exactly ONE event when a track first
  appears, and suppresses duplicate events on subsequent frames while the track
  remains active.
* Manages track lifecycle: cleans up state when a track disappears, so future
  re-appearances can trigger fresh events.
* Produces structured AnalyticsEvent objects ready for transmission via EventClient.

Design rules
------------
* Independent of OpenCV video loop, GUI, YOLO inference, and database/FastAPI.
* Missing track_id (None) is safely skipped without generating events or crashing.
* Fully unit-testable in memory with synthetic detections.
"""

from __future__ import annotations

from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

from detection.detector import DetectionResult

# ---------------------------------------------------------------------------
# Supported Vehicle Classes
# ---------------------------------------------------------------------------

VEHICLE_CLASSES: Set[str] = {
    "car",
    "motorcycle",
    "bus",
    "truck",
}


# ---------------------------------------------------------------------------
# Event Dataclass
# ---------------------------------------------------------------------------

@dataclass
class AnalyticsEvent:
    """
    Structured record of a person, vehicle, or generic object detection event.

    Compatible with EventClient.build_payload() and EventClient.send().

    Fields
    ------
    event_type   PERSON_DETECTED, VEHICLE_DETECTED, or OBJECT_DETECTED
    track_id     Persistent ByteTrack integer ID
    class_name   YOLO class label (e.g. "person", "car", "backpack")
    confidence   Detection confidence (0.0 – 1.0)
    timestamp    ISO-8601 UTC timestamp string
    bbox         Bounding box coordinates dict {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    position     Bounding box center {"x": cx, "y": cy}
    """
    event_type: str
    track_id:   int
    class_name: str
    confidence: float
    timestamp:  str
    bbox:       Dict[str, int]
    position:   Dict[str, int]

    def as_dict(self) -> Dict[str, Any]:
        """Return a JSON-serializable dictionary matching the IBVAP contract."""
        return {
            "event_type": self.event_type,
            "track_id":   self.track_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "timestamp":  self.timestamp,
            "bbox":       self.bbox,
            "position":   self.position,
        }


# ---------------------------------------------------------------------------
# Event Analyzer Engine
# ---------------------------------------------------------------------------

class EventAnalyzer:
    """
    Stateful event engine that converts tracked detections into deduplicated
    analytics events (PERSON_DETECTED, VEHICLE_DETECTED, OBJECT_DETECTED).

    Maintains active track lifecycle to ensure that:
    1. Each track generates an event once upon first appearance.
    2. Ongoing frames with the same track do not produce duplicate events.
    3. Disappeared tracks are cleaned up from internal state.
    """

    def __init__(self) -> None:
        # Set of currently active track IDs seen in the previous/current cycle
        self._active_tracks: Set[int] = set()

    # ------------------------------------------------------------------
    # Classification Helper
    # ------------------------------------------------------------------

    @staticmethod
    def classify_event_type(class_name: str) -> str:
        """
        Map a YOLO class name to its corresponding IBVAP event type.

        Parameters
        ----------
        class_name : str
            YOLO detection class name.

        Returns
        -------
        str : "PERSON_DETECTED", "VEHICLE_DETECTED", or "OBJECT_DETECTED"
        """
        norm_class = class_name.lower().strip()
        if norm_class == "person":
            return "PERSON_DETECTED"
        elif norm_class in VEHICLE_CLASSES:
            return "VEHICLE_DETECTED"
        else:
            return "OBJECT_DETECTED"

    # ------------------------------------------------------------------
    # Core Processing
    # ------------------------------------------------------------------

    def process(self, detections: List[DetectionResult]) -> List[AnalyticsEvent]:
        """
        Analyze current frame detections and emit new analytics events for newly
        appeared tracks.

        Parameters
        ----------
        detections : List[DetectionResult]
            List of detections from ObjectTracker.track().

        Returns
        -------
        List[AnalyticsEvent]
            Newly triggered events for this frame.
        """
        # 1. Collect all valid track IDs present in the current frame
        current_track_ids: Set[int] = {
            det.track_id for det in detections if det.track_id is not None
        }

        # 2. Track lifecycle: remove disappeared tracks so re-entry creates fresh events
        self._active_tracks.intersection_update(current_track_ids)

        new_events: List[AnalyticsEvent] = []

        # 3. Process each detection
        for det in detections:
            # Skip detections without valid tracking ID
            if det.track_id is None:
                continue

            tid = det.track_id

            # Deduplication: emit event only on first sighting of this track_id
            if tid not in self._active_tracks:
                self._active_tracks.add(tid)

                event_type = self.classify_event_type(det.class_name)
                center_x = (det.bbox.x1 + det.bbox.x2) // 2
                center_y = (det.bbox.y1 + det.bbox.y2) // 2

                event = AnalyticsEvent(
                    event_type=event_type,
                    track_id=tid,
                    class_name=det.class_name,
                    confidence=det.confidence,
                    timestamp=_utc_now(),
                    bbox=det.bbox.as_dict(),
                    position={"x": center_x, "y": center_y},
                )
                new_events.append(event)

        return new_events

    def is_track_active(self, track_id: int) -> bool:
        """Return True if track_id is currently tracked as active."""
        return track_id in self._active_tracks

    def reset(self) -> None:
        """Clear all stored active tracks (e.g. when video resets or switches source)."""
        self._active_tracks.clear()

    def __repr__(self) -> str:
        return f"EventAnalyzer(active_tracks={len(self._active_tracks)})"


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _utc_now() -> str:
    """Return the current UTC timestamp as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()
