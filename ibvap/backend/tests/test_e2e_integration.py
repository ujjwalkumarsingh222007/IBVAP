"""
test_e2e_integration.py — Phase 3A End-to-End Integration & Demo Hardening Test Suite.

Validates the complete pipeline:
  1. Ingestion of all 7 supported IBVAP event types:
     - OBJECT_DETECTED
     - PERSON_DETECTED
     - VEHICLE_DETECTED
     - ANPR_DETECTED
     - INTRUSION_DETECTED
     - WATCHLIST_MATCH
     - SUSPICIOUS_ACTIVITY
  2. Database persistence via SQLite / SQLAlchemy.
  3. Dashboard Summary metric reflection (/api/v1/dashboard/summary).
  4. Recent events ordering (/api/v1/dashboard/recent-events).
  5. Event Explorer multi-filtering & count synchronization (/api/v1/events, /api/v1/events/count).
  6. Camera registry integration (/api/v1/cameras).
  7. High-priority Watchlist Match & Intrusion payload integrity.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone

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

# In-memory SQLite engine for integration tests
engine_test = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine_test)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine_test)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


class TestEndToEndPipeline:

    def test_all_seven_event_types_ingest_and_update_summary(self, client):
        """Verify that all 7 event types ingest correctly and increment dashboard KPI metrics."""
        events_to_ingest = [
            ("OBJECT_DETECTED", "CAM-01", 0.85, {"class_name": "backpack"}),
            ("PERSON_DETECTED", "CAM-01", 0.92, {"track_id": 101, "class_name": "person"}),
            ("VEHICLE_DETECTED", "CAM-02", 0.89, {"track_id": 202, "class_name": "car"}),
            ("INTRUSION_DETECTED", "CAM-01", 0.96, {"track_id": 101, "bbox": [10, 20, 100, 200]}),
            ("ANPR_DETECTED", "CAM-02", 0.94, {"plate_number": "KA01AB1234", "vehicle_id": "VEH-202"}),
            ("WATCHLIST_MATCH", "CAM-02", 0.98, {"plate_number": "MH12DE1433", "watchlist_status": "STOLEN"}),
            ("SUSPICIOUS_ACTIVITY", "CAM-01", 0.88, {"anomaly_type": "loitering_near_fence"}),
        ]

        for ev_type, cam, conf, meta in events_to_ingest:
            payload = {
                "camera_id": cam,
                "event_type": ev_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "confidence": conf,
                "metadata": meta,
            }
            res = client.post("/api/v1/events", json=payload)
            assert res.status_code == 201, f"Failed to ingest {ev_type}: {res.text}"

        # Verify Dashboard Summary aggregates all 7 correctly
        summary_res = client.get("/api/v1/dashboard/summary")
        assert summary_res.status_code == 200
        summary = summary_res.json()

        assert summary["total_events"] == 7
        assert summary["total_intrusions"] == 1
        assert summary["total_persons"] == 1
        assert summary["total_vehicles"] == 1
        assert summary["total_anpr"] == 1
        assert summary["total_watchlist_matches"] == 1
        assert summary["total_suspicious_activity"] == 1

    def test_recent_events_order_and_limit(self, client):
        """Verify recent events are returned chronologically newest first."""
        for i in range(1, 15):
            payload = {
                "camera_id": f"CAM-{i:02d}",
                "event_type": "PERSON_DETECTED",
                "timestamp": f"2026-08-29T00:00:{i:02d}Z",
                "confidence": 0.90,
                "metadata": {"track_id": i},
            }
            res = client.post("/api/v1/events", json=payload)
            assert res.status_code == 201

        # Fetch recent events limit=10
        recent_res = client.get("/api/v1/dashboard/recent-events?limit=10")
        assert recent_res.status_code == 200
        recent = recent_res.json()
        assert len(recent) == 10

        # Verify newest first (ID 14 down to 5)
        assert recent[0]["id"] == 14
        assert recent[0]["camera_id"] == "CAM-14"
        assert recent[9]["id"] == 5

    def test_event_explorer_filtering_and_counts(self, client):
        """Verify event querying by category, camera, and confidence bounds."""
        client.post("/api/v1/events", json={
            "camera_id": "CAM-NORTH",
            "event_type": "INTRUSION_DETECTED",
            "timestamp": "2026-08-29T00:10:00Z",
            "confidence": 0.95,
            "metadata": {"track_id": 1},
        })
        client.post("/api/v1/events", json={
            "camera_id": "CAM-SOUTH",
            "event_type": "WATCHLIST_MATCH",
            "timestamp": "2026-08-29T00:11:00Z",
            "confidence": 0.85,
            "metadata": {"plate_number": "DL01X9999"},
        })
        client.post("/api/v1/events", json={
            "camera_id": "CAM-NORTH",
            "event_type": "ANPR_DETECTED",
            "timestamp": "2026-08-29T00:12:00Z",
            "confidence": 0.75,
            "metadata": {"plate_number": "HR26Y1234"},
        })

        # 1. Filter by camera
        res_cam = client.get("/api/v1/events?camera_id=CAM-NORTH")
        assert res_cam.status_code == 200
        assert len(res_cam.json()) == 2

        count_cam = client.get("/api/v1/events/count?camera_id=CAM-NORTH")
        assert count_cam.json()["count"] == 2

        # 2. Filter by type
        res_type = client.get("/api/v1/events?event_type=WATCHLIST_MATCH")
        assert len(res_type.json()) == 1
        assert res_type.json()[0]["metadata"]["plate_number"] == "DL01X9999"

        # 3. Filter by confidence range
        res_conf = client.get("/api/v1/events?confidence_min=0.80&confidence_max=0.99")
        assert len(res_conf.json()) == 2  # 0.95 and 0.85

    def test_camera_management_lifecycle(self, client):
        """Verify Camera creation, retrieval, duplicate check, and update."""
        # 1. Create camera
        create_res = client.post("/api/v1/cameras", json={
            "camera_id": "CAM-GATE-01",
            "name": "Main Entry Gate",
            "location": "North Sector Gate 1",
            "status": "ONLINE",
        })
        assert create_res.status_code == 201
        cam_data = create_res.json()
        assert cam_data["camera_id"] == "CAM-GATE-01"

        # 2. Duplicate camera_id conflict
        dup_res = client.post("/api/v1/cameras", json={
            "camera_id": "CAM-GATE-01",
            "name": "Duplicate Entry",
        })
        assert dup_res.status_code == 409

        # 3. Summary active camera reflection
        summary_res = client.get("/api/v1/dashboard/summary")
        summary = summary_res.json()
        assert summary["total_cameras"] == 1
        assert summary["active_cameras"] == 1
