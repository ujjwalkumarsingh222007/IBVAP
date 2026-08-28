"""
test_events.py — Unit and integration tests for IBVAP backend events API (Phase 1, 2A, 2C).

Covers:
1. GET / root health check.
2. POST /api/v1/events creation & validation.
3. GET /api/v1/events listing and newest-first ordering (created_at DESC, id DESC).
4. GET /api/v1/events filtering by event_type, camera_id, and confidence ranges.
5. GET /api/v1/events pagination (limit & offset).
6. GET /api/v1/events boundary validation (limit, offset, confidence, event_type).
7. GET /api/v1/events/count with and without filters.
8. GET /api/v1/events/stats aggregate statistics.
9. GET /api/v1/events/{id} single event retrieval and 404 for nonexistent id.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Event
from app.main import app

# ---------------------------------------------------------------------------
# In-Memory SQLite Test Database Setup (Isolated per test function)
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


@pytest.fixture
def db_session():
    """Direct database session for inserting controlled fixture data."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


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
# 2. Event Creation & Persistence (Phase 1D Regression)
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
# 4. Confidence & Field Validations
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


# ---------------------------------------------------------------------------
# 5. Querying, Filtering, Pagination & Ordering
# ---------------------------------------------------------------------------

def _seed_sample_events(client: TestClient):
    """Helper to populate test events across multiple cameras, types, and confidences."""
    events_data = [
        ("CAM-01", "INTRUSION_DETECTED", 0.95),
        ("CAM-01", "PERSON_DETECTED", 0.90),
        ("CAM-02", "VEHICLE_DETECTED", 0.85),
        ("CAM-02", "INTRUSION_DETECTED", 0.70),
        ("CAM-03", "ANPR_DETECTED", 0.99),
        ("CAM-01", "WATCHLIST_MATCH", 0.60),
        ("CAM-03", "SUSPICIOUS_ACTIVITY", 0.78),
    ]
    for idx, (cam, ev_type, conf) in enumerate(events_data):
        client.post(
            "/api/v1/events",
            json={
                "camera_id": cam,
                "event_type": ev_type,
                "timestamp": f"2026-08-28T10:{idx:02d}:00Z",
                "confidence": conf,
                "metadata": {"seq": idx},
            },
        )


def test_list_events_default(client: TestClient):
    """GET /api/v1/events returns events list with default pagination."""
    _seed_sample_events(client)
    resp = client.get("/api/v1/events")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 7


def test_list_events_ordered_newest_first(client: TestClient, db_session):
    """GET /api/v1/events returns events ordered by created_at DESC, id DESC."""
    base_time = datetime.now(timezone.utc)
    e1 = Event(
        camera_id="CAM-01",
        event_type="PERSON_DETECTED",
        timestamp="2026-08-28T10:00:00Z",
        confidence=0.9,
        event_metadata={"name": "first"},
        created_at=base_time - timedelta(minutes=10),
    )
    e2 = Event(
        camera_id="CAM-01",
        event_type="VEHICLE_DETECTED",
        timestamp="2026-08-28T10:05:00Z",
        confidence=0.9,
        event_metadata={"name": "second"},
        created_at=base_time - timedelta(minutes=5),
    )
    e3 = Event(
        camera_id="CAM-01",
        event_type="INTRUSION_DETECTED",
        timestamp="2026-08-28T10:10:00Z",
        confidence=0.9,
        event_metadata={"name": "third"},
        created_at=base_time,
    )
    db_session.add_all([e1, e2, e3])
    db_session.commit()

    resp = client.get("/api/v1/events")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    assert items[0]["metadata"]["name"] == "third"
    assert items[1]["metadata"]["name"] == "second"
    assert items[2]["metadata"]["name"] == "first"


def test_filter_by_event_type(client: TestClient):
    """GET /api/v1/events?event_type=INTRUSION_DETECTED filters properly."""
    _seed_sample_events(client)
    resp = client.get("/api/v1/events?event_type=INTRUSION_DETECTED")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    for item in data:
        assert item["event_type"] == "INTRUSION_DETECTED"


def test_filter_by_camera_id(client: TestClient):
    """GET /api/v1/events?camera_id=CAM-01 filters properly."""
    _seed_sample_events(client)
    resp = client.get("/api/v1/events?camera_id=CAM-01")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    for item in data:
        assert item["camera_id"] == "CAM-01"


def test_filter_by_confidence_min_and_max(client: TestClient):
    """GET /api/v1/events with confidence_min and confidence_max filters correctly."""
    _seed_sample_events(client)
    # Filter confidence >= 0.85 -> 0.95, 0.90, 0.85, 0.99 (4 events)
    resp = client.get("/api/v1/events?confidence_min=0.85")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 4
    for ev in data:
        assert ev["confidence"] >= 0.85

    # Filter confidence between 0.70 and 0.85 -> 0.85, 0.70, 0.78 (3 events)
    resp_range = client.get("/api/v1/events?confidence_min=0.70&confidence_max=0.85")
    assert resp_range.status_code == 200
    data_range = resp_range.json()
    assert len(data_range) == 3
    for ev in data_range:
        assert 0.70 <= ev["confidence"] <= 0.85


def test_invalid_confidence_range_returns_422(client: TestClient):
    """confidence_min > confidence_max returns 422."""
    resp = client.get("/api/v1/events?confidence_min=0.90&confidence_max=0.80")
    assert resp.status_code == 422


def test_event_count_endpoint(client: TestClient):
    """GET /api/v1/events/count returns accurate event count matching filters."""
    _seed_sample_events(client)

    # Total count
    resp = client.get("/api/v1/events/count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 7

    # Filtered count
    resp_filtered = client.get("/api/v1/events/count?event_type=INTRUSION_DETECTED")
    assert resp_filtered.status_code == 200
    assert resp_filtered.json()["count"] == 2

    # Filtered count with camera and confidence
    resp_cam = client.get("/api/v1/events/count?camera_id=CAM-01&confidence_min=0.80")
    assert resp_cam.status_code == 200
    assert resp_cam.json()["count"] == 2


def test_pagination_limit_and_offset(client: TestClient):
    """Pagination parameters limit and offset work correctly."""
    _seed_sample_events(client)
    all_resp = client.get("/api/v1/events?limit=10")
    all_data = all_resp.json()

    offset_resp = client.get("/api/v1/events?limit=2&offset=2")
    assert offset_resp.status_code == 200
    offset_data = offset_resp.json()
    assert len(offset_data) == 2
    assert offset_data[0]["id"] == all_data[2]["id"]
    assert offset_data[1]["id"] == all_data[3]["id"]


def test_invalid_query_parameters_return_422(client: TestClient):
    """Invalid query parameter boundaries return 422."""
    assert client.get("/api/v1/events?limit=101").status_code == 422
    assert client.get("/api/v1/events?limit=0").status_code == 422
    assert client.get("/api/v1/events?offset=-1").status_code == 422
    assert client.get("/api/v1/events?event_type=INVALID_TYPE").status_code == 422
    assert client.get("/api/v1/events?confidence_min=-0.1").status_code == 422
    assert client.get("/api/v1/events?confidence_max=1.5").status_code == 422


# ---------------------------------------------------------------------------
# 6. Event Statistics Endpoint
# ---------------------------------------------------------------------------

def test_event_stats_empty_database(client: TestClient):
    """GET /api/v1/events/stats on an empty database returns all zeros."""
    resp = client.get("/api/v1/events/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total_events"] == 0
    assert stats["total_intrusions"] == 0
    assert stats["total_vehicles"] == 0
    assert stats["total_persons"] == 0
    assert stats["total_anpr"] == 0
    assert stats["total_watchlist_matches"] == 0
    assert stats["total_suspicious_activity"] == 0
