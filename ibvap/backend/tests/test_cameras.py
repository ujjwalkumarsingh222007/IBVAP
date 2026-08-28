"""
test_cameras.py — Unit and integration tests for IBVAP camera management APIs.

Covers:
1. Create camera (POST /api/v1/cameras -> 201 Created).
2. List cameras (GET /api/v1/cameras -> 200 OK).
3. Get single camera (GET /api/v1/cameras/{camera_id} -> 200 OK).
4. Update camera (PUT /api/v1/cameras/{camera_id} -> 200 OK).
5. Delete camera (DELETE /api/v1/cameras/{camera_id} -> 204 No Content).
6. Duplicate camera_id rejection (409 Conflict).
7. Invalid camera status rejection (422 Unprocessable Entity).
8. Missing camera returns 404 Not Found.
9. Deleting camera retains historical events in the database.
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
# Camera CRUD & Validation Tests
# ---------------------------------------------------------------------------

def test_create_camera_success(client: TestClient):
    """POST /api/v1/cameras creates a new camera and returns 201 Created."""
    payload = {
        "camera_id": "CAM-01",
        "name": "Main Gate",
        "location": "North Entrance",
        "status": "ONLINE",
    }
    response = client.post("/api/v1/cameras", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["camera_id"] == "CAM-01"
    assert data["name"] == "Main Gate"
    assert data["location"] == "North Entrance"
    assert data["status"] == "ONLINE"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_camera_duplicate_id_returns_409(client: TestClient):
    """Duplicate camera_id must be rejected with 409 Conflict."""
    payload = {
        "camera_id": "CAM-01",
        "name": "First Camera",
        "location": "Sector A",
        "status": "ONLINE",
    }
    resp1 = client.post("/api/v1/cameras", json=payload)
    assert resp1.status_code == 201

    resp2 = client.post("/api/v1/cameras", json=payload)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"]


def test_create_camera_invalid_status_returns_422(client: TestClient):
    """Camera status other than ONLINE, OFFLINE, UNKNOWN returns 422."""
    payload = {
        "camera_id": "CAM-02",
        "name": "Test Camera",
        "status": "INVALID_STATUS",
    }
    resp = client.post("/api/v1/cameras", json=payload)
    assert resp.status_code == 422


def test_list_cameras(client: TestClient):
    """GET /api/v1/cameras returns all registered cameras."""
    client.post(
        "/api/v1/cameras",
        json={"camera_id": "CAM-01", "name": "Cam 1", "status": "ONLINE"},
    )
    client.post(
        "/api/v1/cameras",
        json={"camera_id": "CAM-02", "name": "Cam 2", "status": "OFFLINE"},
    )

    resp = client.get("/api/v1/cameras")
    assert resp.status_code == 200
    cameras = resp.json()
    assert len(cameras) == 2


def test_get_camera_by_id(client: TestClient):
    """GET /api/v1/cameras/{camera_id} returns the specific camera."""
    client.post(
        "/api/v1/cameras",
        json={
            "camera_id": "CAM-99",
            "name": "Tower Camera",
            "location": "Watchtower",
            "status": "UNKNOWN",
        },
    )

    resp = client.get("/api/v1/cameras/CAM-99")
    assert resp.status_code == 200
    assert resp.json()["camera_id"] == "CAM-99"
    assert resp.json()["location"] == "Watchtower"


def test_get_nonexistent_camera_returns_404(client: TestClient):
    """GET /api/v1/cameras/NONEXISTENT returns 404 Not Found."""
    resp = client.get("/api/v1/cameras/NONEXISTENT")
    assert resp.status_code == 404


def test_update_camera(client: TestClient):
    """PUT /api/v1/cameras/{camera_id} updates name, location, or status."""
    client.post(
        "/api/v1/cameras",
        json={"camera_id": "CAM-01", "name": "Old Name", "status": "ONLINE"},
    )

    update_resp = client.put(
        "/api/v1/cameras/CAM-01",
        json={"name": "New Name", "status": "OFFLINE", "location": "Perimeter East"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "New Name"
    assert data["status"] == "OFFLINE"
    assert data["location"] == "Perimeter East"


def test_delete_camera_and_verify_historical_events_retained(client: TestClient):
    """DELETE /api/v1/cameras/{camera_id} deletes camera without deleting historical events."""
    # 1. Register camera
    client.post(
        "/api/v1/cameras",
        json={"camera_id": "CAM-DELETE-TEST", "name": "Temporary Cam", "status": "ONLINE"},
    )

    # 2. Ingest an event from this camera
    event_resp = client.post(
        "/api/v1/events",
        json={
            "camera_id": "CAM-DELETE-TEST",
            "event_type": "INTRUSION_DETECTED",
            "timestamp": "2026-08-28T12:00:00Z",
            "confidence": 0.95,
            "metadata": {"test": True},
        },
    )
    assert event_resp.status_code == 201
    event_id = event_resp.json()["id"]

    # 3. Delete camera
    delete_resp = client.delete("/api/v1/cameras/CAM-DELETE-TEST")
    assert delete_resp.status_code == 204

    # 4. Camera is gone
    assert client.get("/api/v1/cameras/CAM-DELETE-TEST").status_code == 404

    # 5. Historical event is STILL present in database
    retrieved_event = client.get(f"/api/v1/events/{event_id}")
    assert retrieved_event.status_code == 200
    assert retrieved_event.json()["camera_id"] == "CAM-DELETE-TEST"
