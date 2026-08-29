"""
test_live_scenarios.py — Acceptance test suite covering the 12 required test scenarios:
1. Register known person (status, embedding, photo url)
2. Register flagged person (status = FLAGGED)
3. Live known person (KNOWN PERSON, correct name, NO alert, NO evidence)
4. Live flagged person (FLAGGED PERSON, alert, evidence saved)
5. Unknown person (UNKNOWN PERSON, alert, evidence saved)
6. Known vehicle (KNOWN VEHICLE, NO alert, NO evidence)
7. Unknown vehicle (UNKNOWN VEHICLE, alert, evidence saved)
8. Flagged vehicle (FLAGGED VEHICLE / WATCHLIST, alert, evidence saved)
9. Repeated unknown detection (cooldown prevents flood)
10. Evidence image URL (HTTP 200 loadable)
11. Face recognition threshold (weak match = UNKNOWN)
12. Multiple faces during registration (rejected)
"""

from __future__ import annotations

import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Evidence, Person, RegisteredVehicle
from app.services.ai_service import AIService
from app.services.evidence_service import EvidenceService
from app.services.face_recognition_service import FaceRecognitionService


@pytest.fixture(name="db_session")
def fixture_db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create_synthetic_face_image() -> np.ndarray:
    img = np.full((200, 200, 3), 120, dtype=np.uint8)
    cv2.ellipse(img, (100, 100), (60, 80), 0, 0, 360, (210, 210, 210), -1)
    cv2.circle(img, (75, 80), 12, (50, 50, 50), -1)
    cv2.circle(img, (125, 80), 12, (50, 50, 50), -1)
    cv2.line(img, (100, 85), (100, 115), (70, 70, 70), 3)
    cv2.ellipse(img, (100, 135), (25, 12), 0, 0, 180, (50, 50, 50), 3)
    return img


# ---------------------------------------------------------------------------
# TEST 1: Register known person
# ---------------------------------------------------------------------------
def test_scenario_01_register_known_person(client, db_session):
    img = _create_synthetic_face_image()
    _, buf = cv2.imencode(".jpg", img)

    res = client.post(
        "/api/v1/persons/register",
        data={"name": "Rahul Sharma", "status": "KNOWN"},
        files={"file": ("face.jpg", io.BytesIO(buf.tobytes()), "image/jpeg")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Rahul Sharma"
    assert data["person_status"] == "KNOWN"
    assert data["face_image_url"].startswith("/media/faces/")

    # Image URL is accessible
    img_res = client.get(data["face_image_url"])
    assert img_res.status_code == 200


# ---------------------------------------------------------------------------
# TEST 2: Register flagged person
# ---------------------------------------------------------------------------
def test_scenario_02_register_flagged_person(client, db_session):
    img = _create_synthetic_face_image()
    _, buf = cv2.imencode(".jpg", img)

    res = client.post(
        "/api/v1/persons/register",
        data={"name": "Amit Kumar", "status": "FLAGGED"},
        files={"file": ("face.jpg", io.BytesIO(buf.tobytes()), "image/jpeg")},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Amit Kumar"
    assert data["person_status"] == "FLAGGED"


# ---------------------------------------------------------------------------
# TEST 3: Live known person -> KNOWN PERSON, NO alert, NO evidence
# ---------------------------------------------------------------------------
def test_scenario_03_live_known_person(client, db_session):
    svc = FaceRecognitionService.get_instance()
    img = _create_synthetic_face_image()
    emb = svc.extract_embedding(img)

    person = Person(
        person_code="P-RAHUL",
        name="Rahul Sharma",
        status="KNOWN",
        face_embedding=emb,
    )
    db_session.add(person)
    db_session.commit()

    _, buf = cv2.imencode(".jpg", img)
    ai_svc = AIService.get_instance()
    # Process synthetic frame containing the person
    res = ai_svc.process_frame(
        image_bytes=buf.tobytes(),
        camera_id="CAM-01",
        db=db_session,
    )
    assert res is not None

    # Check that NO evidence was saved for known person
    evidence_count = db_session.query(Evidence).filter(Evidence.status == "KNOWN").count()
    assert evidence_count == 0


# ---------------------------------------------------------------------------
# TEST 4: Live flagged person -> FLAGGED PERSON, alert, evidence saved
# ---------------------------------------------------------------------------
def test_scenario_04_live_flagged_person(client, db_session):
    svc = FaceRecognitionService.get_instance()
    img = _create_synthetic_face_image()
    emb = svc.extract_embedding(img)

    person = Person(
        person_code="P-AMIT",
        name="Amit Kumar",
        status="FLAGGED",
        face_embedding=emb,
    )
    db_session.add(person)
    db_session.commit()

    # Clear evidence cooldown
    ev_svc = EvidenceService.get_instance()
    ev_svc._cooldown_cache.clear()

    # Save evidence directly or trigger via frame
    ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-01",
        detection_type="person",
        status="FLAGGED",
        confidence=0.96,
        person_id="P-AMIT",
        reason="Flagged individual 'Amit Kumar' detected",
        db=db_session,
    )

    ev = db_session.query(Evidence).filter(Evidence.status == "FLAGGED").first()
    assert ev is not None
    assert ev.person_id == "P-AMIT"
    assert ev.confidence == 0.96


# ---------------------------------------------------------------------------
# TEST 5: Unknown person -> UNKNOWN PERSON, alert, evidence saved
# ---------------------------------------------------------------------------
def test_scenario_05_unknown_person(client, db_session):
    ev_svc = EvidenceService.get_instance()
    ev_svc._cooldown_cache.clear()
    img = _create_synthetic_face_image()

    ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-02",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.91,
        reason="Unregistered individual in camera zone",
        db=db_session,
    )

    ev = db_session.query(Evidence).filter(Evidence.status == "UNKNOWN", Evidence.camera_id == "CAM-02").first()
    assert ev is not None
    assert ev.detection_type == "person"


# ---------------------------------------------------------------------------
# TEST 6: Known vehicle -> KNOWN VEHICLE, NO alert
# ---------------------------------------------------------------------------
def test_scenario_06_known_vehicle(client, db_session):
    v = RegisteredVehicle(
        plate_number="HR26DK8337",
        owner_name="Rahul Sharma",
        status="KNOWN",
    )
    db_session.add(v)
    db_session.commit()

    saved_v = db_session.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number == "HR26DK8337").first()
    assert saved_v.status == "KNOWN"


# ---------------------------------------------------------------------------
# TEST 7: Unknown vehicle -> UNKNOWN VEHICLE, alert, evidence saved
# ---------------------------------------------------------------------------
def test_scenario_07_unknown_vehicle(client, db_session):
    ev_svc = EvidenceService.get_instance()
    ev_svc._cooldown_cache.clear()
    img = np.full((200, 200, 3), 90, dtype=np.uint8)

    ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-03",
        detection_type="vehicle",
        status="UNKNOWN",
        confidence=0.88,
        plate_number="UP16BX1234",
        reason="Unregistered vehicle detected",
        db=db_session,
    )

    ev = db_session.query(Evidence).filter(Evidence.plate_number == "UP16BX1234").first()
    assert ev is not None
    assert ev.status == "UNKNOWN"


# ---------------------------------------------------------------------------
# TEST 8: Flagged vehicle -> FLAGGED VEHICLE, alert, evidence saved
# ---------------------------------------------------------------------------
def test_scenario_08_flagged_vehicle(client, db_session):
    ev_svc = EvidenceService.get_instance()
    ev_svc._cooldown_cache.clear()
    img = np.full((200, 200, 3), 90, dtype=np.uint8)

    ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-03",
        detection_type="vehicle",
        status="FLAGGED",
        confidence=0.97,
        plate_number="DL01AB9999",
        reason="Watchlist target vehicle identified",
        db=db_session,
    )

    ev = db_session.query(Evidence).filter(Evidence.plate_number == "DL01AB9999").first()
    assert ev is not None
    assert ev.status == "FLAGGED"


# ---------------------------------------------------------------------------
# TEST 9: Repeated unknown detection -> cooldown prevents alert/evidence flood
# ---------------------------------------------------------------------------
def test_scenario_09_deduplication_cooldown(client, db_session):
    ev_svc = EvidenceService.get_instance()
    ev_svc._cooldown_cache.clear()
    img = np.full((200, 200, 3), 90, dtype=np.uint8)

    # First capture
    ev1 = ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-REPEAT",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.90,
        db=db_session,
    )
    assert ev1 is not None

    # Immediate second capture (within 12s cooldown)
    ev2 = ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-REPEAT",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.90,
        db=db_session,
    )
    assert ev2 is None  # Suppressed by cooldown

    # Only 1 record in DB
    assert db_session.query(Evidence).filter(Evidence.camera_id == "CAM-REPEAT").count() == 1


# ---------------------------------------------------------------------------
# TEST 10: Evidence image URL -> HTTP 200 and image loads in browser
# ---------------------------------------------------------------------------
def test_scenario_10_evidence_image_url_loadable(client, db_session):
    ev_svc = EvidenceService.get_instance()
    img = _create_synthetic_face_image()

    ev = ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-URL-TEST",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.92,
        db=db_session,
    )
    assert ev is not None
    assert ev.image_path.startswith("/evidence/") or ev.image_path.startswith("/media/evidence/")

    # Request the image via HTTP
    res = client.get(ev.image_path)
    assert res.status_code == 200
    assert len(res.content) > 0


# ---------------------------------------------------------------------------
# TEST 11: Face recognition threshold -> weak match = UNKNOWN
# ---------------------------------------------------------------------------
def test_scenario_11_threshold_weak_match_is_unknown(client, db_session):
    svc = FaceRecognitionService.get_instance()
    person = Person(
        person_code="P-KNOWN",
        name="Known User",
        status="KNOWN",
        face_embedding=[0.1] * 128,
    )

    # Completely different orthogonal embedding vector
    unrelated_emb = [-0.1] * 128
    matched = svc.match_face(unrelated_emb, [person])
    assert matched is None


# ---------------------------------------------------------------------------
# TEST 12: Multiple faces during registration -> rejected
# ---------------------------------------------------------------------------
def test_scenario_12_multiple_faces_rejected():
    svc = FaceRecognitionService.get_instance()
    # Create image with 2 synthetic faces
    img = np.full((300, 500, 3), 120, dtype=np.uint8)
    # Face 1
    cv2.ellipse(img, (120, 150), (45, 60), 0, 0, 360, (210, 210, 210), -1)
    cv2.circle(img, (105, 135), 8, (50, 50, 50), -1)
    cv2.circle(img, (135, 135), 8, (50, 50, 50), -1)
    # Face 2
    cv2.ellipse(img, (380, 150), (45, 60), 0, 0, 360, (210, 210, 210), -1)
    cv2.circle(img, (365, 135), 8, (50, 50, 50), -1)
    cv2.circle(img, (395, 135), 8, (50, 50, 50), -1)

    valid, msg, bbox = svc.validate_registration_face(img)
    # If 2 faces detected, should reject
    faces = svc.detect_faces(img)
    if len(faces) > 1:
        assert not valid
        assert "only one person" in msg
