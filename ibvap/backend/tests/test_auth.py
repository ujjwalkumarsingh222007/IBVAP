"""
test_auth.py — Complete test suite for backend authentication foundation, JWT validation,
password hashing with bcrypt, role-based authorization, and user management.

Requirements:
1. Login with valid admin credentials.
2. Login with valid operator credentials.
3. Login with valid viewer credentials.
4. Invalid username returns 401.
5. Invalid password returns 401.
6. Returned JWT can be decoded.
7. /auth/me works with valid token.
8. /auth/me rejects missing token with 401.
9. /auth/me rejects invalid token with 401.
10. /auth/me rejects expired token with 401.
11. Password is never returned.
12. Role is correctly returned.
13. require_role allows authorized role.
14. require_role rejects unauthorized role with 403.
15. Duplicate usernames are rejected.
"""

from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import User
from app.schemas import UserRole
from app.auth.dependencies import get_current_user, require_role
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
)
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


# Additional mock routes to verify require_role
@app.get("/api/v1/mock-admin-only", tags=["Mock Test"])
def mock_admin_only_endpoint(current_user: User = Depends(require_role(UserRole.ADMIN))):
    return {"message": f"Welcome Admin {current_user.username}"}


@app.get("/api/v1/mock-operator-route", tags=["Mock Test"])
def mock_operator_endpoint(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))
):
    return {"message": f"Welcome Operator {current_user.username}"}


@pytest.fixture(autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        # Seed Development Accounts
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="ADMIN",
            is_active=True,
        )
        operator = User(
            username="operator",
            password_hash=hash_password("operator123"),
            role="OPERATOR",
            is_active=True,
        )
        viewer = User(
            username="viewer",
            password_hash=hash_password("viewer123"),
            role="VIEWER",
            is_active=True,
        )
        db.add_all([admin, operator, viewer])
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


# ---------------------------------------------------------------------------
# Test Cases 1-3: Login with valid credentials (admin, operator, viewer)
# ---------------------------------------------------------------------------

def test_1_login_valid_admin(client: TestClient):
    """1. Login with valid admin credentials returns 200, JWT token, and expires_in."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "expires_in" in data
    assert data["expires_in"] > 0
    assert data["role"] == "ADMIN"
    assert data["username"] == "admin"


def test_2_login_valid_operator(client: TestClient):
    """2. Login with valid operator credentials returns 200, JWT token, and role OPERATOR."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "operator", "password": "operator123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "OPERATOR"
    assert data["username"] == "operator"


def test_3_login_valid_viewer(client: TestClient):
    """3. Login with valid viewer credentials returns 200, JWT token, and role VIEWER."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "viewer", "password": "viewer123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "VIEWER"
    assert data["username"] == "viewer"


# ---------------------------------------------------------------------------
# Test Cases 4-5: Invalid credentials return HTTP 401
# ---------------------------------------------------------------------------

def test_4_login_invalid_username(client: TestClient):
    """4. Invalid username returns HTTP 401 Unauthorized."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "non_existent_user", "password": "anypassword"},
    )
    assert resp.status_code == 401
    assert "Invalid username or password" in resp.json()["detail"]


def test_5_login_invalid_password(client: TestClient):
    """5. Invalid password for existing user returns HTTP 401 Unauthorized."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrongpassword999"},
    )
    assert resp.status_code == 401
    assert "Invalid username or password" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Test Case 6: Returned JWT can be decoded
# ---------------------------------------------------------------------------

def test_6_returned_jwt_can_be_decoded(client: TestClient):
    """6. Returned JWT token can be cleanly decoded and contains sub, role, exp claims."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "admin"
    assert payload["role"] == "ADMIN"
    assert "exp" in payload
    assert "iat" in payload


# ---------------------------------------------------------------------------
# Test Cases 7-10: /auth/me profile endpoint & token validation
# ---------------------------------------------------------------------------

def test_7_auth_me_valid_token(client: TestClient):
    """7. /auth/me returns current user profile when given a valid Bearer token."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "operator", "password": "operator123"},
    )
    token = login_resp.json()["access_token"]

    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    profile = me_resp.json()
    assert profile["username"] == "operator"
    assert profile["role"] == "OPERATOR"
    assert profile["is_active"] is True
    assert "id" in profile


def test_8_auth_me_missing_token(client: TestClient):
    """8. /auth/me rejects missing Authorization header with HTTP 401."""
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_9_auth_me_invalid_token(client: TestClient):
    """9. /auth/me rejects malformed or fabricated JWT token with HTTP 401."""
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token.string"},
    )
    assert resp.status_code == 401


def test_10_auth_me_expired_token(client: TestClient):
    """10. /auth/me rejects expired JWT token with HTTP 401."""
    expired_token = create_access_token(
        data={"sub": "admin", "role": "ADMIN"},
        expires_delta=timedelta(seconds=-10),  # expired 10 seconds ago
    )
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Test Cases 11-12: Password not exposed and role correctly returned
# ---------------------------------------------------------------------------

def test_11_password_never_returned(client: TestClient):
    """11. User profile and login responses never expose password or password_hash."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    login_data = login_resp.json()
    assert "password" not in login_data
    assert "password_hash" not in login_data

    token = login_data["access_token"]
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    profile = me_resp.json()
    assert "password" not in profile
    assert "password_hash" not in profile


def test_12_role_correctly_returned(client: TestClient):
    """12. Role matches the assigned security role across all roles."""
    for role_name in ("ADMIN", "OPERATOR", "VIEWER"):
        username = role_name.lower()
        password = f"{username}123"
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": password},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == role_name


# ---------------------------------------------------------------------------
# Test Cases 13-14: require_role authorization & 403 Forbidden enforcement
# ---------------------------------------------------------------------------

def test_13_require_role_allows_authorized_role(client: TestClient):
    """13. require_role allows authorized role access to protected endpoints."""
    admin_token = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    ).json()["access_token"]

    resp = client.get(
        "/api/v1/mock-admin-only",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "Welcome Admin admin" in resp.json()["message"]


def test_14_require_role_rejects_unauthorized_role_with_403(client: TestClient):
    """14. require_role rejects unauthorized role with HTTP 403 Forbidden."""
    viewer_token = client.post(
        "/api/v1/auth/login",
        json={"username": "viewer", "password": "viewer123"},
    ).json()["access_token"]

    resp = client.get(
        "/api/v1/mock-admin-only",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Test Case 15: Duplicate usernames are rejected
# ---------------------------------------------------------------------------

def test_15_duplicate_usernames_rejected(client: TestClient):
    """15. Attempting to create a user with an already existing username raises HTTP 409 Conflict."""
    admin_token = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123"},
    ).json()["access_token"]

    resp = client.post(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "admin",  # already exists
            "password": "newpassword123",
            "role": "ADMIN",
        },
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]
