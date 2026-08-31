"""
routes.py — API endpoints for user authentication, profile inspection, user management, and audit logs.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User
from app.auth.dependencies import (
    get_current_user,
    log_audit_action,
    require_admin,
)
from app.auth.schemas import (
    AuditLogResponse,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.auth.security import create_access_token, hash_password, verify_password

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication & Security"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and generate JWT bearer token",
    description="Authenticates credentials against stored password hash and issues a signed JWT access token.",
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate user and issue JWT access token.
    """
    user = db.query(User).filter(User.username == login_data.username).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        log_audit_action(
            db=db,
            username=login_data.username,
            action="LOGIN_ATTEMPT",
            endpoint="/api/v1/auth/login",
            success=False,
            details="Invalid username or password credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log_audit_action(
            db=db,
            username=login_data.username,
            action="LOGIN_ATTEMPT",
            endpoint="/api/v1/auth/login",
            success=False,
            user_id=user.id,
            details="Account is inactive or disabled",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "user_id": user.id}
    )

    log_audit_action(
        db=db,
        username=user.username,
        action="LOGIN_SUCCESS",
        endpoint="/api/v1/auth/login",
        success=True,
        user_id=user.id,
        details=f"Successful login as {user.role}",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
    )


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
    Return currently authenticated user profile.
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
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with username '{user_in.username}' already exists",
        )

    hashed_pw = hash_password(user_in.password)
    db_user = User(
        username=user_in.username,
        password_hash=hashed_pw,
        role=user_in.role.value,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    log_audit_action(
        db=db,
        username=current_admin.username,
        action="CREATE_USER",
        endpoint="/api/v1/auth/users",
        success=True,
        user_id=current_admin.id,
        details=f"Created user '{db_user.username}' with role '{db_user.role}'",
    )

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
