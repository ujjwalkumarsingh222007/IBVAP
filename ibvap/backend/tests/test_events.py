def test_create_valid_event(client):
    """Test creating a valid AI event following the common event contract."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": "OBJECT_DETECTED",
        "timestamp": "2026-08-28T15:30:00",
        "confidence": 0.94,
        "metadata": {
            "label": "person",
            "bounding_box": [100, 150, 50, 120]
        }
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["camera_id"] == "CAM-01"
    assert data["event_type"] == "OBJECT_DETECTED"
    assert data["confidence"] == 0.94
    assert data["metadata"] == payload["metadata"]
    assert "id" in data
    assert "created_at" in data


def test_create_event_invalid_type(client):
    """Test that event with invalid event_type is rejected with 422."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": "UNKNOWN_EVENT_TYPE",
        "timestamp": "2026-08-28T15:30:00",
        "confidence": 0.8
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 422


def test_create_event_missing_required_fields(client):
    """Test that event missing required camera_id is rejected with 422."""
    payload = {
        "event_type": "OBJECT_DETECTED",
        "timestamp": "2026-08-28T15:30:00"
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 422


def test_create_event_invalid_confidence_range(client):
    """Test that confidence > 1.0 is rejected with 422."""
    payload = {
        "camera_id": "CAM-01",
        "event_type": "PERSON_DETECTED",
        "timestamp": "2026-08-28T15:30:00",
        "confidence": 1.5
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 422


def test_get_events_paginated_and_filtered(client):
    """Test retrieving events list with filtering and pagination structure."""
    payload1 = {
        "camera_id": "CAM-01",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": "2026-08-28T10:00:00",
        "confidence": 0.88
    }
    payload2 = {
        "camera_id": "CAM-02",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": "2026-08-28T12:00:00",
        "confidence": 0.95
    }
    client.post("/api/v1/events", json=payload1)
    client.post("/api/v1/events", json=payload2)

    # Test filtering by camera_id
    res_cam = client.get("/api/v1/events?camera_id=CAM-01")
    assert res_cam.status_code == 200
    data_cam = res_cam.json()
    assert data_cam["total"] == 1
    assert len(data_cam["items"]) == 1
    assert data_cam["items"][0]["camera_id"] == "CAM-01"

    # Test filtering by event_type
    res_type = client.get("/api/v1/events?event_type=INTRUSION_DETECTED")
    assert res_type.status_code == 200
    data_type = res_type.json()
    assert data_type["total"] == 1
    assert data_type["items"][0]["event_type"] == "INTRUSION_DETECTED"

    # Test pagination parameters
    res_page = client.get("/api/v1/events?skip=0&limit=1")
    assert res_page.status_code == 200
    data_page = res_page.json()
    assert data_page["total"] == 2
    assert len(data_page["items"]) == 1
    assert data_page["skip"] == 0
    assert data_page["limit"] == 1


def test_get_event_by_id(client):
    """Test retrieving a single event by ID."""
    payload = {
        "camera_id": "CAM-03",
        "event_type": "SUSPICIOUS_ACTIVITY",
        "timestamp": "2026-08-28T14:00:00",
        "confidence": 0.75
    }
    create_res = client.post("/api/v1/events", json=payload)
    event_id = create_res.json()["id"]

    res = client.get(f"/api/v1/events/{event_id}")
    assert res.status_code == 200
    assert res.json()["id"] == event_id
    assert res.json()["camera_id"] == "CAM-03"


def test_get_event_by_id_not_found(client):
    """Test retrieving nonexistent event returns 404 Not Found."""
    res = client.get("/api/v1/events/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_event_date_range_validation(client):
    """Test start_time > end_time returns 422 validation error."""
    res = client.get("/api/v1/events?start_time=2026-08-28T18:00:00&end_time=2026-08-28T10:00:00")
    assert res.status_code == 422


def test_intrusion_event_auto_generates_alert(client):
    """Test that INTRUSION_DETECTED event auto-creates an Alert."""
    payload = {
        "camera_id": "CAM-FENCE-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": "2026-08-28T16:00:00",
        "confidence": 0.99
    }
    client.post("/api/v1/events", json=payload)

    alerts_res = client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert alerts_data["total"] >= 1
    assert alerts_data["items"][0]["severity"] == "HIGH"
    assert "CAM-FENCE-01" in alerts_data["items"][0]["message"]
