def test_create_camera_success(client):
    """Test creating a camera successfully."""
    payload = {
        "camera_id": "CAM-NORTH-01",
        "name": "North Gate Camera",
        "rtsp_url": "rtsp://192.168.1.100/stream1",
        "location": "North Perimeter Gate",
        "status": "ACTIVE"
    }
    res = client.post("/api/v1/cameras", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["camera_id"] == "CAM-NORTH-01"
    assert data["name"] == "North Gate Camera"
    assert data["rtsp_url"] == "rtsp://192.168.1.100/stream1"


def test_create_camera_duplicate_camera_id(client):
    """Test creating a camera with existing camera_id returns 409 Conflict."""
    payload = {
        "camera_id": "CAM-DUP-01",
        "name": "Original Camera",
        "rtsp_url": "rtsp://192.168.1.101/stream1"
    }
    client.post("/api/v1/cameras", json=payload)

    dup_payload = {
        "camera_id": "CAM-DUP-01",
        "name": "Duplicate Camera",
        "rtsp_url": "rtsp://192.168.1.102/stream1"
    }
    res = client.post("/api/v1/cameras", json=dup_payload)
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_get_cameras_list_and_detail(client):
    """Test getting list of cameras and single camera details."""
    payload = {
        "camera_id": "CAM-EAST-01",
        "name": "East Gate Camera",
        "rtsp_url": "rtsp://192.168.1.103/stream1"
    }
    client.post("/api/v1/cameras", json=payload)

    # List cameras
    res_list = client.get("/api/v1/cameras")
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1

    # Get single camera
    res_detail = client.get("/api/v1/cameras/CAM-EAST-01")
    assert res_detail.status_code == 200
    assert res_detail.json()["name"] == "East Gate Camera"


def test_get_camera_not_found(client):
    """Test getting nonexistent camera returns 404 Not Found."""
    res = client.get("/api/v1/cameras/CAM-NONEXISTENT")
    assert res.status_code == 404


def test_update_camera(client):
    """Test updating camera details."""
    payload = {
        "camera_id": "CAM-UPDATE-01",
        "name": "Old Camera Name",
        "rtsp_url": "rtsp://192.168.1.104/stream1"
    }
    client.post("/api/v1/cameras", json=payload)

    update_payload = {
        "name": "New Camera Name",
        "location": "Updated Tower 2"
    }
    res = client.put("/api/v1/cameras/CAM-UPDATE-01", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "New Camera Name"
    assert data["location"] == "Updated Tower 2"


def test_delete_camera(client):
    """Test deleting a camera."""
    payload = {
        "camera_id": "CAM-DEL-01",
        "name": "Temporary Camera",
        "rtsp_url": "rtsp://192.168.1.105/stream1"
    }
    client.post("/api/v1/cameras", json=payload)

    del_res = client.delete("/api/v1/cameras/CAM-DEL-01")
    assert del_res.status_code == 204

    get_res = client.get("/api/v1/cameras/CAM-DEL-01")
    assert get_res.status_code == 404
