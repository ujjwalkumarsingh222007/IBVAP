"""
test_ai_process_frame.py — Automated tests for live webcam frame AI processing endpoint.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Event
from app.main import app

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


def _create_test_jpeg(width: int = 320, height: int = 240) -> bytes:
    """Generate valid test JPEG binary in memory."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    # Draw simple shapes
    cv2.rectangle(img, (50, 50), (150, 180), (0, 255, 0), -1)
    success, buffer = cv2.imencode(".jpg", img)
    assert success
    return buffer.tobytes()


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_valid_frame_accepted(client: TestClient):
    """Valid JPEG frame and camera_id returns HTTP 200 with detection payload."""
    jpeg_bytes = _create_test_jpeg()
    files = {"file": ("frame.jpg", jpeg_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-BORDER-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["camera_id"] == "CAM-BORDER-01"
    assert res_data["processed"] is True
    assert "detections_count" in res_data
    assert "events_count" in res_data
    assert isinstance(res_data["detections"], list)
    assert isinstance(res_data["events"], list)


def test_corrupted_image_rejected_with_422(client: TestClient):
    """Corrupted/unreadable image bytes are rejected with HTTP 422."""
    corrupted_bytes = b"not_a_real_image_binary_data_at_all"
    files = {"file": ("frame.jpg", corrupted_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 422
    assert "Corrupted or unreadable image frame" in response.json()["detail"]


def test_empty_frame_rejected_with_422(client: TestClient):
    """Empty 0-byte frame is rejected with HTTP 422."""
    files = {"file": ("frame.jpg", b"", "image/jpeg")}
    data = {"camera_id": "CAM-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 422


def test_missing_or_empty_camera_id_rejected(client: TestClient):
    """Empty or missing camera_id is rejected with HTTP 422."""
    jpeg_bytes = _create_test_jpeg()
    files = {"file": ("frame.jpg", jpeg_bytes, "image/jpeg")}

    # Missing camera_id
    resp_missing = client.post("/api/v1/ai/process-frame", files=files)
    assert resp_missing.status_code == 422

    # Empty string camera_id
    resp_empty = client.post(
        "/api/v1/ai/process-frame",
        files=files,
        data={"camera_id": "   "},
    )
    assert resp_empty.status_code == 422


def test_invalid_camera_id_characters_rejected(client: TestClient):
    """Dangerous or invalid camera_id characters are rejected with HTTP 422."""
    jpeg_bytes = _create_test_jpeg()
    files = {"file": ("frame.jpg", jpeg_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-01; rm -rf /"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 422


def test_unsupported_mime_type_rejected_with_415(client: TestClient):
    """Non-image MIME type is rejected with HTTP 415 Unsupported Media Type."""
    text_bytes = b"Hello world text file"
    files = {"file": ("doc.txt", text_bytes, "text/plain")}
    data = {"camera_id": "CAM-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 415


def test_oversized_frame_rejected_with_413(client: TestClient):
    """Frames larger than 5MB are rejected with HTTP 413 Payload Too Large."""
    large_bytes = b"0" * (6 * 1024 * 1024)  # 6 MB
    files = {"file": ("large_frame.jpg", large_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 413


# ---------------------------------------------------------------------------
# Phase 3C Part 3 ANPR Integration Tests
# ---------------------------------------------------------------------------

def test_anpr_watchlist_match_detection_and_persistence(client: TestClient):
    """Watchlist plate detection generates WATCHLIST_MATCH event with full metadata."""
    from app.services.ai_service import AIService
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import MockPlateDetector
    from ai.member2_anpr.ocr import MockOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor

    # Configure AIService with deterministic mock for watchlist test
    service = AIService.get_instance()
    service.anpr_pipeline = ANPRPipeline(
        detector=MockPlateDetector(confidence=0.92),
        ocr_engine=MockOCREngine(mock_text="TN 09 AB 1234", mock_confidence=0.94),
        recognizer=PlateRecognizer(strict=False),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
        duplicate_suppressor=DuplicateSuppressor(window_seconds=10.0, enabled=False),
    )

    jpeg_bytes = _create_test_jpeg()
    files = {"file": ("plate_frame.jpg", jpeg_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-ANPR-01"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["status"] == "success"
    assert res_data["processed"] is True

    # Verify detection item in response
    plate_dets = [d for d in res_data["detections"] if d.get("class_name") == "license_plate"]
    assert len(plate_dets) >= 1
    assert plate_dets[0]["plate_number"] == "TN09AB1234"
    assert plate_dets[0]["watchlist_match"] is True
    assert plate_dets[0]["watchlist_status"] == "WATCHLIST"
    assert plate_dets[0]["plate_confidence"] == 0.92
    assert plate_dets[0]["ocr_confidence"] == 0.94

    # Verify event emitted in response
    watchlist_events = [e for e in res_data["events"] if e.get("event_type") == "WATCHLIST_MATCH"]
    assert len(watchlist_events) >= 1
    ev = watchlist_events[0]
    assert ev["camera_id"] == "CAM-ANPR-01"
    assert ev["metadata"]["plate_number"] == "TN09AB1234"
    assert ev["metadata"]["raw_ocr_text"] == "TN 09 AB 1234"
    assert ev["metadata"]["watchlist_match"] is True
    assert ev["metadata"]["plate_confidence"] == 0.92
    assert ev["metadata"]["ocr_confidence"] == 0.94

    # Verify event is queryable via backend /api/v1/events
    get_res = client.get("/api/v1/events?event_type=WATCHLIST_MATCH")
    assert get_res.status_code == 200
    events_list = get_res.json()
    assert len(events_list) >= 1
    assert events_list[0]["metadata"]["plate_number"] == "TN09AB1234"


def test_anpr_normal_plate_detection(client: TestClient):
    """Clean non-watchlist plate produces ANPR_DETECTED event."""
    from app.services.ai_service import AIService
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import MockPlateDetector
    from ai.member2_anpr.ocr import MockOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor

    # Configure AIService with non-watchlist registration (e.g. DL 01 AB 9999)
    service = AIService.get_instance()
    service.anpr_pipeline = ANPRPipeline(
        detector=MockPlateDetector(confidence=0.88),
        ocr_engine=MockOCREngine(mock_text="DL 01 AB 9999", mock_confidence=0.91),
        recognizer=PlateRecognizer(strict=False),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
        duplicate_suppressor=DuplicateSuppressor(window_seconds=10.0, enabled=False),
    )

    jpeg_bytes = _create_test_jpeg()
    files = {"file": ("plate_frame.jpg", jpeg_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-NORTH-02"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()

    # Verify ANPR_DETECTED event
    anpr_events = [e for e in res_data["events"] if e.get("event_type") == "ANPR_DETECTED"]
    assert len(anpr_events) >= 1
    ev = anpr_events[0]
    assert ev["camera_id"] == "CAM-NORTH-02"
    assert ev["metadata"]["plate_number"] == "DL01AB9999"
    assert ev["metadata"]["watchlist_match"] is False
    assert ev["metadata"]["validation_passed"] is True


def test_anpr_duplicate_suppression_prevents_event_flooding(client: TestClient):
    """Consecutive identical frames on the same camera do not emit duplicate database events."""
    from app.services.ai_service import AIService
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import MockPlateDetector
    from ai.member2_anpr.ocr import MockOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor

    # Initialize suppressor with 10 second window
    suppressor = DuplicateSuppressor(window_seconds=10.0, enabled=True)

    service = AIService.get_instance()
    service.anpr_pipeline = ANPRPipeline(
        detector=MockPlateDetector(confidence=0.90),
        ocr_engine=MockOCREngine(mock_text="KA 05 MN 4321", mock_confidence=0.92),
        recognizer=PlateRecognizer(strict=False),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
        duplicate_suppressor=suppressor,
    )

    jpeg_bytes = _create_test_jpeg()
    files1 = {"file": ("frame1.jpg", jpeg_bytes, "image/jpeg")}
    data = {"camera_id": "CAM-GATE-01"}

    # First frame - should create 1 event
    resp1 = client.post("/api/v1/ai/process-frame", files=files1, data=data)
    assert resp1.status_code == 200
    res1 = resp1.json()
    anpr_evs_1 = [e for e in res1["events"] if e.get("event_type") == "ANPR_DETECTED"]
    assert len(anpr_evs_1) == 1

    # Second immediate frame - event should be suppressed
    files2 = {"file": ("frame2.jpg", jpeg_bytes, "image/jpeg")}
    resp2 = client.post("/api/v1/ai/process-frame", files=files2, data=data)
    assert resp2.status_code == 200
    res2 = resp2.json()
    anpr_evs_2 = [e for e in res2["events"] if e.get("event_type") == "ANPR_DETECTED"]
    assert len(anpr_evs_2) == 0  # Suppressed!

    # However, detections overlay still reports plate in both frames for live HUD
    assert len([d for d in res2["detections"] if d.get("class_name") == "license_plate"]) == 1


def test_real_yolo_plate_detector_bounding_box_output(client: TestClient):
    """Real YOLOPlateDetector returns non-zero, valid bounding box coordinates on a plate image."""
    from app.services.ai_service import AIService
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import YOLOPlateDetector
    from ai.member2_anpr.ocr import MockOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor

    model_path = BACKEND_DIR.parent / "ai" / "member2_anpr" / "models" / "license_plate.pt"
    if not model_path.exists():
        pytest.skip("license_plate.pt model file not present")

    service = AIService.get_instance()
    service.anpr_pipeline = ANPRPipeline(
        detector=YOLOPlateDetector(model_path=str(model_path), confidence_threshold=0.20),
        ocr_engine=MockOCREngine(mock_text="HR 98 AA 0000", mock_confidence=0.92),
        recognizer=PlateRecognizer(strict=False),
        watchlist=InMemoryWatchlistMatcher(),
        event_generator=ANPREventGenerator(),
        duplicate_suppressor=DuplicateSuppressor(window_seconds=10.0, enabled=False),
    )

    # Create image with a clear plate rectangle
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(img, (150, 180), (480, 300), (240, 240, 240), -1)
    cv2.rectangle(img, (150, 180), (480, 300), (0, 0, 0), 4)
    cv2.putText(img, "HR 98 AA 0000", (160, 260), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 0, 0), 3)
    _, buf = cv2.imencode(".jpg", img)

    files = {"file": ("real_plate.jpg", buf.tobytes(), "image/jpeg")}
    data = {"camera_id": "CAM-TOWER-04"}

    response = client.post("/api/v1/ai/process-frame", files=files, data=data)
    assert response.status_code == 200
    res = response.json()

    assert res["status"] == "success"
    assert res["detections_count"] >= 1
    det = [d for d in res["detections"] if d.get("class_name") == "license_plate"][0]

    # Verify real non-zero bounding box
    bbox = det["bbox"]
    assert bbox["x1"] > 0
    assert bbox["y1"] > 0
    assert bbox["x2"] > bbox["x1"]
    assert bbox["y2"] > bbox["y1"]
    assert det["plate_number"] == "HR98AA0000"
    assert det["plate_confidence"] > 0.20


def test_distinct_plate_recognition_different_values(client: TestClient):
    """Verifies that different plate numbers are recognized and not hardcoded."""
    from app.services.ai_service import AIService
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import MockPlateDetector
    from ai.member2_anpr.ocr import MockOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor

    for sample_plate in ["MH 12 DE 1432", "DL 01 AB 9999", "KA 05 MN 5678"]:
        clean_plate = sample_plate.replace(" ", "")
        service = AIService.get_instance()
        service.anpr_pipeline = ANPRPipeline(
            detector=MockPlateDetector(confidence=0.89),
            ocr_engine=MockOCREngine(mock_text=sample_plate, mock_confidence=0.91),
            recognizer=PlateRecognizer(strict=False),
            watchlist=InMemoryWatchlistMatcher(),
            event_generator=ANPREventGenerator(),
            duplicate_suppressor=DuplicateSuppressor(window_seconds=10.0, enabled=False),
        )

        jpeg_bytes = _create_test_jpeg()
        files = {"file": ("test_plate.jpg", jpeg_bytes, "image/jpeg")}
        data = {"camera_id": "CAM-01"}

        resp = client.post("/api/v1/ai/process-frame", files=files, data=data)
        assert resp.status_code == 200
        res = resp.json()
        plate_det = [d for d in res["detections"] if d.get("class_name") == "license_plate"][0]
        assert plate_det["plate_number"] == clean_plate


