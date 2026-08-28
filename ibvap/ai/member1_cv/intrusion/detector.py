"""
detector.py — Phase 1C: Stateful intrusion detector.

Design notes
------------
* IntrusionDetector maintains a per-track-ID state machine:
      OUTSIDE → INSIDE   triggers one IntrusionEvent
      INSIDE  → OUTSIDE  resets state (re-entry later will trigger again)
      INSIDE  → INSIDE   no event (prevents repeated events on same intrusion)

* State is keyed by track_id (int).  Detections without a valid track_id are
  intentionally skipped — they cannot maintain identity across frames.

* IntrusionEvent is a dataclass with an as_dict() method that matches the
  output contract specified in the Phase 1C brief.  It does NOT connect to
  any backend; that belongs to Phase 1D.

* The drawing helper draw_intrusion_overlay() is a static method so it can
  be used in main.py without needing an active detector instance.

Edge cases handled
------------------
- track_id is None         → detection skipped silently
- empty detection list     → process() returns []
- object reappears         → gets fresh state (OUTSIDE) on first sight
- multiple objects         → each track_id has fully independent state
- same object re-enters    → new IntrusionEvent is generated after re-exit
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional

import cv2
import numpy as np

from detection.detector import DetectionResult
from intrusion.fence import VirtualFence, Point


# ---------------------------------------------------------------------------
# Zone state enum
# ---------------------------------------------------------------------------

class ZoneState(Enum):
    """
    The two possible states a tracked object can be in relative to the fence.

    OUTSIDE — object is not inside the restricted polygon.
    INSIDE  — object is currently inside the restricted polygon.
    """
    OUTSIDE = auto()
    INSIDE  = auto()


# ---------------------------------------------------------------------------
# Intrusion event dataclass
# ---------------------------------------------------------------------------

@dataclass
class IntrusionEvent:
    """
    Structured record of a single OUTSIDE→INSIDE transition.

    This is the Phase 1C output contract.  Phase 1D will serialise this
    to CEF and forward it to the FastAPI backend.

    Fields
    ------
    event_type   Always "INTRUSION".
    track_id     ByteTrack track ID of the intruding object.
    class_name   COCO class label (e.g. "person", "car").
    confidence   YOLO detection confidence at the moment of entry.
    timestamp    ISO-8601 UTC timestamp of the frame in which entry occurred.
    bbox         Bounding-box pixel coordinates at the moment of entry.
    position     Bounding-box centre point at the moment of entry.
    """
    event_type: str
    track_id:   int
    class_name: str
    confidence: float
    timestamp:  str
    bbox:       dict        # {x1, y1, x2, y2}
    position:   dict        # {x, y}

    def as_dict(self) -> dict:
        """Return a JSON-serialisable dictionary matching the Phase 1C spec."""
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
# Visual constants
# ---------------------------------------------------------------------------

_INTRUSION_BANNER_COLOUR: tuple = (0, 0, 255)   # red
_INTRUSION_TEXT_COLOUR:   tuple = (255, 255, 255) # white
_INTRUSION_BANNER_H: int = 40


# ---------------------------------------------------------------------------
# Intrusion detector
# ---------------------------------------------------------------------------

class IntrusionDetector:
    """
    Stateful per-track-ID intrusion detector.

    Given a VirtualFence and a list of DetectionResults (with track IDs from
    Phase 1B), process() determines which objects have just crossed from
    OUTSIDE to INSIDE and returns one IntrusionEvent per crossing.

    Parameters
    ----------
    fence : VirtualFence
        The configured restricted zone to monitor.

    Usage
    -----
    Create one IntrusionDetector per video stream.  Call process() on every
    frame with the full detection list.  Collect the returned events.
    """

    def __init__(self, fence: VirtualFence) -> None:
        self.fence = fence
        # Map  track_id → ZoneState
        self._states: Dict[int, ZoneState] = {}

    # ------------------------------------------------------------------
    # Core logic
    # ------------------------------------------------------------------

    def process(
        self,
        detections: List[DetectionResult],
    ) -> List[IntrusionEvent]:
        """
        Evaluate detections against the fence and return new intrusion events.

        Calling convention
        ------------------
        Call once per frame with ALL detections for that frame.
        The method updates internal state and returns events for THIS frame only.

        Parameters
        ----------
        detections : List[DetectionResult]
            Tracked detections from ObjectTracker.track() (Phase 1B output).
            Detections without a valid track_id are silently skipped.

        Returns
        -------
        List[IntrusionEvent]
            Zero or more events.  Typically 0 or 1 per frame; potentially more
            when multiple objects cross simultaneously.
        """
        events: List[IntrusionEvent] = []

        for det in detections:
            # Skip detections without a tracker-assigned identity
            if det.track_id is None:
                continue

            tid = det.track_id

            # Calculate the representative centre point of the bounding box
            center: Point = VirtualFence.bbox_center(
                det.bbox.x1, det.bbox.y1, det.bbox.x2, det.bbox.y2
            )

            inside: bool = self.fence.contains_point(center)
            current_state = ZoneState.INSIDE if inside else ZoneState.OUTSIDE

            # Retrieve previous state; first sighting defaults to OUTSIDE
            previous_state = self._states.get(tid, ZoneState.OUTSIDE)

            # Update stored state
            self._states[tid] = current_state

            # Detect OUTSIDE → INSIDE transition only
            if previous_state == ZoneState.OUTSIDE and current_state == ZoneState.INSIDE:
                event = IntrusionEvent(
                    event_type="INTRUSION",
                    track_id=tid,
                    class_name=det.class_name,
                    confidence=det.confidence,
                    timestamp=_utc_now(),
                    bbox=det.bbox.as_dict(),
                    position={"x": center[0], "y": center[1]},
                )
                events.append(event)

        return events

    def get_state(self, track_id: int) -> Optional[ZoneState]:
        """
        Return the current ZoneState for a given track ID, or None if unknown.

        Useful for rendering (e.g., colour the bounding box red when INSIDE).
        """
        return self._states.get(track_id)

    def is_inside(self, track_id: int) -> bool:
        """
        Return True if the track is currently marked as INSIDE the fence.

        Returns False for unknown track IDs (treat as OUTSIDE by default).
        """
        return self._states.get(track_id) == ZoneState.INSIDE

    def reset(self) -> None:
        """
        Clear all stored track states.

        Call when switching video sources so that leftover states from the
        previous stream do not interfere with the new one.
        """
        self._states.clear()

    # ------------------------------------------------------------------
    # Drawing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def draw_intrusion_overlay(
        frame: np.ndarray,
        events: List[IntrusionEvent],
    ) -> np.ndarray:
        """
        Draw a prominent red INTRUSION banner at the top of the frame when
        there are active events in this frame.

        Parameters
        ----------
        frame : np.ndarray
            BGR image to annotate (modified in-place).
        events : List[IntrusionEvent]
            Events returned by process() for the current frame.

        Returns
        -------
        np.ndarray
        """
        if not events:
            return frame

        # Red banner across the top of the frame
        h, w = frame.shape[:2]
        cv2.rectangle(
            frame,
            (0, 0),
            (w, _INTRUSION_BANNER_H),
            _INTRUSION_BANNER_COLOUR,
            cv2.FILLED,
        )

        # Build summary text: "⚠ INTRUSION!  ID:1 person  ID:3 car"
        ids_text = "  ".join(
            f"ID:{e.track_id} {e.class_name}" for e in events
        )
        banner_text = f"!! INTRUSION !!  {ids_text}"

        cv2.putText(
            frame,
            banner_text,
            (8, _INTRUSION_BANNER_H - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            _INTRUSION_TEXT_COLOUR,
            2,
            cv2.LINE_AA,
        )

        return frame

    @staticmethod
    def draw_zone_status(
        frame: np.ndarray,
        det: DetectionResult,
        inside: bool,
    ) -> np.ndarray:
        """
        Draw a small status badge ("IN ZONE" / "OUTSIDE") below a detection.

        Parameters
        ----------
        frame : np.ndarray
            BGR image to annotate (modified in-place).
        det : DetectionResult
            The detection whose label to augment.
        inside : bool
            Whether the detection is currently inside the fence.

        Returns
        -------
        np.ndarray
        """
        if inside:
            badge   = "IN ZONE"
            colour  = (0, 0, 255)   # red
        else:
            badge   = "OUTSIDE"
            colour  = (0, 200, 0)   # green

        b = det.bbox
        cv2.putText(
            frame,
            badge,
            (b.x1, b.y2 + 16),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            colour,
            1,
            cv2.LINE_AA,
        )
        return frame

    def __repr__(self) -> str:
        return (
            f"IntrusionDetector(fence={self.fence!r}, "
            f"tracked_ids={list(self._states.keys())})"
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
