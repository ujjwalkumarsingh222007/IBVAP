"""
test_dashboard.py — Unit and integration tests for surveillance dashboard endpoints.

Covers:
1. Dashboard summary on empty database.
2. Dashboard summary calculation with populated events and cameras.
3. Recent events retrieval with newest-first ordering.
4. Recent events limit parameter and validation (limit 1-50).
"""

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

# Isolated In-Memory Test Database
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


# ---------------------------------------------------------------------------
# Dashboard Tests
# ---------------------------------------------------------------------------

def test_dashboard_summary_empty_db(client: TestClient):
    """Summary on empty DB returns all zeros."""
    resp = client.get("/api/v1/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_events"] == 0
    assert data["total_intrusions"] == 0
    assert data["total_persons"] == 0
    assert data["total_vehicles"] == 0
    assert data["total_anpr"] == 0
    assert data["total_watchlist_matches"] == 0
    assert data["total_suspicious_activity"] == 0
    assert data["active_cameras"] == 0
    assert data["total_cameras"] == 0


def test_dashboard_summary_populated(client: TestClient):
    """Summary computes all event categories and active camera counts."""
    # 1. Seed cameras (2 online, 1 offline)
    client.post("/api/v1/cameras", json={"camera_id": "CAM-01", "name": "Cam 1", "status": "ONLINE"})
    client.post("/api/v1/cameras", json={"camera_id": "CAM-02", "name": "Cam 2", "status": "ONLINE"})
    client.post("/api/v1/cameras", json={"camera_id": "CAM-03", "name": "Cam 3", "status": "OFFLINE"})

    # 2. Seed events
    events = [
        "INTRUSION_DETECTED",
        "INTRUSION_DETECTED",
        "PERSON_DETECTED",
        "VEHICLE_DETECTED",
        "ANPR_DETECTED",
        "WATCHLIST_MATCH",
        "SUSPICIOUS_ACTIVITY",
    ]
    for ev in events:
        client.post(
            "/api/v1/events",
            json={
                "camera_id": "CAM-01",
                "event_type": ev,
                "timestamp": "2026-08-28T12:00:00Z",
                "confidence": 0.90,
                "metadata": {},
            },
        )

    resp = client.get("/api/v1/dashboard/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["total_events"] == 7
    assert summary["total_intrusions"] == 2
    assert summary["total_persons"] == 1
    assert summary["total_vehicles"] == 1
    assert summary["total_anpr"] == 1
    assert summary["total_watchlist_matches"] == 1
    assert summary["total_suspicious_activity"] == 1
    assert summary["active_cameras"] == 2
    assert summary["total_cameras"] == 3


def test_recent_events_ordering_and_limit(client: TestClient):
    """Recent events returns latest events ordered newest-first with limit support."""
    for idx in range(15):
        client.post(
            "/api/v1/events",
            json={
                "camera_id": f"CAM-{idx % 3}",
                "event_type": "PERSON_DETECTED",
                "timestamp": f"2026-08-28T10:{idx:02d}:00Z",
                "confidence": 0.85,
                "metadata": {"seq": idx},
            },
        )

    # Default limit is 10
    resp_default = client.get("/api/v1/dashboard/recent-events")
    assert resp_default.status_code == 200
    items = resp_default.json()
    assert len(items) == 10
    # Newest (highest id/seq) is first
    assert items[0]["metadata"]["seq"] == 14
    assert items[1]["metadata"]["seq"] == 13

    # Custom limit 5
    resp_limit = client.get("/api/v1/dashboard/recent-events?limit=5")
    assert resp_limit.status_code == 200
    assert len(resp_limit.json()) == 5


def test_recent_events_limit_validation(client: TestClient):
    """Recent events limit < 1 or > 50 returns 422."""
    assert client.get("/api/v1/dashboard/recent-events?limit=0").status_code == 422
    assert client.get("/api/v1/dashboard/recent-events?limit=51").status_code == 422
