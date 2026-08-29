"""
event_client.py — Phase 2E: IBVAP ANPR Common Event HTTP Adapter.

Responsibility
--------------
* Convert a Member 2 IBVAPEvent (ANPR_DETECTED, WATCHLIST_MATCH) into the
  IBVAP Common Event JSON schema.
* POST it to Member 3's backend endpoint (/api/v1/events).
* Handle HTTP success (2xx) and all error conditions (400, 404, 422, 500,
  connection refused, timeout) gracefully without crashing the ANPR loop.

Design rules
------------
* Uses Python's built-in urllib.request — zero new third-party dependencies.
* Does NOT import FastAPI, SQLAlchemy, SQLite, or backend application models.
* Does NOT import OpenCV, YOLO, or EasyOCR.
* Completely testable via mocking without real network access.
* Respects duplicate suppression from suppressor.py — only emits novel events.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

from ..schemas import IBVAPEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_BACKEND_URL: str = "http://127.0.0.1:8000"
EVENTS_ENDPOINT: str = "/api/v1/events"
DEFAULT_CAMERA_ID: str = "CAM-01"
DEFAULT_TIMEOUT_SECS: float = 5.0


# ---------------------------------------------------------------------------
# Result Dataclass
# ---------------------------------------------------------------------------

@dataclass
class SendResult:
    """
    Structured outcome returned by ANPREventClient.send().

    Attributes
    ----------
    success : bool
        True when the backend accepted the event with a 2xx HTTP status.
    status_code : int or None
        HTTP status code (e.g. 201, 400, 422, 500), or None on network failure.
    message : str
        Human-readable summary of the outcome.
    response_body : str or None
        Raw response body from the server, if any.
    """
    success: bool
    status_code: Optional[int]
    message: str
    response_body: Optional[str] = None


# ---------------------------------------------------------------------------
# ANPREventClient
# ---------------------------------------------------------------------------

class ANPREventClient:
    """
    HTTP client adapter for transmitting ANPR surveillance events to IBVAP backend.

    Parameters
    ----------
    backend_url : str
        Base URL of the IBVAP backend (e.g. "http://127.0.0.1:8000").
    camera_id : str
        Fallback/override camera identifier (e.g. "CAM-01").
    timeout : float
        HTTP request timeout in seconds (default: 5.0).
    enabled : bool
        Whether backend event emission is enabled (default: True).
    """

    def __init__(
        self,
        backend_url: str = DEFAULT_BACKEND_URL,
        camera_id: str = DEFAULT_CAMERA_ID,
        timeout: float = DEFAULT_TIMEOUT_SECS,
        enabled: bool = True,
    ) -> None:
        self.backend_url = backend_url.rstrip("/")
        self.camera_id = camera_id
        self.timeout = timeout
        self.enabled = enabled
        self._endpoint = f"{self.backend_url}{EVENTS_ENDPOINT}"

    def build_payload(self, event: Any) -> Dict[str, Any]:
        """
        Convert an IBVAPEvent (or compatible object/dict) into the Common Event dict.

        Mapping:
          - camera_id: event.camera_id (or self.camera_id fallback)
          - event_type: event.event_type.value or string (ANPR_DETECTED / WATCHLIST_MATCH)
          - timestamp: event.timestamp (ISO-8601 string)
          - confidence: event.confidence (rounded to 4 decimal places)
          - metadata: preserved dictionary containing plate_number, vehicle_id, etc.
        """
        if isinstance(event, dict):
            cam_id = event.get("camera_id") or self.camera_id
            ev_type = event.get("event_type")
            ts = event.get("timestamp", "")
            conf = float(event.get("confidence", 0.0))
            meta = event.get("metadata", {})
        elif isinstance(event, IBVAPEvent):
            cam_id = event.camera_id or self.camera_id
            ev_type = event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type)
            ts = event.timestamp
            conf = float(event.confidence)
            meta = event.metadata
        else:
            cam_id = getattr(event, "camera_id", self.camera_id)
            ev_type = getattr(event, "event_type", "ANPR_DETECTED")
            if hasattr(ev_type, "value"):
                ev_type = ev_type.value
            ts = getattr(event, "timestamp", "")
            conf = float(getattr(event, "confidence", 0.0))
            meta = getattr(event, "metadata", {})

        return {
            "camera_id": str(cam_id).strip(),
            "event_type": str(ev_type),
            "timestamp": str(ts),
            "confidence": round(conf, 4),
            "metadata": dict(meta),
        }

    def send(self, event: Any) -> SendResult:
        """
        POST an ANPR event to the backend.

        Catches all network and HTTP errors without raising exceptions,
        ensuring continuous operation of the ANPR video processing loop.
        """
        if not self.enabled:
            logger.debug("[ANPREventClient] Emission disabled; skipping event.")
            return SendResult(
                success=False,
                status_code=None,
                message="Backend event emission is disabled",
            )

        payload = self.build_payload(event)
        body = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            url=self._endpoint,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status = resp.status
                raw_body = resp.read().decode("utf-8", errors="replace")
                is_success = 200 <= status < 300

                if is_success:
                    logger.info(
                        "[ANPREventClient] Event sent OK (HTTP %d) | type=%s plate=%s camera=%s",
                        status,
                        payload.get("event_type"),
                        payload.get("metadata", {}).get("plate_number"),
                        payload.get("camera_id"),
                    )
                    return SendResult(
                        success=True,
                        status_code=status,
                        message=f"Accepted by backend (HTTP {status})",
                        response_body=raw_body,
                    )
                else:
                    logger.warning("[ANPREventClient] Unexpected 2xx status: %d", status)
                    return SendResult(
                        success=False,
                        status_code=status,
                        message=f"Unexpected status HTTP {status}",
                        response_body=raw_body,
                    )

        except urllib.error.HTTPError as exc:
            status = exc.code
            raw_body = _read_error_body(exc)
            message = _http_error_message(status, raw_body)
            logger.warning("[ANPREventClient] %s", message)
            return SendResult(
                success=False,
                status_code=status,
                message=message,
                response_body=raw_body,
            )

        except urllib.error.URLError as exc:
            reason = str(exc.reason)
            message = (
                f"[ANPREventClient] Backend unreachable — {reason} "
                f"(endpoint: {self._endpoint})"
            )
            logger.warning(message)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

        except TimeoutError:
            message = (
                f"[ANPREventClient] Request timed out after {self.timeout}s "
                f"(endpoint: {self._endpoint})"
            )
            logger.warning(message)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

        except Exception as exc:
            message = f"[ANPREventClient] Unexpected error: {exc}"
            logger.error(message, exc_info=True)
            return SendResult(
                success=False,
                status_code=None,
                message=message,
            )

    def __repr__(self) -> str:
        return (
            f"ANPREventClient(endpoint='{self._endpoint}', "
            f"camera_id='{self.camera_id}', timeout={self.timeout}, "
            f"enabled={self.enabled})"
        )


def _read_error_body(exc: urllib.error.HTTPError) -> str:
    """Safely read error response body from HTTPError."""
    try:
        return exc.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def _http_error_message(status: int, body: str) -> str:
    """Return descriptive message for HTTP status codes."""
    descriptions = {
        400: "Bad Request — invalid/malformed request",
        404: "Not Found — endpoint not found on backend",
        422: "Unprocessable Entity — backend schema validation failed",
        500: "Internal Server Error — backend server error",
    }
    desc = descriptions.get(status, f"HTTP error {status}")
    short_body = body[:200].strip() if body else "(no body)"
    return f"[ANPREventClient] HTTP {status} {desc} | body={short_body!r}"
