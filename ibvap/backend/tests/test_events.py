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


def test_get_events_list(client):
    """Test retrieving events list after inserting events."""
    payload = {
        "camera_id": "CAM-02",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": "2026-08-28T16:00:00",
        "confidence": 0.88,
        "metadata": {"vehicle_type": "car"}
    }
    client.post("/api/v1/events", json=payload)

    response = client.get("/api/v1/events")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["camera_id"] == "CAM-02"
