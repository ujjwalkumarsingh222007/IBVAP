"""
test_event_client.py — Phase 2E test suite for ANPREventClient.

Tests:
  1.  Correct ANPR_DETECTED payload structure
  2.  Correct WATCHLIST_MATCH payload structure
  3.  camera_id mapping and override fallback
  4.  timestamp mapping and propagation
  5.  confidence value mapping and precision rounding
  6.  metadata preservation (plate_number, vehicle_id, ocr_confidence, etc.)
  7.  Correct POST URL endpoint construction
  8.  Content-Type: application/json and Accept headers
  9.  HTTP 2xx (200 / 201) success response handling
  10. HTTP 400 Bad Request error handling
  11. HTTP 404 Not Found error handling
  12. HTTP 422 Unprocessable Entity error handling
  13. HTTP 500 Internal Server Error handling
  14. Network connection refused / URLError handling
  15. Network TimeoutError handling
  16. Backend disabled (enabled=False) behavior
  17. Duplicate suppression integration (duplicate events not forwarded)
  18. Robustness with dictionary payloads and arbitrary event-like objects
"""

import io
import json
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from ai.member2_anpr.adapter.event_client import (
    ANPREventClient,
    SendResult,
    DEFAULT_BACKEND_URL,
    DEFAULT_CAMERA_ID,
    DEFAULT_TIMEOUT_SECS,
)
from ai.member2_anpr.schemas import EventType, IBVAPEvent
from ai.member2_anpr.suppressor import DuplicateSuppressor
from ai.member2_anpr.pipeline import ANPRPipeline
from ai.member2_anpr.detector import MockPlateDetector
from ai.member2_anpr.ocr import MockOCREngine
from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_anpr_event() -> IBVAPEvent:
    return IBVAPEvent(
        camera_id="CAM-BORDER-01",
        event_type=EventType.ANPR_DETECTED,
        timestamp="2026-08-28T15:30:00+00:00",
        confidence=0.9243,
        metadata={
            "plate_number": "DL01AB1234",
            "raw_ocr_text": "DL01AB1234",
            "plate_confidence": 0.90,
            "ocr_confidence": 0.95,
            "vehicle_id": "VEH-BORDER-101",
            "watchlist_match": False,
            "validation_passed": True,
            "validation_reason": "Standard Indian Plate (DL)",
        },
    )


@pytest.fixture
def sample_watchlist_event() -> IBVAPEvent:
    return IBVAPEvent(
        camera_id="CAM-BORDER-02",
        event_type=EventType.WATCHLIST_MATCH,
        timestamp="2026-08-28T15:32:00+00:00",
        confidence=0.9348,
        metadata={
            "plate_number": "MH12DE1433",
            "raw_ocr_text": "MH12DE1433",
            "plate_confidence": 0.95,
            "ocr_confidence": 0.92,
            "vehicle_id": "VEH-SUSPECT-404",
            "watchlist_match": True,
            "watchlist_status": "STOLEN",
            "watchlist_reason": "Reported stolen in Pune - FIR #8821",
            "validation_passed": True,
            "validation_reason": "Standard Indian Plate (MH)",
        },
    )


# ---------------------------------------------------------------------------
# 1. Payload & Field Mapping Tests
# ---------------------------------------------------------------------------

class TestPayloadMapping:

    def test_default_constants(self):
        client = ANPREventClient()
        assert client.backend_url == DEFAULT_BACKEND_URL
        assert client.camera_id == DEFAULT_CAMERA_ID
        assert client.timeout == DEFAULT_TIMEOUT_SECS
        assert client.enabled is True
        assert client._endpoint == "http://127.0.0.1:8000/api/v1/events"

    def test_anpr_detected_payload(self, sample_anpr_event):
        client = ANPREventClient(backend_url="http://127.0.0.1:8000")
        payload = client.build_payload(sample_anpr_event)

        assert payload["camera_id"] == "CAM-BORDER-01"
        assert payload["event_type"] == "ANPR_DETECTED"
        assert payload["timestamp"] == "2026-08-28T15:30:00+00:00"
        assert payload["confidence"] == 0.9243
        assert payload["metadata"]["plate_number"] == "DL01AB1234"
        assert payload["metadata"]["vehicle_id"] == "VEH-BORDER-101"
        assert payload["metadata"]["watchlist_match"] is False
        assert payload["metadata"]["validation_passed"] is True

    def test_watchlist_match_payload(self, sample_watchlist_event):
        client = ANPREventClient(backend_url="http://127.0.0.1:8000")
        payload = client.build_payload(sample_watchlist_event)

        assert payload["camera_id"] == "CAM-BORDER-02"
        assert payload["event_type"] == "WATCHLIST_MATCH"
        assert payload["confidence"] == 0.9348
        assert payload["metadata"]["plate_number"] == "MH12DE1433"
        assert payload["metadata"]["watchlist_match"] is True
        assert payload["metadata"]["watchlist_status"] == "STOLEN"
        assert payload["metadata"]["watchlist_reason"] == "Reported stolen in Pune - FIR #8821"

    def test_camera_id_fallback_when_empty_on_event(self):
        client = ANPREventClient(camera_id="CAM-FALLBACK-09")
        raw_dict = {
            "event_type": "ANPR_DETECTED",
            "timestamp": "2026-08-28T12:00:00Z",
            "confidence": 0.88,
            "metadata": {"plate_number": "KA01AB1234"},
        }
        payload = client.build_payload(raw_dict)
        assert payload["camera_id"] == "CAM-FALLBACK-09"

    def test_confidence_rounding(self):
        client = ANPREventClient()
        raw_dict = {
            "camera_id": "CAM-01",
            "event_type": "ANPR_DETECTED",
            "timestamp": "2026-08-28T12:00:00Z",
            "confidence": 0.987654321,
            "metadata": {},
        }
        payload = client.build_payload(raw_dict)
        assert payload["confidence"] == 0.9877


# ---------------------------------------------------------------------------
# 2. HTTP Transmission & Header Tests
# ---------------------------------------------------------------------------

class TestHTTPTransmission:

    @patch("urllib.request.urlopen")
    def test_correct_url_and_headers(self, mock_urlopen, sample_anpr_event):
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = json.dumps({"status": "created", "id": "ev-101"}).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = ANPREventClient(backend_url="http://custom-backend:9000")
        res = client.send(sample_anpr_event)

        assert res.success is True
        assert res.status_code == 201

        # Verify urllib.request.Request parameters
        call_args = mock_urlopen.call_args
        req = call_args[0][0]
        assert isinstance(req, urllib.request.Request)
        assert req.full_url == "http://custom-backend:9000/api/v1/events"
        assert req.method == "POST"
        assert req.headers["Content-type"] == "application/json"
        assert req.headers["Accept"] == "application/json"

        # Verify parsed body content
        sent_body = json.loads(req.data.decode("utf-8"))
        assert sent_body["camera_id"] == "CAM-BORDER-01"
        assert sent_body["event_type"] == "ANPR_DETECTED"

    @patch("urllib.request.urlopen")
    def test_http_200_success(self, mock_urlopen, sample_anpr_event):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'{"status": "ok"}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is True
        assert res.status_code == 200
        assert "Accepted by backend" in res.message


# ---------------------------------------------------------------------------
# 3. HTTP Error Codes Handling Tests (400, 404, 422, 500)
# ---------------------------------------------------------------------------

class TestHTTPErrors:

    @patch("urllib.request.urlopen")
    def test_http_400_bad_request(self, mock_urlopen, sample_anpr_event):
        fp = io.BytesIO(b'{"detail": "Malformed syntax"}')
        error = urllib.error.HTTPError(
            url="http://127.0.0.1:8000/api/v1/events",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=fp,
        )
        mock_urlopen.side_effect = error

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code == 400
        assert "400 Bad Request" in res.message
        assert "Malformed syntax" in res.response_body

    @patch("urllib.request.urlopen")
    def test_http_404_not_found(self, mock_urlopen, sample_anpr_event):
        fp = io.BytesIO(b'{"detail": "Not Found"}')
        error = urllib.error.HTTPError(
            url="http://127.0.0.1:8000/api/v1/events",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=fp,
        )
        mock_urlopen.side_effect = error

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code == 404
        assert "404 Not Found" in res.message

    @patch("urllib.request.urlopen")
    def test_http_422_validation_error(self, mock_urlopen, sample_anpr_event):
        fp = io.BytesIO(b'{"detail": [{"loc": ["body", "confidence"], "msg": "value too large"}]}')
        error = urllib.error.HTTPError(
            url="http://127.0.0.1:8000/api/v1/events",
            code=422,
            msg="Unprocessable Entity",
            hdrs={},
            fp=fp,
        )
        mock_urlopen.side_effect = error

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code == 422
        assert "422 Unprocessable Entity" in res.message

    @patch("urllib.request.urlopen")
    def test_http_500_server_error(self, mock_urlopen, sample_anpr_event):
        fp = io.BytesIO(b'{"detail": "Internal database lock"}')
        error = urllib.error.HTTPError(
            url="http://127.0.0.1:8000/api/v1/events",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=fp,
        )
        mock_urlopen.side_effect = error

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code == 500
        assert "500 Internal Server Error" in res.message


# ---------------------------------------------------------------------------
# 4. Network Fault Tolerance Tests
# ---------------------------------------------------------------------------

class TestNetworkFaultTolerance:

    @patch("urllib.request.urlopen")
    def test_connection_refused_returns_failure_without_raising(self, mock_urlopen, sample_anpr_event):
        error = urllib.error.URLError(reason="Connection refused (10061)")
        mock_urlopen.side_effect = error

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code is None
        assert "Backend unreachable" in res.message

    @patch("urllib.request.urlopen")
    def test_timeout_returns_failure_without_raising(self, mock_urlopen, sample_anpr_event):
        mock_urlopen.side_effect = TimeoutError("Timed out")

        client = ANPREventClient(timeout=2.0)
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code is None
        assert "timed out after 2.0s" in res.message

    @patch("urllib.request.urlopen")
    def test_unexpected_generic_exception(self, mock_urlopen, sample_anpr_event):
        mock_urlopen.side_effect = RuntimeError("Socket layer exploded")

        client = ANPREventClient()
        res = client.send(sample_anpr_event)

        assert res.success is False
        assert res.status_code is None
        assert "Unexpected error" in res.message

    def test_disabled_client_skips_network(self, sample_anpr_event):
        client = ANPREventClient(enabled=False)
        with patch("urllib.request.urlopen") as mock_urlopen:
            res = client.send(sample_anpr_event)
            mock_urlopen.assert_not_called()

        assert res.success is False
        assert res.status_code is None
        assert "disabled" in res.message


# ---------------------------------------------------------------------------
# 5. Integration with Duplicate Suppression
# ---------------------------------------------------------------------------

class TestDuplicateSuppressionIntegration:

    @patch("urllib.request.urlopen")
    def test_duplicate_suppression_guards_backend_emission(self, mock_urlopen):
        # Configure successful backend response
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = b'{"status": "ok"}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        suppressor = DuplicateSuppressor(window_seconds=10.0)
        pipeline = ANPRPipeline(
            detector=MockPlateDetector(),
            ocr_engine=MockOCREngine(mock_text="DL01AB1234"),
            duplicate_suppressor=suppressor,
            watchlist=InMemoryWatchlistMatcher({}),
        )
        client = ANPREventClient()

        dummy_frame = np.full((480, 640, 3), fill_value=128, dtype=np.uint8)

        # Frame 1: novel plate -> should be sent
        r1 = pipeline.process_frame(dummy_frame, camera_id="CAM-01", timestamp="2026-08-28T15:00:00Z")
        assert len(r1) == 1
        assert r1[0].duplicate_suppressed is False
        send1 = client.send(r1[0].event)
        assert send1.success is True
        assert mock_urlopen.call_count == 1

        # Frame 2: same plate 2 seconds later -> suppressed by pipeline
        r2 = pipeline.process_frame(dummy_frame, camera_id="CAM-01", timestamp="2026-08-28T15:00:02Z")
        assert len(r2) == 1
        assert r2[0].duplicate_suppressed is True

        # Pipeline returns duplicate_suppressed=True; the caller checks this and skips calling client.send
        # Verify mock_urlopen was NOT called a second time
        if not r2[0].duplicate_suppressed:
            client.send(r2[0].event)
        assert mock_urlopen.call_count == 1
