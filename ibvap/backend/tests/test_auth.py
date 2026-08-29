"""
test_auth.py — Unit and integration tests for authentication, authorization, and audit logging.

Covers:
1. Login success (200 with JWT access_token).
2. Login with invalid password returns 401 Unauthorized.
3. Login with non-existent username returns 401 Unauthorized.
4. Login with inactive user account returns 401 Unauthorized.
5. GET /api/v1/auth/me returns current user profile for valid JWT.
6. GET /api/v1/auth/me returns 401 when token is missing or invalid.
7. Admin creates new operator and viewer accounts (POST /api/v1/auth/users -> 201).
8. Non-admin users are rejected from /api/v1/auth/users with 403 Forbidden.
9. Non-admin users are rejected from creating/deleting cameras with 403 Forbidden.
10. Admin can list all users and view security audit logs (GET /api/v1/auth/audit-logs).
11. Security audit logging persists actions without sensitive password/token leaks.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import AuditLog, User
from app.auth.security import hash_password, create_access_token

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
    # Seed standard test users
    db = TestingSessionLocal()
    try:
        admin_user = User(
            username="admin_test",
            password_hash=hash_password("admin_pass_123"),
            role="ADMIN",
            is_active=True,
        )
        operator_user = User(
            username="operator_test",
            password_hash=hash_password("operator_pass_123"),
            role="OPERATOR",
            is_active=True,
        )
        viewer_user = User(
            username="viewer_test",
            password_hash=hash_password("viewer_pass_123"),
            role="VIEWER",
            is_active=True,
        )
        inactive_user = User(
            username="inactive_test",
            password_hash=hash_password("inactive_pass_123"),
            role="OPERATOR",
            is_active=False,
        )
        db.add_all([admin_user, operator_user, viewer_user, inactive_user])
        db.commit()
    finally:
        db.close()

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


def get_token_for(username: str, role: str) -> str:
    return create_access_token(data={"sub": username, "role": role})


# ---------------------------------------------------------------------------
# Authentication Tests (Login & Token Verification)
# ---------------------------------------------------------------------------

def test_login_success(client: TestClient):
    """POST /api/v1/auth/login with valid credentials returns 200 and access_token."""
    payload = {"username": "admin_test", "password": "admin_pass_123"}
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "ADMIN"
    assert data["username"] == "admin_test"


def test_login_invalid_password_returns_401(client: TestClient):
    """POST /api/v1/auth/login with incorrect password returns 401 Unauthorized."""
    payload = {"username": "admin_test", "password": "wrong_password"}
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


def test_login_nonexistent_user_returns_401(client: TestClient):
    """POST /api/v1/auth/login with non-existent user returns 401 Unauthorized."""
    payload = {"username": "unknown_user", "password": "any_password"}
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


def test_login_inactive_user_returns_401(client: TestClient):
    """POST /api/v1/auth/login with deactivated account returns 401 Unauthorized."""
    payload = {"username": "inactive_test", "password": "inactive_pass_123"}
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "deactivated" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Current User Profile Tests (GET /api/v1/auth/me)
# ---------------------------------------------------------------------------

def test_get_me_success(client: TestClient):
    """GET /api/v1/auth/me with valid Bearer token returns current user details."""
    token = get_token_for("operator_test", "OPERATOR")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "operator_test"
    assert data["role"] == "OPERATOR"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


def test_get_me_unauthorized_without_token(client: TestClient):
    """GET /api/v1/auth/me without token returns 401 Unauthorized."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_unauthorized_with_invalid_token(client: TestClient):
    """GET /api/v1/auth/me with corrupted token returns 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Role-Based Authorization Tests (Admin, Operator, Viewer)
# ---------------------------------------------------------------------------

def test_admin_can_create_user(client: TestClient):
    """ADMIN role can create new users via POST /api/v1/auth/users."""
    admin_token = get_token_for("admin_test", "ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "username": "new_guard",
        "password": "guard_password_123",
        "role": "OPERATOR",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "new_guard"
    assert data["role"] == "OPERATOR"


def test_non_admin_cannot_create_user(client: TestClient):
    """OPERATOR or VIEWER role is rejected with 403 Forbidden from creating users."""
    op_token = get_token_for("operator_test", "OPERATOR")
    headers = {"Authorization": f"Bearer {op_token}"}
    payload = {
        "username": "unauthorized_user",
        "password": "password_123",
        "role": "VIEWER",
    }
    response = client.post("/api/v1/auth/users", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Administrative privileges required" in response.json()["detail"]


def test_admin_can_list_users(client: TestClient):
    """ADMIN role can list all users via GET /api/v1/auth/users."""
    admin_token = get_token_for("admin_test", "ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/auth/users", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4


def test_non_admin_cannot_list_users(client: TestClient):
    """Non-admin roles cannot list users."""
    view_token = get_token_for("viewer_test", "VIEWER")
    headers = {"Authorization": f"Bearer {view_token}"}
    response = client.get("/api/v1/auth/users", headers=headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Camera Write Authorization Restrictions
# ---------------------------------------------------------------------------

def test_admin_can_create_and_delete_camera(client: TestClient):
    """ADMIN role can register and delete surveillance cameras."""
    admin_token = get_token_for("admin_test", "ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "camera_id": "CAM-AUTH-01",
        "name": "Admin Camera",
        "location": "North Sector",
        "status": "ONLINE",
    }
    resp = client.post("/api/v1/cameras", json=payload, headers=headers)
    assert resp.status_code == 201

    del_resp = client.delete("/api/v1/cameras/CAM-AUTH-01", headers=headers)
    assert del_resp.status_code == 204


def test_viewer_or_operator_cannot_create_camera(client: TestClient):
    """OPERATOR or VIEWER tokens are rejected with 403 from registering cameras."""
    op_token = get_token_for("operator_test", "OPERATOR")
    headers = {"Authorization": f"Bearer {op_token}"}
    payload = {
        "camera_id": "CAM-FORBIDDEN-01",
        "name": "Forbidden Camera",
        "status": "ONLINE",
    }
    resp = client.post("/api/v1/cameras", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "Administrative privileges required" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Audit Logging Tests
# ---------------------------------------------------------------------------

def test_audit_logs_record_security_events(client: TestClient):
    """Security events like login and user creation are logged in audit_logs."""
    admin_token = get_token_for("admin_test", "ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Trigger login attempt
    client.post("/api/v1/auth/login", json={"username": "admin_test", "password": "admin_pass_123"})
    client.post("/api/v1/auth/login", json={"username": "admin_test", "password": "bad_password"})

    # Inspect audit logs
    audit_resp = client.get("/api/v1/auth/audit-logs", headers=headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 2
    actions = [log["action"] for log in logs]
    assert "LOGIN_SUCCESS" in actions
    assert "LOGIN_ATTEMPT" in actions

    # Verify passwords and JWT tokens are NOT in details
    for log in logs:
        if log.get("details"):
            assert "admin_pass_123" not in log["details"]
            assert "eyJ" not in log["details"]  # JWT prefix
