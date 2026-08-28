"""
event_client.py — Phase 1D: IBVAP Common Event HTTP adapter.

Responsibility
--------------
* Convert a Phase 1C IntrusionEvent into the IBVAP Common Event JSON schema.
* POST it to the Member 3 backend endpoint.
* Handle HTTP success (2xx) and all error conditions without crashing the
  CV pipeline.

Design rules
------------
* Uses Python's built-in ``urllib.request`` — no new third-party dependency.
* Does NOT import FastAPI, SQLAlchemy, or any backend module.
* Does NOT import OpenCV or YOLO.
* Is completely testable with mocking — no real network needed in tests.
* The caller (main.py) decides whether to call send(); the adapter never
  triggers itself.

Common Event schema (IBVAP contract)
-------------------------------------
POST /api/v1/events
Content-Type: application/json

{
  "camera_id":  "CAM-01",
  "event_type": "INTRUSION_DETECTED",
  "timestamp":  "2026-08-28T10:00:00Z",
  "confidence": 0.94,
  "metadata": {
    "track_id":  17,
    "class_name": "person",
    "bbox":      [120, 80, 300, 450],
    "position":  {"x": 210, "y": 265}
  }
}

Phase 1D does NOT implement:
  - authentication / JWT / API keys
  - retry queues (Redis / Kafka)
  - database storage
  - per-frame event spam (Phase 1C already prevents duplicates)
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Module-level logger
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_BACKEND_URL:  str   = "http://127.0.0.1:8000"
EVENTS_ENDPOINT:      str   = "/api/v1/events"
DEFAULT_CAMERA_ID:    str   = "CAM-01"
DEFAULT_TIMEOUT_SECS: float = 5.0          # max seconds to wait for a response

# Map Phase 1C internal event type → IBVAP Common Event type
_EVENT_TYPE_MAP: Dict[str, str] = {
    "INTRUSION": "INTRUSION_DETECTED",
}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class SendResult:
    """
    Lightweight result returned by EventClient.send().

    Attributes
    ----------
    success : bool
        True when the backend returned a 2xx HTTP status.
    status_code : int or None
        The HTTP response status code, or None when no response was received
        (e.g. connection refused, timeout).
    message : str
        Human-readable description of the outcome.
    response_body : str or None
        Raw response body text, if any.  The caller may log/inspect it but
        must not hard-code assumptions about its structure.
    """
    success:       bool
    status_code:   Optional[int]
    message:       str
    response_body: Optional[str] = None


# ---------------------------------------------------------------------------
# EventClient
# ---------------------------------------------------------------------------

class EventClient:
    """
    HTTP client that forwards IBVAP intrusion events to the backend.

    Parameters
    ----------
    backend_url : str
        Base URL of Member 3's backend, e.g. ``"http://127.0.0.1:8000"``.
        The events endpoint (``/api/v1/events``) is appended automatically.
    camera_id : str
        Identifier for the camera/stream that generated the event.
        Included in every request as ``camera_id``.
    timeout : float
        Maximum seconds to wait for a backend response before giving up.
        Prevents the CV processing loop from hanging indefinitely.

    Usage
    -----
    Instantiate once per run::

        client = EventClient(camera_id="CAM-01")

    Call on every new IntrusionEvent (Phase 1C guarantees no duplicates)::

        result = client.send(intrusion_event)
        if not result.success:
            print(result.message)
    """

    def __init__(
        self,
        backend_url: str = DEFAULT_BACKEND_URL,
        camera_id:   str = DEFAULT_CAMERA_ID,
        timeout:     float = DEFAULT_TIMEOUT_SECS,
    ) -> None:
        self.backend_url = backend_url.rstrip("/")
        self.camera_id   = camera_id
        self.timeout     = timeout
        self._endpoint   = self.backend_url + EVENTS_ENDPOINT

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_payload(self, event: Any) -> Dict[str, Any]:
        """
        Convert a Phase 1C IntrusionEvent into the IBVAP Common Event dict.

        The mapping is:
          event.event_type → mapped via _EVENT_TYPE_MAP → "event_type"
          event.timestamp  → "timestamp"  (already ISO-8601)
          event.confidence → "confidence"
          event.track_id   → "metadata.track_id"
          event.class_name → "metadata.class_name"
          event.bbox       → "metadata.bbox"  (as [x1,y1,x2,y2] list)
          event.position   → "metadata.position"

        Parameters
        ----------
        event : IntrusionEvent (or any object with the same attributes)
            The Phase 1C intrusion event to convert.

        Returns
        -------
        dict — ready to be serialised to JSON and POSTed.
        """
        # Map internal event type to the agreed IBVAP Common Event type
        raw_type    = getattr(event, "event_type", "INTRUSION")
        mapped_type = _EVENT_TYPE_MAP.get(raw_type, raw_type)

        # bbox: Phase 1C stores {x1,y1,x2,y2}; Common Event wants [x1,y1,x2,y2]
        bbox_dict = getattr(event, "bbox", {})
        if isinstance(bbox_dict, dict):
            bbox_list = [
                bbox_dict.get("x1", 0),
                bbox_dict.get("y1", 0),
                bbox_dict.get("x2", 0),
                bbox_dict.get("y2", 0),
            ]
        else:
            bbox_list = list(bbox_dict)   # already a list/sequence

        payload: Dict[str, Any] = {
            "camera_id":  self.camera_id,
            "event_type": mapped_type,
            "timestamp":  getattr(event, "timestamp", ""),
            "confidence": round(float(getattr(event, "confidence", 0.0)), 4),
            "metadata": {
                "track_id":   getattr(event, "track_id",   None),
                "class_name": getattr(event, "class_name", ""),
                "bbox":       bbox_list,
                "position":   getattr(event, "position",   {}),
            },
        }
        return payload

    def send(self, event: Any) -> SendResult:
        """
        Build the Common Event payload and POST it to the backend.

        This method NEVER raises an exception.  All network and HTTP errors are
        caught and returned as a failed SendResult so the CV pipeline continues.

        Parameters
        ----------
        event : IntrusionEvent
            A Phase 1C intrusion event (one per OUTSIDE→INSIDE transition).

        Returns
        -------
        SendResult
        """
        payload = self.build_payload(event)
        body    = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            url    = self._endpoint,
            data   = body,
            method = "POST",
            headers = {
                "Content-Type": "application/json",
                "Accept":       "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status       = resp.status
                raw_body     = resp.read().decode("utf-8", errors="replace")
                is_success   = 200 <= status < 300

                if is_success:
                    logger.info(
                        "[EventClient] Event sent OK  status=%d  "
                        "track_id=%s  endpoint=%s",
                        status,
                        payload["metadata"].get("track_id"),
                        self._endpoint,
                    )
                    return SendResult(
                        success=True,
                        status_code=status,
                        message=f"Accepted by backend (HTTP {status})",
                        response_body=raw_body,
                    )
                else:
                    # urllib raises HTTPError for 4xx/5xx, but guard anyway
                    logger.warning(
                        "[EventClient] Unexpected 2xx variant  status=%d", status
                    )
                    return SendResult(
                        success=False,
                        status_code=status,
                        message=f"Unexpected status HTTP {status}",
                        response_body=raw_body,
                    )

        except urllib.error.HTTPError as exc:
            # 4xx / 5xx responses
            status       = exc.code
            raw_body     = _read_error_body(exc)
            message      = _http_error_message(status, raw_body)
            logger.warning("[EventClient] %s", message)
            return SendResult(
                success=False,
                status_code=status,
                message=message,
                response_body=raw_body,
            )

        except urllib.error.URLError as exc:
            # Connection refused, DNS failure, etc.
            reason = str(exc.reason)
            message = (
                f"[EventClient] Backend unreachable — {reason}  "
                f"(endpoint: {self._endpoint})"
            )
            logger.warning(message)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

        except TimeoutError as exc:
            message = (
                f"[EventClient] Request timed out after {self.timeout}s  "
                f"(endpoint: {self._endpoint})"
            )
            logger.warning(message)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

        except Exception as exc:                    # noqa: BLE001 — broad catch by design
            # Any other unexpected error must not crash the CV loop
            message = f"[EventClient] Unexpected error: {exc}"
            logger.error(message, exc_info=True)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

    def __repr__(self) -> str:
        return (
            f"EventClient(endpoint='{self._endpoint}', "
            f"camera_id='{self.camera_id}', timeout={self.timeout})"
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _read_error_body(exc: urllib.error.HTTPError) -> str:
    """Safely read the response body from an HTTPError."""
    try:
        return exc.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def _http_error_message(status: int, body: str) -> str:
    """Return a human-readable description of an HTTP error."""
    descriptions = {
        400: "Bad Request — invalid/malformed request",
        404: "Not Found — endpoint not found on backend",
        422: "Unprocessable Entity — backend schema validation failed",
        500: "Internal Server Error — backend error",
    }
    desc = descriptions.get(status, f"HTTP error {status}")
    short_body = body[:200].strip() if body else "(no body)"
    return f"[EventClient] HTTP {status} {desc}  body={short_body!r}"
