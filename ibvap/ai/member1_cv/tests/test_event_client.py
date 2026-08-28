"""
tests/test_event_client.py — Phase 1D unit tests.

Run with:
    pytest tests/ -v
    pytest tests/test_event_client.py -v   (Phase 1D only)

All tests use unittest.mock to stub the network — no real backend needed.

Coverage
--------
 1.  build_payload() produces correct top-level fields.
 2.  event_type maps "INTRUSION" → "INTRUSION_DETECTED".
 3.  track_id appears inside metadata (NOT at the top level).
 4.  class_name appears inside metadata.
 5.  bbox appears inside metadata as a [x1,y1,x2,y2] list.
 6.  position appears inside metadata.
 7.  camera_id is included in the payload.
 8.  timestamp is a non-empty string (ISO-8601 compatible).
 9.  Correct endpoint URL is used (POST /api/v1/events).
10.  HTTP method is POST.
11.  Content-Type header is application/json.
12.  2xx response → SendResult.success is True.
13.  400 response → SendResult.success is False, status_code=400.
14.  404 response → SendResult.success is False, status_code=404.
15.  422 response → SendResult.success is False, status_code=422.
16.  500 response → SendResult.success is False, status_code=500.
17.  Connection refused (URLError) → success=False, status_code=None.
18.  Timeout → success=False, status_code=None.
19.  send() never raises — CV loop continues even when backend is unavailable.
20.  Phase 1A regression: DetectionResult.track_id still defaults to None.
21.  Phase 1B regression: BoundingBox width/height unchanged.
22.  Phase 1C regression: IntrusionEvent.as_dict() still works.
"""

from __future__ import annotations

import io
import json
import sys
import os
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch, call

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from adapter import EventClient, SendResult
from adapter.event_client import (
    DEFAULT_BACKEND_URL,
    DEFAULT_CAMERA_ID,
    EVENTS_ENDPOINT,
)
from intrusion.detector import IntrusionEvent
from detection.detector import BoundingBox, DetectionResult


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def _make_event(
    track_id:   int   = 7,
    class_name: str   = "person",
    confidence: float = 0.94,
    x1: int = 120, y1: int = 80, x2: int = 300, y2: int = 450,
    timestamp:  str   = "2026-08-28T10:00:00+00:00",
) -> IntrusionEvent:
    """Build a Phase 1C IntrusionEvent for testing."""
    return IntrusionEvent(
        event_type="INTRUSION",
        track_id=track_id,
        class_name=class_name,
        confidence=confidence,
        timestamp=timestamp,
        bbox={"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        position={"x": (x1 + x2) // 2, "y": (y1 + y2) // 2},
    )


def _make_client(
    camera_id:   str   = DEFAULT_CAMERA_ID,
    backend_url: str   = DEFAULT_BACKEND_URL,
    timeout:     float = 5.0,
) -> EventClient:
    return EventClient(
        camera_id=camera_id,
        backend_url=backend_url,
        timeout=timeout,
    )


def _mock_http_response(status: int, body: str = "{}") -> MagicMock:
    """Return a context-manager mock that yields a response with the given status."""
    resp = MagicMock()
    resp.status     = status
    resp.read.return_value = body.encode("utf-8")
    resp.__enter__  = lambda s: resp
    resp.__exit__   = MagicMock(return_value=False)
    return resp


def _make_http_error(code: int, body: str = "") -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        url=DEFAULT_BACKEND_URL + EVENTS_ENDPOINT,
        code=code,
        msg=f"HTTP {code}",
        hdrs=MagicMock(),           # type: ignore
        fp=io.BytesIO(body.encode()),
    )


# ---------------------------------------------------------------------------
# 1. Payload construction
# ---------------------------------------------------------------------------

class TestBuildPayload:

    def test_top_level_fields_present(self):
        client  = _make_client()
        event   = _make_event()
        payload = client.build_payload(event)
        for field in ("camera_id", "event_type", "timestamp", "confidence", "metadata"):
            assert field in payload, f"Missing top-level field: '{field}'"

    def test_event_type_mapped_to_intrusion_detected(self):
        """Phase 1C uses "INTRUSION"; adapter MUST map to "INTRUSION_DETECTED"."""
        payload = _make_client().build_payload(_make_event())
        assert payload["event_type"] == "INTRUSION_DETECTED"

    def test_camera_id_in_payload(self):
        payload = _make_client(camera_id="CAM-99").build_payload(_make_event())
        assert payload["camera_id"] == "CAM-99"

    def test_timestamp_is_non_empty_string(self):
        payload = _make_client().build_payload(_make_event(timestamp="2026-08-28T10:00:00+00:00"))
        ts = payload["timestamp"]
        assert isinstance(ts, str)
        assert len(ts) > 0

    def test_confidence_in_payload(self):
        payload = _make_client().build_payload(_make_event(confidence=0.87))
        assert abs(payload["confidence"] - 0.87) < 1e-4

    def test_track_id_in_metadata_not_top_level(self):
        payload = _make_client().build_payload(_make_event(track_id=17))
        assert payload["metadata"]["track_id"] == 17
        assert "track_id" not in {k for k in payload if k != "metadata"}

    def test_class_name_in_metadata(self):
        payload = _make_client().build_payload(_make_event(class_name="car"))
        assert payload["metadata"]["class_name"] == "car"

    def test_bbox_in_metadata_as_list(self):
        """bbox must be [x1, y1, x2, y2] — NOT the {x1,y1,x2,y2} dict."""
        payload = _make_client().build_payload(
            _make_event(x1=120, y1=80, x2=300, y2=450)
        )
        bbox = payload["metadata"]["bbox"]
        assert isinstance(bbox, list), f"bbox should be a list, got {type(bbox)}"
        assert bbox == [120, 80, 300, 450]

    def test_position_in_metadata(self):
        payload = _make_client().build_payload(
            _make_event(x1=120, y1=80, x2=300, y2=450)
        )
        pos = payload["metadata"]["position"]
        assert "x" in pos
        assert "y" in pos

    def test_payload_is_json_serialisable(self):
        payload = _make_client().build_payload(_make_event())
        serialised = json.dumps(payload)
        assert isinstance(serialised, str)


# ---------------------------------------------------------------------------
# 2. HTTP mechanics
# ---------------------------------------------------------------------------

class TestHTTPMechanics:

    @patch("urllib.request.urlopen")
    def test_correct_endpoint_used(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(200)
        client = _make_client(backend_url="http://127.0.0.1:8000")
        client.send(_make_event())

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://127.0.0.1:8000/api/v1/events"

    @patch("urllib.request.urlopen")
    def test_http_method_is_post(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(200)
        client = _make_client()
        client.send(_make_event())

        req = mock_urlopen.call_args[0][0]
        assert req.method == "POST"

    @patch("urllib.request.urlopen")
    def test_content_type_is_application_json(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(200)
        client = _make_client()
        client.send(_make_event())

        req = mock_urlopen.call_args[0][0]
        assert req.get_header("Content-type") == "application/json"

    @patch("urllib.request.urlopen")
    def test_request_body_contains_correct_payload(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(200)
        client = _make_client(camera_id="CAM-42")
        event  = _make_event(track_id=99, class_name="truck")
        client.send(event)

        req  = mock_urlopen.call_args[0][0]
        body = json.loads(req.data.decode("utf-8"))

        assert body["camera_id"]  == "CAM-42"
        assert body["event_type"] == "INTRUSION_DETECTED"
        assert body["metadata"]["track_id"]   == 99
        assert body["metadata"]["class_name"] == "truck"


# ---------------------------------------------------------------------------
# 3. Success and error handling
# ---------------------------------------------------------------------------

class TestSuccessHandling:

    @patch("urllib.request.urlopen")
    def test_2xx_is_success(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(200)
        result = _make_client().send(_make_event())
        assert result.success is True
        assert result.status_code == 200

    @patch("urllib.request.urlopen")
    def test_201_is_success(self, mock_urlopen):
        mock_urlopen.return_value = _mock_http_response(201)
        result = _make_client().send(_make_event())
        assert result.success is True
        assert result.status_code == 201


class TestHTTPErrorHandling:

    @patch("urllib.request.urlopen")
    def test_400_is_failure(self, mock_urlopen):
        mock_urlopen.side_effect = _make_http_error(400)
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code == 400

    @patch("urllib.request.urlopen")
    def test_404_is_failure(self, mock_urlopen):
        mock_urlopen.side_effect = _make_http_error(404)
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code == 404

    @patch("urllib.request.urlopen")
    def test_422_is_failure(self, mock_urlopen):
        mock_urlopen.side_effect = _make_http_error(422)
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code == 422

    @patch("urllib.request.urlopen")
    def test_500_is_failure(self, mock_urlopen):
        mock_urlopen.side_effect = _make_http_error(500)
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code == 500

    @patch("urllib.request.urlopen")
    def test_connection_refused(self, mock_urlopen):
        import socket
        mock_urlopen.side_effect = urllib.error.URLError(
            reason=ConnectionRefusedError(111, "Connection refused")
        )
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code is None
        assert "unreachable" in result.message.lower() or "connection" in result.message.lower()

    @patch("urllib.request.urlopen")
    def test_timeout(self, mock_urlopen):
        mock_urlopen.side_effect = TimeoutError("timed out")
        result = _make_client().send(_make_event())
        assert result.success is False
        assert result.status_code is None
        assert "timed out" in result.message.lower() or "timeout" in result.message.lower()

    @patch("urllib.request.urlopen")
    def test_send_never_raises(self, mock_urlopen):
        """
        CV pipeline must not crash regardless of what the network does.
        Even a totally unexpected exception must not propagate.
        """
        mock_urlopen.side_effect = RuntimeError("totally unexpected")
        result = _make_client().send(_make_event())
        assert result.success is False   # failure result returned, no exception

    @patch("urllib.request.urlopen")
    def test_result_has_message_on_failure(self, mock_urlopen):
        mock_urlopen.side_effect = _make_http_error(422)
        result = _make_client().send(_make_event())
        assert isinstance(result.message, str)
        assert len(result.message) > 0


# ---------------------------------------------------------------------------
# 4. SendResult contract
# ---------------------------------------------------------------------------

class TestSendResult:
    def test_success_result(self):
        r = SendResult(success=True, status_code=200, message="OK")
        assert r.success is True
        assert r.status_code == 200
        assert r.response_body is None

    def test_failure_result(self):
        r = SendResult(success=False, status_code=None, message="refused")
        assert r.success is False
        assert r.status_code is None


# ---------------------------------------------------------------------------
# 5. EventClient repr
# ---------------------------------------------------------------------------

class TestEventClientRepr:
    def test_repr_contains_endpoint(self):
        c = EventClient(backend_url="http://10.0.0.1:9000", camera_id="CAM-X")
        r = repr(c)
        assert "api/v1/events" in r
        assert "CAM-X" in r


# ---------------------------------------------------------------------------
# 6. Phase 1A / 1B / 1C regression guards
# ---------------------------------------------------------------------------

class TestPhase1ABCRegression:
    def test_detection_result_track_id_default_none(self):
        det = DetectionResult(
            class_id=0, class_name="person", confidence=0.8,
            bbox=BoundingBox(0, 0, 50, 100),
        )
        assert det.track_id is None

    def test_bounding_box_width_height(self):
        bb = BoundingBox(x1=10, y1=20, x2=110, y2=220)
        assert bb.width  == 100
        assert bb.height == 200

    def test_intrusion_event_as_dict_still_works(self):
        ev = _make_event()
        d  = ev.as_dict()
        assert d["event_type"]  == "INTRUSION"   # Phase 1C internal value unchanged
        assert d["track_id"]    == 7
        assert d["class_name"]  == "person"
        assert "bbox"           in d
        assert "position"       in d

    def test_intrusion_event_adapter_maps_type(self):
        """Adapter must map "INTRUSION" → "INTRUSION_DETECTED" in payload."""
        payload = _make_client().build_payload(_make_event())
        assert payload["event_type"] == "INTRUSION_DETECTED"
        # Internal event object must be unmodified
        ev = _make_event()
        assert ev.event_type == "INTRUSION"
