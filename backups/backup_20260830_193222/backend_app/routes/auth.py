"""
auth.py — API endpoints for user authentication, profile inspection, user management, and audit logs.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User
from app.schemas import (
    AuditLogResponse,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.auth.dependencies import (
    get_current_user,
    log_audit_action,
    require_admin,
)
from app.auth.service import AuthService

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication & Security"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and generate JWT bearer token",
    description="Authenticates credentials against stored bcrypt password hash and issues a signed JWT access token.",
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate user and issue JWT access token.
    """
    return AuthService.login(db=db, login_data=login_data)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
    description="Returns the profile and role details of the currently authenticated JWT bearer token.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Return currently authenticated user safe profile (password hash is omitted).
    """
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out active user session",
    description="Terminates session and records audit logout event.",
)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Log out active user and record security audit log.
    """
    log_audit_action(
        db=db,
        username=current_user.username,
        action="LOGOUT",
        endpoint="/api/v1/auth/logout",
        success=True,
        user_id=current_user.id,
        details=f"User {current_user.username} logged out",
    )
    return {"status": "success", "message": f"Successfully logged out {current_user.username}"}


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new system user (Admin only)",
    description="Administrative endpoint to register new operators or administrators.",
)
def create_user(
    user_in: UserCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Create a new user. Only ADMIN accounts can perform this action.
    """
    db_user = AuthService.create_user(db=db, user_in=user_in, actor=current_admin)
    return UserResponse.model_validate(db_user)


@router.get(
    "/users",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="List all registered platform users (Admin only)",
    description="Returns list of registered users and their roles.",
)
def list_users(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[UserResponse]:
    """
    List all users. Only ADMIN accounts can view all users.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="List security audit logs (Admin only)",
    description="Returns recent security and management audit logs for regulatory and monitoring compliance.",
)
def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[AuditLogResponse]:
    """
    List security audit logs. Only ADMIN accounts can access audit trails.
    """
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(limit).all()
    return [AuditLogResponse.model_validate(log) for log in logs]
