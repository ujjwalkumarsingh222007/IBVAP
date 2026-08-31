"""
dependencies.py — FastAPI dependencies for authentication, role-based authorization, and audit logging.
"""

from __future__ import annotations

from typing import Callable, Optional, Sequence, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User
from app.schemas import UserRole
from app.auth.security import decode_access_token

# HTTP Bearer scheme (auto_error=False allows clean custom 401 exceptions)
security_bearer = HTTPBearer(auto_error=False)


def log_audit_action(
    db: Session,
    username: str,
    action: str,
    endpoint: str,
    success: bool = True,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
) -> Optional[AuditLog]:
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
        detail="Could not validate credentials or token has expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: Optional[str] = payload.get("sub")
    if not username:
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
    Extract user from Bearer token if present; returns None if omitted or invalid without raising 401.
    """
    if not auth_header or not auth_header.credentials:
        return None
    payload = decode_access_token(auth_header.credentials)
    if not payload or not payload.get("sub"):
        return None
    return db.query(User).filter(User.username == payload.get("sub")).first()


def require_role(*roles: Union[UserRole, str]) -> Callable[[User], User]:
    """
    Dependency factory that enforces role-based access control.
    Returns a dependency that validates the user's role and raises HTTP 403 Forbidden if unauthorized.

    Example:
        @router.post("/cameras", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """
    allowed_roles = {r.value if hasattr(r, "value") else str(r) for r in roles}

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of roles: {', '.join(sorted(allowed_roles))}",
            )
        return current_user

    return role_checker


# Pre-configured role dependencies
require_admin = require_role(UserRole.ADMIN)
require_operator = require_role(UserRole.ADMIN, UserRole.OPERATOR)
require_viewer = require_role(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
