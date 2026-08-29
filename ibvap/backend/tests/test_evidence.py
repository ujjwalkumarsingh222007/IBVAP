"""
test_evidence.py — Test suite for evidence capture, querying, and deletion.
"""

import sys
from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, get_db
from app.main import app
from app.models import Evidence
from app.services.evidence_service import EvidenceService

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


def test_evidence_service_capture_and_deduplication():
    db = TestingSessionLocal()
    service = EvidenceService.get_instance()
    # Dummy BGR frame (100x100)
    frame = np.zeros((100, 100, 3), dtype=np.uint8)

    # 1. Capture unknown person evidence
    service._cooldown_cache.clear()
    ev1 = service.capture_evidence(
        frame=frame,
        camera_id="CAM-01",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.91,
        bbox={"x1": 10, "y1": 10, "x2": 50, "y2": 50},
        db=db,
    )
    assert ev1 is not None
    assert ev1.camera_id == "CAM-01"
    assert ev1.detection_type == "person"
    assert ev1.status == "UNKNOWN"
    assert ev1.confidence == 0.91
    assert ev1.image_path.startswith("/evidence/")
    assert ev1.crop_image_path is not None

    # 2. Known person should NEVER capture evidence
    ev_known = service.capture_evidence(
        frame=frame,
        camera_id="CAM-01",
        detection_type="person",
        status="KNOWN",
        confidence=0.95,
        db=db,
    )
    assert ev_known is None

    # 3. Deduplication: immediate second capture of same target should be suppressed
    ev_dup = service.capture_evidence(
        frame=frame,
        camera_id="CAM-01",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.92,
        db=db,
    )
    assert ev_dup is None
    db.close()


def test_evidence_api_list_and_count(client):
    db = TestingSessionLocal()
    service = EvidenceService.get_instance()
    frame = np.zeros((100, 100, 3), dtype=np.uint8)

    # Manually capture flagged vehicle
    service._cooldown_cache.clear()
    ev = service.capture_evidence(
        frame=frame,
        camera_id="CAM-02",
        detection_type="vehicle",
        status="FLAGGED",
        confidence=0.96,
        plate_number="TN09AB1234",
        reason="Stolen vehicle",
        db=db,
    )
    assert ev is not None

    # GET /api/v1/evidence
    res = client.get("/api/v1/evidence")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    found = any(e["plate_number"] == "TN09AB1234" for e in data)
    assert found

    # GET /api/v1/evidence/count
    count_res = client.get("/api/v1/evidence/count")
    assert count_res.status_code == 200
    assert count_res.json()["count"] >= 1

    # GET /api/v1/evidence/{id}
    detail_res = client.get(f"/api/v1/evidence/{ev.id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["status"] == "FLAGGED"

    # DELETE /api/v1/evidence/{id}
    del_res = client.delete(f"/api/v1/evidence/{ev.id}")
    assert del_res.status_code == 200
    db.close()
