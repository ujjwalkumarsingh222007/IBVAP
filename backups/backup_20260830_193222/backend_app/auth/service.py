"""
service.py — Business logic and service operations for user authentication and authorization.
"""

from __future__ import annotations

from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserCreate
from app.auth.dependencies import log_audit_action
from app.auth.security import (
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    hash_password,
    verify_password,
)


class AuthService:
    """Service encapsulating user authentication, validation, token issuance, and account creation."""

    @staticmethod
    def authenticate_user(
        db: Session,
        username: str,
        password: str,
    ) -> Optional[User]:
        """Verify username and password against database."""
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @classmethod
    def login(
        cls,
        db: Session,
        login_data: LoginRequest,
    ) -> TokenResponse:
        """
        Authenticate user credentials and issue signed JWT access token.
        Raises HTTP 401 on invalid username, password, or deactivated account.
        """
        user = cls.authenticate_user(db, login_data.username, login_data.password)

        if not user:
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
        expires_in = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

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
            expires_in=expires_in,
            role=user.role,
            username=user.username,
        )

    @classmethod
    def create_user(
        cls,
        db: Session,
        user_in: UserCreate,
        actor: Optional[User] = None,
    ) -> User:
        """Create a new user with bcrypt-hashed password and unique username check."""
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
            role=user_in.role.value if hasattr(user_in.role, "value") else str(user_in.role),
            is_active=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        actor_name = actor.username if actor else "SYSTEM"
        actor_id = actor.id if actor else None

        log_audit_action(
            db=db,
            username=actor_name,
            action="CREATE_USER",
            endpoint="/api/v1/auth/users",
            success=True,
            user_id=actor_id,
            details=f"Created user '{db_user.username}' with role '{db_user.role}'",
        )

        return db_user
