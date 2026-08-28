"""
test_events.py — Unit and integration tests for IBVAP backend API and event persistence.

Tests all specified behaviors:
1. GET / works.
2. POST /api/v1/events accepts valid event.
3. Event is persisted in database.
4. Response contains generated ID.
5. camera_id is stored.
6. event_type is stored.
7. timestamp is stored.
8. confidence is stored.
9. metadata is stored.
10. INTRUSION_DETECTED works.
11. OBJECT_DETECTED works.
12. VEHICLE_DETECTED works.
13. PERSON_DETECTED works.
14. ANPR_DETECTED works.
15. WATCHLIST_MATCH works.
16. SUSPICIOUS_ACTIVITY works.
17. Unknown event_type returns 422.
18. Invalid confidence (<0.0, >1.0) returns 422.
19. Missing required fields return 422.
20. Invalid metadata (non-dict) returns 422.
21. GET /api/v1/events and GET /api/v1/events/{id} work as expected.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# In-Memory SQLite Test Database Setup (Isolated per test session/function)
# ---------------------------------------------------------------------------
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
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    """FastAPI TestClient with overridden database dependency."""
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
# 1. Health / Root Endpoint
# ---------------------------------------------------------------------------

def test_root_health_check(client: TestClient):
    """GET / must return status 200 with service information."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "ok"
    assert "service" in data


# ---------------------------------------------------------------------------
# 2. Event Creation & Persistence
# ---------------------------------------------------------------------------

def test_post_event_accepts_valid_payload_and_persists(client: TestClient):
    """POST /api/v1/events accepts a valid Member 1 CV intrusion event."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": "2026-08-28T15:30:00Z",
        "confidence": 0.94,
        "metadata": {
            "track_id": 17,
            "class_name": "person",
            "bbox": [120, 80, 300, 450],
            "position": {"x": 210, "y": 265},
        },
    }

    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert isinstance(data["id"], int)
    assert data["id"] >= 1
    assert data["camera_id"] == "CAM-01"
    assert data["event_type"] == "INTRUSION_DETECTED"
    assert data["timestamp"] == "2026-08-28T15:30:00Z"
    assert abs(data["confidence"] - 0.94) < 1e-4
    assert data["metadata"]["track_id"] == 17
    assert data["metadata"]["class_name"] == "person"
    assert data["metadata"]["bbox"] == [120, 80, 300, 450]
    assert data["metadata"]["position"] == {"x": 210, "y": 265}


def test_event_can_be_retrieved_after_creation(client: TestClient):
    """Event persisted via POST can be retrieved via GET /api/v1/events/{id}."""
    payload = {
        "camera_id": "CAM-02",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": "2026-08-28T16:00:00Z",
        "confidence": 0.88,
        "metadata": {
            "track_id": 4,
            "class_name": "car",
            "bbox": [50, 60, 200, 180],
        },
    }
    create_resp = client.post("/api/v1/events", json=payload)
    assert create_resp.status_code == 201
    event_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/v1/events/{event_id}")
    assert get_resp.status_code == 200
    retrieved = get_resp.json()
    assert retrieved["id"] == event_id
    assert retrieved["camera_id"] == "CAM-02"
    assert retrieved["event_type"] == "VEHICLE_DETECTED"


def test_list_events(client: TestClient):
    """GET /api/v1/events lists persisted events."""
    for i in range(3):
        client.post(
            "/api/v1/events",
            json={
                "camera_id": f"CAM-{i}",
                "event_type": "OBJECT_DETECTED",
                "timestamp": "2026-08-28T12:00:00Z",
                "confidence": 0.75,
                "metadata": {"seq": i},
            },
        )
    list_resp = client.get("/api/v1/events")
    assert list_resp.status_code == 200
    events = list_resp.json()
    assert len(events) == 3


def test_get_nonexistent_event_returns_404(client: TestClient):
    """GET /api/v1/events/99999 returns 404 Not Found."""
    resp = client.get("/api/v1/events/99999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 3. Validation for All Allowed Event Types
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "event_type",
    [
        "OBJECT_DETECTED",
        "VEHICLE_DETECTED",
        "PERSON_DETECTED",
        "ANPR_DETECTED",
        "INTRUSION_DETECTED",
        "WATCHLIST_MATCH",
        "SUSPICIOUS_ACTIVITY",
    ],
)
def test_all_allowed_event_types_succeed(client: TestClient, event_type: str):
    """All 7 allowed event types must be accepted with HTTP 201."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": event_type,
        "timestamp": "2026-08-28T10:00:00Z",
        "confidence": 0.85,
        "metadata": {"sample_key": "sample_value"},
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201
    assert response.json()["event_type"] == event_type


def test_unknown_event_type_rejected_with_422(client: TestClient):
    """Unapproved event types must be rejected by Pydantic with HTTP 422."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": "UNKNOWN_CUSTOM_EVENT",
        "timestamp": "2026-08-28T10:00:00Z",
        "confidence": 0.90,
        "metadata": {},
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 4. Confidence Score Validation
# ---------------------------------------------------------------------------

def test_confidence_boundary_values(client: TestClient):
    """Confidence values 0.0 and 1.0 are valid."""
    for conf in [0.0, 1.0]:
        response = client.post(
            "/api/v1/events",
            json={
                "camera_id": "CAM-01",
                "event_type": "INTRUSION_DETECTED",
                "timestamp": "2026-08-28T10:00:00Z",
                "confidence": conf,
                "metadata": {},
            },
        )
        assert response.status_code == 201


def test_confidence_out_of_range_rejected_with_422(client: TestClient):
    """Confidence < 0.0 or > 1.0 must return 422."""
    for invalid_conf in [-0.1, 1.01, 2.5, -100.0]:
        response = client.post(
            "/api/v1/events",
            json={
                "camera_id": "CAM-01",
                "event_type": "INTRUSION_DETECTED",
                "timestamp": "2026-08-28T10:00:00Z",
                "confidence": invalid_conf,
                "metadata": {},
            },
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# 5. Missing / Invalid Fields Validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "missing_field",
    ["camera_id", "event_type", "timestamp", "confidence", "metadata"],
)
def test_missing_required_field_returns_422(client: TestClient, missing_field: str):
    """Omitting any top-level required field must return 422."""
    valid_payload = {
        "camera_id": "CAM-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": "2026-08-28T10:00:00Z",
        "confidence": 0.90,
        "metadata": {"test": 123},
    }
    del valid_payload[missing_field]
    response = client.post("/api/v1/events", json=valid_payload)
    assert response.status_code == 422


def test_invalid_metadata_type_returns_422(client: TestClient):
    """metadata must be a JSON object (dict), not a string, list, or number."""
    for invalid_meta in ["string_meta", [1, 2, 3], 12345]:
        response = client.post(
            "/api/v1/events",
            json={
                "camera_id": "CAM-01",
                "event_type": "INTRUSION_DETECTED",
                "timestamp": "2026-08-28T10:00:00Z",
                "confidence": 0.90,
                "metadata": invalid_meta,
            },
        )
        assert response.status_code == 422


def test_empty_camera_id_returns_422(client: TestClient):
    """camera_id with empty string must return 422."""
    response = client.post(
        "/api/v1/events",
        json={
            "camera_id": "",
            "event_type": "INTRUSION_DETECTED",
            "timestamp": "2026-08-28T10:00:00Z",
            "confidence": 0.90,
            "metadata": {},
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 6. Future ANPR (Member 2) Metadata Compatibility
# ---------------------------------------------------------------------------

def test_anpr_event_metadata_flexibility(client: TestClient):
    """Backend accommodates flexible ANPR metadata from Member 2."""
    anpr_payload = {
        "camera_id": "CAM-ANPR-01",
        "event_type": "ANPR_DETECTED",
        "timestamp": "2026-08-28T18:00:00Z",
        "confidence": 0.98,
        "metadata": {
            "license_plate": "ABC-1234",
            "country": "IN",
            "vehicle_color": "white",
            "crop_url": "/images/plates/1234.jpg",
        },
    }
    response = client.post("/api/v1/events", json=anpr_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["metadata"]["license_plate"] == "ABC-1234"
    assert data["metadata"]["country"] == "IN"
