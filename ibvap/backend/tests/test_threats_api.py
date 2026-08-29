"""
test_threats_api.py — Integration tests for /api/v1/threats REST API endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, get_db
from app.models import Event, Threat, ThreatEventRelation
from app.schemas import ThreatSeverity, ThreatStatus
from app.services.threat_correlation_service import ThreatCorrelationService


@pytest.fixture(name="client")
def fixture_client():
    """Test client fixture connected to clean in-memory/test database."""
    Base.metadata.create_all(bind=engine)
    ThreatCorrelationService.get_instance().reset_state()
    with TestClient(app) as test_client:
        yield test_client
    ThreatCorrelationService.get_instance().reset_state()


def test_list_threats_empty(client: TestClient):
    """GET /api/v1/threats returns an empty list when no threats exist."""
    resp = client.get("/api/v1/threats")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_events_and_retrieve_correlated_threat(client: TestClient):
    """Creating correlated events automatically produces a Threat accessible via GET /api/v1/threats."""
    now_iso = "2026-08-29T10:30:00.000000+00:00"

    # 1. Post PERSON_DETECTED event
    ev1_payload = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "PERSON_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.91,
        "metadata": {"track_id": 14},
    }
    r1 = client.post("/api/v1/events", json=ev1_payload)
    assert r1.status_code == 201

    # 2. Post WATCHLIST_MATCH event on same camera
    ev2_payload = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "WATCHLIST_MATCH",
        "timestamp": now_iso,
        "confidence": 0.96,
        "metadata": {"plate_number": "TN09AB1234", "watchlist_status": "STOLEN"},
    }
    r2 = client.post("/api/v1/events", json=ev2_payload)
    assert r2.status_code == 201

    # 3. Query active threats
    resp = client.get("/api/v1/threats/active?camera_id=CAM-TOWER-04")
    assert resp.status_code == 200
    threats = resp.json()
    assert len(threats) >= 1

    thr = threats[0]
    assert thr["camera_id"] == "CAM-TOWER-04"
    assert thr["severity"] == "CRITICAL"
    assert "TN09AB1234" in thr["title"]
    assert thr["status"] == "ACTIVE"

    threat_id = thr["threat_id"]

    # 4. Query threat detail with events
    detail_resp = client.get(f"/api/v1/threats/{threat_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["threat_id"] == threat_id
    assert len(detail["timeline"]) >= 1

    # 5. Query timeline endpoint
    timeline_resp = client.get(f"/api/v1/threats/{threat_id}/timeline")
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()
    assert len(timeline) >= 1
    assert any("TN09AB1234" in item["description"] for item in timeline)


def test_threat_stats_endpoint(client: TestClient):
    """GET /api/v1/threats/stats returns valid threat counts by severity and status."""
    resp = client.get("/api/v1/threats/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert "total_threats" in stats
    assert "active_threats" in stats
    assert "critical" in stats
    assert "high" in stats
    assert "medium" in stats
    assert "low" in stats


def test_update_threat_status_lifecycle(client: TestClient):
    """PATCH /api/v1/threats/{id}/status transitions threat between ACTIVE, ACKNOWLEDGED, RESOLVED."""
    now_iso = "2026-08-29T10:45:00.000000+00:00"

    # Create intrusion event to generate threat
    ev_payload = {
        "camera_id": "CAM-TEST-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.94,
        "metadata": {"fence_zone": "East Perimeter"},
    }
    client.post("/api/v1/events", json=ev_payload)

    active_resp = client.get("/api/v1/threats/active?camera_id=CAM-TEST-01")
    threats = active_resp.json()
    assert len(threats) >= 1
    threat_id = threats[0]["threat_id"]

    # Update to ACKNOWLEDGED
    patch1 = client.patch(
        f"/api/v1/threats/{threat_id}/status",
        json={"status": "ACKNOWLEDGED", "reason": "Security patrol dispatched to East Perimeter"},
    )
    assert patch1.status_code == 200
    assert patch1.json()["status"] == "ACKNOWLEDGED"

    # Update to RESOLVED
    patch2 = client.patch(
        f"/api/v1/threats/{threat_id}/status",
        json={"status": "RESOLVED", "reason": "False alarm confirmed by patrol"},
    )
    assert patch2.status_code == 200
    assert patch2.json()["status"] == "RESOLVED"

    # Verify no longer in active threats
    active_resp2 = client.get("/api/v1/threats/active?camera_id=CAM-TEST-01")
    assert len(active_resp2.json()) == 0
