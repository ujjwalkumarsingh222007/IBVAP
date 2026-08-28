"""
fence.py — Phase 1C: Configurable polygonal virtual fence.

Design notes
------------
* VirtualFence is a pure geometric component — it has NO knowledge of YOLO,
  ByteTrack, or OpenCV's video loop.  This keeps it fully unit-testable
  without any model or camera.

* Containment test uses cv2.pointPolygonTest() which implements a standard
  winding-number / ray-cast algorithm and handles concave polygons correctly.

* Drawing helpers are separate static methods so the same fence can be
  rendered by main.py without coupling the geometry to the display.

* The polygon is stored as a numpy array of shape (N, 1, 2) which is the
  format expected by OpenCV drawing functions.

Phase 1D hook
-------------
VirtualFence has no backend coupling.  Phase 1D will forward IntrusionEvents
(built by IntrusionDetector) to the backend — the fence itself stays as-is.
"""

from __future__ import annotations

from typing import List, Sequence, Tuple

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

Point = Tuple[int, int]          # (x, y) pixel coordinate
Polygon = List[Point]            # ordered list of vertices


# ---------------------------------------------------------------------------
# Default fence polygon
# ---------------------------------------------------------------------------

# A rectangular zone in the centre of a typical 1280×720 or 640×480 frame.
# Change these coordinates to match the actual restricted area in your scene.
# Coordinates are (x, y) pixel positions.
DEFAULT_FENCE_POLYGON: Polygon = [
    (200, 100),
    (600, 100),
    (600, 400),
    (200, 400),
]

# Visual style constants
_FENCE_COLOUR_NORMAL:    Tuple[int, int, int] = (0, 165, 255)   # orange
_FENCE_COLOUR_INTRUSION: Tuple[int, int, int] = (0,   0, 255)   # red
_FENCE_FILL_ALPHA: float = 0.15   # polygon overlay transparency
_FENCE_LINE_THICKNESS: int = 2


class VirtualFence:
    """
    A configurable polygonal restricted zone.

    Parameters
    ----------
    polygon : Polygon
        Ordered list of (x, y) vertices that define the boundary.
        Minimum 3 vertices required.

    Raises
    ------
    ValueError
        If fewer than 3 vertices are provided.

    Examples
    --------
    >>> fence = VirtualFence([(100, 100), (400, 100), (400, 350), (100, 350)])
    >>> fence.contains_point((250, 200))
    True
    >>> fence.contains_point((50, 50))
    False
    """

    def __init__(self, polygon: Polygon = DEFAULT_FENCE_POLYGON) -> None:
        if len(polygon) < 3:
            raise ValueError(
                f"A fence polygon requires at least 3 vertices; got {len(polygon)}."
            )
        self._polygon: Polygon = list(polygon)
        # Pre-compute the numpy contour array used by cv2 functions
        self._contour: np.ndarray = _to_contour(polygon)

    # ------------------------------------------------------------------
    # Geometry
    # ------------------------------------------------------------------

    def contains_point(self, point: Point) -> bool:
        """
        Return True if *point* is strictly inside or on the boundary of the
        restricted polygon.

        Uses ``cv2.pointPolygonTest`` which handles convex and concave polygons.

        Parameters
        ----------
        point : (x, y)
            Pixel coordinate to test.

        Returns
        -------
        bool
        """
        # measureDist=False → returns +1 inside, -1 outside, 0 on boundary.
        result = cv2.pointPolygonTest(
            self._contour,
            (float(point[0]), float(point[1])),
            measureDist=False,
        )
        return result >= 0   # inside or on boundary

    @staticmethod
    def bbox_center(x1: int, y1: int, x2: int, y2: int) -> Point:
        """
        Return the centre pixel of a bounding box.

        This is the canonical representative point used for fence-containment
        checks throughout Phase 1C.

        Parameters
        ----------
        x1, y1 : int  Top-left corner.
        x2, y2 : int  Bottom-right corner.

        Returns
        -------
        (cx, cy) : Point
        """
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    @property
    def polygon(self) -> Polygon:
        """Return a copy of the fence polygon vertex list."""
        return list(self._polygon)

    # ------------------------------------------------------------------
    # Drawing helpers
    # ------------------------------------------------------------------

    def draw(
        self,
        frame: np.ndarray,
        intrusion_active: bool = False,
    ) -> np.ndarray:
        """
        Overlay the fence polygon onto *frame* (modifies in-place).

        Parameters
        ----------
        frame : np.ndarray
            BGR image to draw on.
        intrusion_active : bool
            When True the fence is drawn in red to signal an active intrusion.

        Returns
        -------
        np.ndarray
            The same frame with the overlay drawn.
        """
        colour = _FENCE_COLOUR_INTRUSION if intrusion_active else _FENCE_COLOUR_NORMAL

        # Semi-transparent fill
        overlay = frame.copy()
        cv2.fillPoly(overlay, [self._contour], colour)
        cv2.addWeighted(overlay, _FENCE_FILL_ALPHA, frame, 1 - _FENCE_FILL_ALPHA, 0, frame)

        # Solid border
        cv2.polylines(
            frame,
            [self._contour],
            isClosed=True,
            color=colour,
            thickness=_FENCE_LINE_THICKNESS,
        )

        # Label in the top-left corner of the bounding rect
        br_x, br_y, br_w, br_h = cv2.boundingRect(self._contour)
        label = "RESTRICTED ZONE"
        cv2.putText(
            frame,
            label,
            (br_x + 4, br_y + 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            colour,
            2,
            cv2.LINE_AA,
        )

        return frame

    @staticmethod
    def draw_center_point(
        frame: np.ndarray,
        point: Point,
        inside: bool,
    ) -> np.ndarray:
        """
        Draw the representative centre point of a tracked object.

        Green dot when outside, red dot when inside the fence.
        """
        dot_colour = (0, 0, 255) if inside else (0, 255, 0)
        cv2.circle(frame, point, radius=4, color=dot_colour, thickness=-1)
        return frame

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f"VirtualFence(vertices={len(self._polygon)}, polygon={self._polygon})"


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _to_contour(polygon: Polygon) -> np.ndarray:
    """Convert a list of (x, y) tuples to an OpenCV contour array."""
    return np.array(polygon, dtype=np.int32).reshape((-1, 1, 2))
