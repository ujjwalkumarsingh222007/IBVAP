def test_create_watchlist_item(client):
    """Test creating a watchlist item successfully."""
    payload = {
        "plate_number": "KA-01-AB-1234",
        "description": "Suspect vehicle related to border perimeter report",
        "status": "ACTIVE"
    }
    res = client.post("/api/v1/watchlist", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["plate_number"] == "KA-01-AB-1234"
    assert data["description"] == payload["description"]


def test_create_watchlist_duplicate_plate(client):
    """Test creating duplicate plate number returns 409 Conflict."""
    payload = {
        "plate_number": "DL-02-XY-9999",
        "description": "First entry"
    }
    client.post("/api/v1/watchlist", json=payload)

    dup_res = client.post("/api/v1/watchlist", json=payload)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"].lower()


def test_watchlist_update_and_delete(client):
    """Test updating and deleting watchlist entry."""
    create_res = client.post("/api/v1/watchlist", json={"plate_number": "MH-12-CD-5678"})
    item_id = create_res.json()["id"]

    # Update item
    update_res = client.put(f"/api/v1/watchlist/{item_id}", json={"status": "INACTIVE"})
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "INACTIVE"

    # Delete item
    del_res = client.delete(f"/api/v1/watchlist/{item_id}")
    assert del_res.status_code == 204

    # Update deleted returns 404
    assert client.put(f"/api/v1/watchlist/{item_id}", json={"status": "ACTIVE"}).status_code == 404
