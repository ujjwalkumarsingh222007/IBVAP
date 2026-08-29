"""
dependencies.py — FastAPI dependencies for authentication, role-based authorization, and audit logging.
"""

from __future__ import annotations

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User
from app.auth.schemas import UserRole
from app.auth.security import decode_access_token

# HTTP Bearer scheme
security_bearer = HTTPBearer(auto_error=False)


def log_audit_action(
    db: Session,
    username: str,
    action: str,
    endpoint: str,
    success: bool = True,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
) -> AuditLog:
    """
    Persist an audit log entry for security and regulatory compliance.
    Passwords and raw authentication tokens are NEVER logged.
    """
    try:
        log_entry = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            endpoint=endpoint,
            success=success,
            details=details,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception:
        db.rollback()
        return None


def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT Bearer token, retrieving the authenticated active user.
    Raises HTTP 401 Unauthorized if token is missing, invalid, expired, or user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not auth_header or not auth_header.credentials:
        raise credentials_exception

    token = auth_header.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: Optional[str] = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_user_optional(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional authentication dependency for endpoints that allow both authenticated
    and unauthenticated access while still capturing user context when provided.
    """
    if not auth_header or not auth_header.credentials:
        return None

    try:
        token = auth_header.credentials
        payload = decode_access_token(token)
        if not payload:
            return None

        username = payload.get("sub")
        if not username:
            return None

        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        return user
    except Exception:
        return None


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the authenticated user to possess the ADMIN role.
    Raises HTTP 403 Forbidden if the user lacks administrative privileges.
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required for this action",
        )
    return current_user


def require_operator(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the authenticated user to possess at least OPERATOR or ADMIN role.
    Raises HTTP 403 Forbidden if the user is a read-only VIEWER.
    """
    allowed_roles = {UserRole.ADMIN.value, UserRole.OPERATOR.value}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator or Admin privileges required for this action",
        )
    return current_user


def require_viewer(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the authenticated user to possess valid role access (VIEWER, OPERATOR, or ADMIN).
    """
    allowed_roles = {UserRole.ADMIN.value, UserRole.OPERATOR.value, UserRole.VIEWER.value}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid authorization required to access surveillance data",
        )
    return current_user
