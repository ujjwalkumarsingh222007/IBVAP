"""
test_demo.py — Unit and integration tests for demo management, reset endpoints, and enhanced health checks.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import AuditLog, Camera, Event

# In-Memory Test Database
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine
)


@pytest.fixture(autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        # Seed initial dummy events
        ev1 = Event(
            camera_id="CAM-01",
            event_type="INTRUSION_DETECTED",
            timestamp="2026-08-29T10:00:00Z",
            confidence=0.95,
            event_metadata={"track_id": 1},
        )
        ev2 = Event(
            camera_id="CAM-02",
            event_type="WATCHLIST_MATCH",
            timestamp="2026-08-29T10:05:00Z",
            confidence=0.98,
            event_metadata={"plate_number": "MH12DE1433"},
        )
        db.add_all([ev1, ev2])
        db.commit()
    finally:
        db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_demo_reset_successful(client: TestClient):
    """POST /api/v1/demo/reset clears events and verifies baseline cameras."""
    resp = client.post("/api/v1/demo/reset", json={"confirm": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["events_cleared"] == 2
    assert data["cameras_restored"] == 4

    # Verify database has 0 events remaining
    db = TestingSessionLocal()
    try:
        events_count = db.query(Event).count()
        assert events_count == 0

        # Verify audit log was created
        audit_log = db.query(AuditLog).filter(AuditLog.action == "RESET_DEMO_DATA").first()
        assert audit_log is not None
        assert audit_log.success is True
    finally:
        db.close()


def test_demo_reset_requires_confirmation(client: TestClient):
    """POST /api/v1/demo/reset without confirm=True returns HTTP 400 Bad Request."""
    resp = client.post("/api/v1/demo/reset", json={"confirm": False})
    assert resp.status_code == 400
    assert "Confirmation required" in resp.json()["detail"]


def test_enhanced_health_endpoint(client: TestClient):
    """GET /api/v1/health returns honest status, uptime, active cameras, and total events."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["version"] == "1.0.0"
    assert "uptime_seconds" in data
    assert data["total_events"] == 2
