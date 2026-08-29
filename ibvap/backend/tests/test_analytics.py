"""
test_analytics.py — Unit and integration tests for IBVAP operational analytics & event intelligence.

Covers:
1. Analytics summary aggregation via SQL.
2. Empty database returns clean zeroed metrics without division by zero.
3. Start time and end time range filtering.
4. Reversible / invalid date range returns 400 Bad Request.
5. Camera-specific analytics filtering.
6. Event-type specific analytics filtering.
7. Time-series trends (hourly and daily buckets).
8. Event distribution calculation and percentage ratios.
9. Camera threat density ranking and ordering.
10. Correct threat severity categorization (Critical, High, Medium, Low).
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
from app.models import Camera, Event

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
        # Seed Cameras
        cams = [
            Camera(camera_id="CAM-01", name="North Perimeter", location="Sector 4", status="ONLINE"),
            Camera(camera_id="CAM-02", name="Main Gate Checkpoint", location="Gate A", status="ONLINE"),
            Camera(camera_id="CAM-03", name="South Valley PTZ", location="Sector 9", status="OFFLINE"),
        ]
        db.add_all(cams)

        # Seed Multi-Category Detections with Spaced Timestamps
        events = [
            # Day 1 - CAM-01
            Event(
                camera_id="CAM-01",
                event_type="INTRUSION_DETECTED",
                timestamp="2026-08-28T10:00:00Z",
                confidence=0.95,
                event_metadata={"track_id": 1, "zone": "North Fence"},
            ),
            Event(
                camera_id="CAM-01",
                event_type="PERSON_DETECTED",
                timestamp="2026-08-28T10:30:00Z",
                confidence=0.90,
                event_metadata={"track_id": 1},
            ),
            # Day 1 - CAM-02
            Event(
                camera_id="CAM-02",
                event_type="WATCHLIST_MATCH",
                timestamp="2026-08-28T11:00:00Z",
                confidence=0.98,
                event_metadata={"plate_number": "MH12DE1433", "watchlist_status": "STOLEN"},
            ),
            Event(
                camera_id="CAM-02",
                event_type="ANPR_DETECTED",
                timestamp="2026-08-28T11:05:00Z",
                confidence=0.92,
                event_metadata={"plate_number": "DL01AB1234"},
            ),
            Event(
                camera_id="CAM-02",
                event_type="VEHICLE_DETECTED",
                timestamp="2026-08-28T12:00:00Z",
                confidence=0.85,
                event_metadata={"class_name": "truck"},
            ),
            # Day 2 - CAM-01
            Event(
                camera_id="CAM-01",
                event_type="SUSPICIOUS_ACTIVITY",
                timestamp="2026-08-29T08:00:00Z",
                confidence=0.80,
                event_metadata={"reason": "Loitering near fence"},
            ),
            Event(
                camera_id="CAM-01",
                event_type="INTRUSION_DETECTED",
                timestamp="2026-08-29T08:15:00Z",
                confidence=0.96,
                event_metadata={"track_id": 2},
            ),
            # Day 2 - CAM-03
            Event(
                camera_id="CAM-03",
                event_type="OBJECT_DETECTED",
                timestamp="2026-08-29T09:00:00Z",
                confidence=0.75,
                event_metadata={"class_name": "backpack"},
            ),
        ]
        db.add_all(events)
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


# ---------------------------------------------------------------------------
# Summary & Aggregation Tests
# ---------------------------------------------------------------------------

def test_get_analytics_summary_all(client: TestClient):
    """GET /api/v1/analytics/summary returns accurate aggregated metrics."""
    response = client.get("/api/v1/analytics/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_events"] == 8

    # Threat matrix:
    # Critical: 1 (WATCHLIST_MATCH)
    # High: 3 (2 INTRUSION_DETECTED + 1 SUSPICIOUS_ACTIVITY)
    # Medium: 1 (1 VEHICLE_DETECTED)
    # Low: 3 (1 PERSON + 1 ANPR + 1 OBJECT)
    # Total threats = 1 + 3 + 1 = 5
    threats = data["threats"]
    assert threats["critical"] == 1
    assert threats["high"] == 3
    assert threats["medium"] == 1
    assert threats["low"] == 3
    assert threats["total_threats"] == 5

    # Confidence statistics
    conf = data["confidence_stats"]
    assert conf["min_confidence"] == 0.75
    assert conf["max_confidence"] == 0.98
    assert 0.88 <= conf["avg_confidence"] <= 0.91


def test_get_analytics_summary_empty_db(client: TestClient):
    """GET /api/v1/analytics/summary returns clean zeros when no events match."""
    # Query for future time range where 0 events exist
    response = client.get("/api/v1/analytics/summary?start_time=2030-01-01T00:00:00Z")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 0
    assert data["threats"]["total_threats"] == 0
    assert data["confidence_stats"]["avg_confidence"] == 0.0
    assert data["confidence_stats"]["min_confidence"] == 0.0


# ---------------------------------------------------------------------------
# Date Range & Multi-Filter Tests
# ---------------------------------------------------------------------------

def test_analytics_date_filtering(client: TestClient):
    """Date filtering restricts summary to events within specified time window."""
    # Filter only Day 1 events (2026-08-28)
    response = client.get(
        "/api/v1/analytics/summary?start_time=2026-08-28T00:00:00Z&end_time=2026-08-28T23:59:59Z"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 5


def test_analytics_invalid_date_range_returns_400(client: TestClient):
    """start_time > end_time must return HTTP 400 Bad Request."""
    response = client.get(
        "/api/v1/analytics/summary?start_time=2026-08-29T00:00:00Z&end_time=2026-08-28T00:00:00Z"
    )
    assert response.status_code == 400
    assert "Invalid time range" in response.json()["detail"]


def test_analytics_camera_filtering(client: TestClient):
    """Camera filter returns metrics only for selected camera."""
    response = client.get("/api/v1/analytics/summary?camera_id=CAM-01")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 4
    assert data["threats"]["high"] == 3  # 2 intrusions + 1 suspicious


def test_analytics_event_type_filtering(client: TestClient):
    """Event type filter returns metrics specifically for that event category."""
    response = client.get("/api/v1/analytics/summary?event_type=INTRUSION_DETECTED")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 2
    assert data["threats"]["high"] == 2


# ---------------------------------------------------------------------------
# Time-Series Trends Tests
# ---------------------------------------------------------------------------

def test_analytics_trends_hourly(client: TestClient):
    """GET /api/v1/analytics/trends returns hourly trend buckets."""
    response = client.get("/api/v1/analytics/trends?interval=hourly")
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == "hourly"
    trends = data["trends"]
    assert len(trends) >= 4  # Spans 10:00, 11:00, 12:00 on Day 1, 08:00, 09:00 on Day 2

    total_sum = sum(t["total_events"] for t in trends)
    assert total_sum == 8


def test_analytics_trends_daily(client: TestClient):
    """GET /api/v1/analytics/trends returns daily trend buckets."""
    response = client.get("/api/v1/analytics/trends?interval=daily")
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == "daily"
    trends = data["trends"]
    assert len(trends) == 2  # 2026-08-28 and 2026-08-29

    day1 = next(t for t in trends if "2026-08-28" in t["bucket"])
    day2 = next(t for t in trends if "2026-08-29" in t["bucket"])
    assert day1["total_events"] == 5
    assert day2["total_events"] == 3


# ---------------------------------------------------------------------------
# Distribution & Camera Activity Ranking Tests
# ---------------------------------------------------------------------------

def test_analytics_distribution(client: TestClient):
    """GET /api/v1/analytics/distribution computes percentages and category shares."""
    response = client.get("/api/v1/analytics/distribution")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 8
    dist = data["distribution"]
    assert len(dist) == 7  # 7 distinct event types in test data

    # Percentages sum to 100%
    total_pct = sum(item["percentage"] for item in dist)
    assert 99.9 <= total_pct <= 100.1


def test_analytics_cameras_ranking(client: TestClient):
    """GET /api/v1/analytics/cameras ranks cameras by threat density and activity."""
    response = client.get("/api/v1/analytics/cameras")
    assert response.status_code == 200
    data = response.json()
    cameras = data["cameras"]
    assert len(cameras) >= 3

    # CAM-01 has 3 threats (2 intrusions + 1 suspicious), CAM-02 has 2 threats (1 watchlist + 1 vehicle)
    assert cameras[0]["camera_id"] == "CAM-01"
    assert cameras[0]["threat_count"] == 3
    assert cameras[0]["camera_name"] == "North Perimeter"
    assert cameras[0]["location"] == "Sector 4"

    assert cameras[1]["camera_id"] == "CAM-02"
    assert cameras[1]["critical_threats"] == 1
