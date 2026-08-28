def test_get_cameras(client):
    """Test GET /api/v1/cameras returns 200 OK and list."""
    response = client.get("/api/v1/cameras")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_alerts(client):
    """Test GET /api/v1/alerts returns 200 OK and list."""
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_detections(client):
    """Test GET /api/v1/detections returns 200 OK and list."""
    response = client.get("/api/v1/detections")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_watchlist(client):
    """Test GET /api/v1/watchlist returns 200 OK and list."""
    response = client.get("/api/v1/watchlist")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_openapi_docs_available(client):
    """Test OpenAPI schema and Swagger UI documentation endpoints."""
    openapi_res = client.get("/openapi.json")
    assert openapi_res.status_code == 200
    assert "paths" in openapi_res.json()

    docs_res = client.get("/docs")
    assert docs_res.status_code == 200
