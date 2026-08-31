"""
test_face_recognition.py — Tests for Face Detection, Feature Embeddings,
Registration API, and Live Known/Flagged/Unknown Decision Logic.
"""

from __future__ import annotations

import io
import time
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Person, RegisteredVehicle, User
from app.services.evidence_service import EvidenceService
from app.services.face_recognition_service import FaceRecognitionService


# ---------------------------------------------------------------------------
# Test Fixtures
# ---------------------------------------------------------------------------

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
    """Generate a 200x200 synthetic BGR image with a recognizable face-like oval."""
    img = np.full((200, 200, 3), 120, dtype=np.uint8)
    # Head oval
    cv2.ellipse(img, (100, 100), (60, 80), 0, 0, 360, (210, 210, 210), -1)
    # Eyes
    cv2.circle(img, (75, 80), 12, (50, 50, 50), -1)
    cv2.circle(img, (125, 80), 12, (50, 50, 50), -1)
    # Nose
    cv2.line(img, (100, 85), (100, 115), (70, 70, 70), 3)
    # Mouth
    cv2.ellipse(img, (100, 135), (25, 12), 0, 0, 180, (50, 50, 50), 3)
    return img


# ---------------------------------------------------------------------------
# Unit Tests: Face Service
# ---------------------------------------------------------------------------

def test_face_embedding_extraction_and_unit_normalization():
    svc = FaceRecognitionService.get_instance()
    img = _create_synthetic_face_image()
    emb = svc.extract_embedding(img)
    assert emb is not None
    assert len(emb) > 0
    # Check L2 unit norm
    norm = np.linalg.norm(np.array(emb, dtype=np.float32))
    assert abs(norm - 1.0) < 1e-4


def test_cosine_similarity_matching():
    svc = FaceRecognitionService.get_instance()
    img1 = _create_synthetic_face_image()
    emb1 = svc.extract_embedding(img1)
    assert emb1 is not None

    # Identical image similarity should be ~1.0
    sim_same = svc.compute_similarity(emb1, emb1)
    assert sim_same > 0.99

    # Orthogonal / different vector
    diff_emb = [-v for v in emb1]
    sim_diff = svc.compute_similarity(emb1, diff_emb)
    assert sim_diff < 0.0


def test_face_match_with_registered_person():
    svc = FaceRecognitionService.get_instance()
    img = _create_synthetic_face_image()
    emb = svc.extract_embedding(img)
    assert emb is not None

    person_known = Person(
        id=1,
        person_code="P-TEST-001",
        name="Rahul Sharma",
        status="KNOWN",
        face_embedding=emb,
    )

    matched = svc.match_face(emb, [person_known])
    assert matched is not None
    res_person, sim = matched
    assert res_person.name == "Rahul Sharma"
    assert res_person.status == "KNOWN"
    assert sim >= svc.threshold


def test_face_match_rejects_below_threshold():
    svc = FaceRecognitionService.get_instance()
    dummy_emb = [0.1] * 128
    dummy_emb = [float(v / np.linalg.norm(dummy_emb)) for v in dummy_emb]

    person = Person(
        id=2,
        person_code="P-TEST-002",
        name="Amit Kumar",
        status="FLAGGED",
        face_embedding=dummy_emb,
    )

    # Completely different orthogonal vector
    query_emb = [-0.1] * 128
    query_emb = [float(v / np.linalg.norm(query_emb)) for v in query_emb]

    matched = svc.match_face(query_emb, [person])
    assert matched is None


# ---------------------------------------------------------------------------
# API Tests: Person Registration & Face Validation
# ---------------------------------------------------------------------------

def test_validate_face_endpoint(client):
    img = _create_synthetic_face_image()
    _, buffer = cv2.imencode(".jpg", img)

    response = client.post(
        "/api/v1/persons/validate-face",
        files={"file": ("frame.jpg", io.BytesIO(buffer.tobytes()), "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert "message" in data


def test_register_known_person_endpoint(client, db_session):
    img = _create_synthetic_face_image()
    _, buffer = cv2.imencode(".jpg", img)

    response = client.post(
        "/api/v1/persons/register",
        data={"name": "Rahul Sharma", "status": "KNOWN", "notes": "Staff Lead"},
        files={"file": ("face.jpg", io.BytesIO(buffer.tobytes()), "image/jpeg")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["name"] == "Rahul Sharma"
    assert data["person_status"] == "KNOWN"
    assert data["face_image_url"].startswith("/media/faces/")

    # Verify saved in SQLite database
    saved = db_session.query(Person).filter(Person.name == "Rahul Sharma").first()
    assert saved is not None
    assert saved.status == "KNOWN"
    assert saved.face_embedding is not None


def test_register_flagged_person_endpoint(client, db_session):
    img = _create_synthetic_face_image()
    _, buffer = cv2.imencode(".jpg", img)

    response = client.post(
        "/api/v1/persons/register",
        data={"name": "Amit Kumar", "status": "FLAGGED", "notes": "Security Watchlist"},
        files={"file": ("face.jpg", io.BytesIO(buffer.tobytes()), "image/jpeg")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Amit Kumar"
    assert data["person_status"] == "FLAGGED"

    saved = db_session.query(Person).filter(Person.name == "Amit Kumar").first()
    assert saved is not None
    assert saved.status == "FLAGGED"


def test_list_and_delete_person_endpoints(client, db_session):
    person = Person(
        person_code="P-DEL-123",
        name="Test Delete",
        status="KNOWN",
        face_image_path="/media/faces/test.jpg",
    )
    db_session.add(person)
    db_session.commit()
    db_session.refresh(person)

    # List
    list_res = client.get("/api/v1/persons")
    assert list_res.status_code == 200
    assert any(p["name"] == "Test Delete" for p in list_res.json())

    # Delete
    del_res = client.delete(f"/api/v1/persons/{person.id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm removed
    assert db_session.query(Person).filter(Person.id == person.id).first() is None


def test_vehicle_registration_and_lookup_endpoint(client, db_session):
    # Register Known Vehicle
    res1 = client.post(
        "/api/v1/vehicles",
        json={"plate_number": "HR26DK8337", "owner_name": "Rahul Sharma", "status": "KNOWN"},
    )
    assert res1.status_code == 201
    assert res1.json()["plate_number"] == "HR26DK8337"
    assert res1.json()["status"] == "KNOWN"

    # Register Watchlist Vehicle
    res2 = client.post(
        "/api/v1/vehicles",
        json={"plate_number": "DL01AB9999", "owner_name": "Wanted Target", "status": "WATCHLIST"},
    )
    assert res2.status_code == 201
    assert res2.json()["status"] == "WATCHLIST"

    # List
    list_res = client.get("/api/v1/vehicles")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 2


# ---------------------------------------------------------------------------
# The 8 Required Face Recognition & Stabilization Test Cases
# ---------------------------------------------------------------------------

def test_case_1_registered_person_a_consistently_known():
    """TEST 1: Register Person A. Show Person A -> KNOWN Person A consistently, No UNKNOWN alert."""
    svc = FaceRecognitionService.get_instance()
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    person_a = Person(id=101, person_code="P-A", name="Person A", status="KNOWN", face_embedding=emb_a)
    registered = [person_a]

    # Process 5 consecutive frames of Person A
    for frame_idx in range(5):
        res = svc.process_person_detection(
            frame=img_a,
            camera_id="CAM-TEST",
            bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
            registered_people=registered,
            track_id=101,
        )
        assert res["status"] == "KNOWN"
        assert res["person_name"] == "Person A"
        assert res["is_known"] is True
        assert res["is_flagged"] is False
        assert res["should_emit_alert"] is False
        assert res["should_capture_evidence"] is False


def test_case_2_unregistered_person_unknown_after_stabilization_photo_saved():
    """TEST 2: Show unregistered person -> UNKNOWN consistently after stabilization, alert generated, photo saved."""
    svc = FaceRecognitionService.get_instance()
    # Unregistered face with inverted tones
    img_unregistered = np.full((200, 200, 3), 40, dtype=np.uint8)
    cv2.circle(img_unregistered, (100, 100), 50, (180, 180, 180), -1)

    registered = []  # No registered people

    # Frame 1: Pending stabilization (streak 1)
    res1 = svc.process_person_detection(
        frame=img_unregistered,
        camera_id="CAM-TEST-2",
        bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
        registered_people=registered,
        track_id=202,
    )
    assert res1["status"] == "UNKNOWN"

    # Frame 2 & 3: Stabilization completes
    svc.process_person_detection(img_unregistered, "CAM-TEST-2", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, 202)
    res3 = svc.process_person_detection(img_unregistered, "CAM-TEST-2", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, 202)

    assert res3["status"] == "UNKNOWN"
    assert res3["is_known"] is False
    assert res3["person_name"] == "Unknown"
    assert res3["should_emit_alert"] is True
    assert res3["should_capture_evidence"] is True


def test_case_3_movement_blur_retains_known_stability():
    """TEST 3: Show Person A with movement/blur for several frames -> Does not constantly switch KNOWN/UNKNOWN."""
    svc = FaceRecognitionService.get_instance()
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    person_a = Person(id=301, person_code="P-A3", name="Person A", status="KNOWN", face_embedding=emb_a)
    registered = [person_a]

    # Establish KNOWN identity on track 303
    svc.process_person_detection(img_a, "CAM-TEST-3", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, 303)
    svc.process_person_detection(img_a, "CAM-TEST-3", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, 303)

    # Now simulate 3 blurry/dark frames where face is obscured
    blurry_img = cv2.GaussianBlur(img_a, (45, 45), 0)
    for _ in range(3):
        res = svc.process_person_detection(
            frame=blurry_img,
            camera_id="CAM-TEST-3",
            bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
            registered_people=registered,
            track_id=303,
        )
        # Hysteresis retains stable KNOWN identity
        assert res["status"] == "KNOWN"
        assert res["person_name"] == "Person A"
        assert res["should_emit_alert"] is False


def test_case_4_unknown_person_resembling_threshold_enforced():
    """TEST 4: Show unknown person who visually resembles Person A -> UNKNOWN unless similarity passes threshold."""
    svc = FaceRecognitionService.get_instance()
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    person_a = Person(id=401, person_code="P-A4", name="Person A", status="KNOWN", face_embedding=emb_a)

    # Create distinct embedding with low cosine similarity (< threshold)
    weak_emb = [-v for v in emb_a]
    match = svc.match_face(weak_emb, [person_a])
    assert match is None  # Must reject below threshold


def test_case_5_distinct_registered_persons_no_cross_identification():
    """TEST 5: Register Person B. Show Person A -> Person A is not identified as Person B."""
    svc = FaceRecognitionService.get_instance()
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    # Create distinct Person B
    img_b = np.full((200, 200, 3), 180, dtype=np.uint8)
    cv2.circle(img_b, (100, 100), 70, (50, 50, 50), -1)
    cv2.circle(img_b, (70, 70), 10, (220, 220, 220), -1)
    cv2.circle(img_b, (130, 70), 10, (220, 220, 220), -1)
    emb_b = svc.extract_embedding(img_b)

    person_a = Person(id=501, person_code="P-A5", name="Person A", status="KNOWN", face_embedding=emb_a)
    person_b = Person(id=502, person_code="P-B5", name="Person B", status="KNOWN", face_embedding=emb_b)
    registered = [person_a, person_b]

    # Query with Person A's face
    match_res = svc.match_face(emb_a, registered)
    assert match_res is not None
    matched_person, sim = match_res
    assert matched_person.name == "Person A"
    assert matched_person.name != "Person B"


def test_case_6_flagged_person_alert_not_unknown():
    """TEST 6: Mark Person A as FLAGGED. Show Person A -> FLAGGED PERSON alert, not UNKNOWN."""
    svc = FaceRecognitionService.get_instance()
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    person_flagged = Person(id=601, person_code="P-FLG", name="Wanted Suspect", status="FLAGGED", face_embedding=emb_a)
    registered = [person_flagged]

    res = svc.process_person_detection(
        frame=img_a,
        camera_id="CAM-TEST-6",
        bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
        registered_people=registered,
        track_id=606,
    )
    assert res["status"] == "FLAGGED"
    assert res["is_flagged"] is True
    assert res["is_known"] is False
    assert res["person_name"] == "Wanted Suspect"
    assert res["should_emit_alert"] is True


def test_case_7_cooldown_prevents_flood_on_prolonged_unknown_presence():
    """TEST 7: Same unknown person remains in camera for 10 frames -> Small number of alerts/events due to cooldown."""
    svc = FaceRecognitionService.get_instance()
    img_unknown = np.full((200, 200, 3), 30, dtype=np.uint8)
    registered = []

    alerts_count = 0
    evidence_count = 0

    # 10 consecutive frames within a few milliseconds
    for f in range(10):
        res = svc.process_person_detection(
            frame=img_unknown,
            camera_id="CAM-TEST-7",
            bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
            registered_people=registered,
            track_id=707,
        )
        if res["should_emit_alert"]:
            alerts_count += 1
        if res["should_capture_evidence"]:
            evidence_count += 1

    # Cooldown must prevent 10 separate alerts
    assert alerts_count == 1
    assert evidence_count == 1


def test_case_8_captured_evidence_photo_accessible(client, db_session):
    """TEST 8: Captured event photo opens successfully from the backend/frontend URL."""
    ev_svc = EvidenceService.get_instance()
    img = _create_synthetic_face_image()

    evidence = ev_svc.capture_evidence(
        frame=img,
        camera_id="CAM-TEST-8",
        detection_type="person",
        status="UNKNOWN",
        confidence=0.88,
        bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190, "track_id": 808},
        db=db_session,
    )
    assert evidence is not None
    assert evidence.image_path.startswith("/evidence/")

    # Fetch through HTTP route
    response = client.get(evidence.image_path)
    assert response.status_code == 200
    assert len(response.content) > 0


def test_case_9_registered_and_unknown_in_same_frame():
    """TEST 9: Registered Ujjwal + Different Unknown Person simultaneously in the same frame."""
    svc = FaceRecognitionService.get_instance()

    # Registered person (Face A)
    img_a = _create_synthetic_face_image()
    emb_a = svc.extract_embedding(img_a)

    person_ujjwal = Person(id=901, person_code="P-UJJ", name="Ujjwal", status="KNOWN", face_embedding=emb_a)
    registered = [person_ujjwal]

    # Create composite frame containing Face A on left and Face B (unknown) on right
    frame = np.full((400, 600, 3), 40, dtype=np.uint8)
    frame[50:250, 50:250] = img_a

    img_b = np.full((200, 200, 3), 70, dtype=np.uint8)
    cv2.rectangle(img_b, (40, 30), (160, 170), (180, 180, 180), -1)
    cv2.circle(img_b, (70, 70), 12, (10, 10, 10), -1)
    cv2.circle(img_b, (130, 70), 12, (10, 10, 10), -1)
    cv2.line(img_b, (60, 140), (140, 140), (10, 10, 10), 4)
    frame[50:250, 350:550] = img_b

    # Process 3 frames to stabilize
    for f in range(3):
        res1 = svc.process_person_detection(
            frame=frame,
            camera_id="CAM-MULTI",
            bbox={"x1": 50, "y1": 50, "x2": 250, "y2": 250},
            registered_people=registered,
            track_id=101,
        )
        res2 = svc.process_person_detection(
            frame=frame,
            camera_id="CAM-MULTI",
            bbox={"x1": 350, "y1": 50, "x2": 550, "y2": 250},
            registered_people=registered,
            track_id=102,
        )

    # Track 101 must be KNOWN Ujjwal
    assert res1["status"] == "KNOWN"
    assert res1["person_name"] == "Ujjwal"
    assert res1["is_known"] is True
    assert res1["should_emit_alert"] is False

    # Track 102 must be UNKNOWN (NOT Ujjwal)
    assert res2["status"] == "UNKNOWN"
    assert res2["person_name"] == "Unknown"
    assert res2["is_known"] is False
    assert res2["should_emit_alert"] is True


def test_case_10_three_people_simultaneous_independent_recognition():
    """TEST 10: 3 people in same frame: Ujjwal (KNOWN) + Rahul (KNOWN) + Unknown Person (UNKNOWN)."""
    svc = FaceRecognitionService.get_instance()

    img_u = _create_synthetic_face_image()
    emb_u = svc.extract_embedding(img_u)

    img_r = np.full((200, 200, 3), 90, dtype=np.uint8)
    cv2.circle(img_r, (100, 100), 70, (230, 230, 230), -1)
    cv2.circle(img_r, (70, 85), 10, (20, 20, 20), -1)
    cv2.circle(img_r, (130, 85), 10, (20, 20, 20), -1)
    cv2.ellipse(img_r, (100, 140), (30, 10), 0, 0, 180, (20, 20, 20), 3)
    emb_r = svc.extract_embedding(img_r)

    person_u = Person(id=101, person_code="P-UJJ", name="Ujjwal", status="KNOWN", face_embedding=emb_u)
    person_r = Person(id=102, person_code="P-RAH", name="Rahul", status="KNOWN", face_embedding=emb_r)
    registered = [person_u, person_r]

    img_unk = np.full((200, 200, 3), 50, dtype=np.uint8)
    cv2.rectangle(img_unk, (30, 30), (170, 170), (160, 160, 160), -1)
    cv2.circle(img_unk, (65, 75), 12, (0, 0, 0), -1)
    cv2.circle(img_unk, (135, 75), 12, (0, 0, 0), -1)

    frame = np.full((400, 900, 3), 30, dtype=np.uint8)
    frame[50:250, 50:250] = img_u     # Person 1 (Ujjwal)
    frame[50:250, 350:550] = img_r    # Person 2 (Rahul)
    frame[50:250, 650:850] = img_unk  # Person 3 (Unknown)

    for _ in range(3):
        r1 = svc.process_person_detection(frame, "CAM-3P", {"x1": 50, "y1": 50, "x2": 250, "y2": 250}, registered, track_id=201)
        r2 = svc.process_person_detection(frame, "CAM-3P", {"x1": 350, "y1": 50, "x2": 550, "y2": 250}, registered, track_id=202)
        r3 = svc.process_person_detection(frame, "CAM-3P", {"x1": 650, "y1": 50, "x2": 850, "y2": 250}, registered, track_id=203)

    assert r1["status"] == "KNOWN"
    assert r1["person_name"] == "Ujjwal"
    assert r1["should_emit_alert"] is False

    assert r2["status"] == "KNOWN"
    assert r2["person_name"] == "Rahul"
    assert r2["should_emit_alert"] is False

    assert r3["status"] == "UNKNOWN"
    assert r3["person_name"] == "Unknown"
    assert r3["should_emit_alert"] is True


def test_multi_angle_enrollment_matching():
    """TEST 11: Multi-angle enrollment where query matches one of the 7 registered angles."""
    from app.models import FaceEmbedding

    svc = FaceRecognitionService.get_instance()
    img_front = _create_synthetic_face_image()
    emb_front = svc.extract_embedding(img_front)

    # Turned image
    M = cv2.getRotationMatrix2D((100, 100), 12, 1.0)
    img_turned = cv2.warpAffine(img_front, M, (200, 200))
    emb_turned = svc.extract_embedding(img_turned)

    person = Person(id=301, person_code="P-MULTI", name="Ujjwal Multi", status="KNOWN", face_embedding=emb_front)
    person.embeddings = [
        FaceEmbedding(person_id=301, embedding=emb_front, angle="FRONT"),
        FaceEmbedding(person_id=301, embedding=emb_turned, angle="SLIGHT_LEFT"),
    ]

    # Query with turned face
    matched = svc.match_face(emb_turned, [person])
    assert matched is not None
    p, sim = matched
    assert p.name == "Ujjwal Multi"
    assert sim >= 0.70


def test_registered_person_leaves_and_unknown_enters_no_identity_inheritance():
    """
    CRITICAL IDENTITY LIFECYCLE TEST:
    Person A (Ujjwal) enters -> recognized as KNOWN.
    Person A leaves (track expires).
    Person B (Unknown) enters -> recognized strictly as UNKNOWN, NEVER inherits Person A's identity.
    """
    svc = FaceRecognitionService.get_instance()
    img_u = np.full((200, 200, 3), 100, dtype=np.uint8)
    cv2.circle(img_u, (100, 100), 70, (210, 210, 210), -1)
    cv2.circle(img_u, (75, 80), 12, (50, 50, 50), -1)
    cv2.circle(img_u, (125, 80), 12, (50, 50, 50), -1)
    cv2.ellipse(img_u, (100, 135), (25, 12), 0, 0, 180, (50, 50, 50), 3)
    emb_u = svc.extract_embedding(img_u)

    person_u = Person(id=801, person_code="P-UJJ", name="Ujjwal", status="KNOWN", face_embedding=emb_u)
    registered = [person_u]

    # Frame 1 & 2: Person A (track #1) appears
    for _ in range(2):
        r_a = svc.process_person_detection(
            frame=img_u,
            camera_id="CAM-LEAVE-TEST",
            bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
            registered_people=registered,
            track_id=1,
        )
    assert r_a["status"] == "KNOWN"
    assert r_a["person_name"] == "Ujjwal"
    assert r_a["should_emit_alert"] is False

    # Person A leaves camera: sync active tracks with no active track #1
    svc._tracks["CAM-LEAVE-TEST:1"].last_seen = time.time() - 5.0  # simulate expiration
    svc.sync_active_camera_tracks("CAM-LEAVE-TEST", [])
    assert "CAM-LEAVE-TEST:1" not in svc._tracks

    # Person B (Unknown) appears (either with new track_id #2 or recycled track_id)
    img_unk = np.full((200, 200, 3), 40, dtype=np.uint8)
    cv2.rectangle(img_unk, (20, 20), (180, 180), (140, 140, 140), -1)
    cv2.circle(img_unk, (60, 70), 10, (0, 0, 0), -1)
    cv2.circle(img_unk, (140, 70), 10, (0, 0, 0), -1)

    for _ in range(2):
        r_b = svc.process_person_detection(
            frame=img_unk,
            camera_id="CAM-LEAVE-TEST",
            bbox={"x1": 10, "y1": 10, "x2": 190, "y2": 190},
            registered_people=registered,
            track_id=2,
        )

    # Person B MUST be UNKNOWN, NEVER Ujjwal!
    assert r_b["status"] == "UNKNOWN"
    assert r_b["person_name"] == "Unknown"
    assert r_b["is_known"] is False


def test_recycled_track_id_resets_identity_cleanly():
    """
    Ensure that even if a tracker recycles track_id=10, the new detection starts as PENDING/UNKNOWN
    and does not inherit previous person's identity.
    """
    svc = FaceRecognitionService.get_instance()
    img_u = _create_synthetic_face_image()
    emb_u = svc.extract_embedding(img_u)

    person_u = Person(id=802, person_code="P-UJJ2", name="Ujjwal Original", status="KNOWN", face_embedding=emb_u)
    registered = [person_u]

    # Track 10 matches Ujjwal
    for _ in range(2):
        r1 = svc.process_person_detection(img_u, "CAM-RECYCLE", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, track_id=10)
    assert r1["person_name"] == "Ujjwal Original"

    # Track 10 expires / leaves
    svc._tracks["CAM-RECYCLE:10"].last_seen = time.time() - 3.0
    svc._purge_stale_tracks(time.time())
    assert "CAM-RECYCLE:10" not in svc._tracks

    # Track 10 re-used for unknown person
    img_unk = np.full((200, 200, 3), 30, dtype=np.uint8)
    r2 = svc.process_person_detection(img_unk, "CAM-RECYCLE", {"x1": 10, "y1": 10, "x2": 190, "y2": 190}, registered, track_id=10)
    assert r2["status"] in ("PENDING", "UNKNOWN")
    assert r2["person_name"] != "Ujjwal Original"


def test_duplicate_registration_check():
    """
    Test duplicate face registration detector warns if a candidate face matches an existing person.
    """
    svc = FaceRecognitionService.get_instance()
    img = _create_synthetic_face_image()
    emb = svc.extract_embedding(img)
    assert emb is not None

    person = Person(id=999, person_code="P-DUP-1", name="Original Person", status="KNOWN", face_embedding=emb)
    
    # Populate cache mock
    import numpy as np
    norm_emb = np.array(emb, dtype=np.float32)
    norm_emb = norm_emb / np.linalg.norm(norm_emb)
    svc._cache_embeddings = np.array([norm_emb])
    svc._cache_metadata = [{"id": 999, "person_code": "P-DUP-1", "name": "Original Person", "status": "KNOWN"}]
    svc._cache_loaded = True

    # Same face candidate check
    dup = svc.check_duplicate_registration(emb, threshold=0.65)
    assert dup is not None
    assert dup["is_duplicate"] is True
    assert dup["person_name"] == "Original Person"
    assert dup["similarity"] >= 0.90



