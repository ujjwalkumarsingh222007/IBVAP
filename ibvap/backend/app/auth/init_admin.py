"""
init_admin.py — Safe development and production admin user initialization.
"""

from __future__ import annotations

import os
from sqlalchemy.orm import Session

from app.models import User
from app.auth.security import hash_password
from app.config import (
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    OPERATOR_USERNAME,
    OPERATOR_PASSWORD,
    VIEWER_USERNAME,
    VIEWER_PASSWORD,
)


def init_default_users(db: Session) -> None:
    """
    Ensure an initial administrator account exists in the database.
    Does not overwrite existing accounts. Uses environment variables for credentials
    with safe development fallbacks.
    """
    admin_exists = db.query(User).filter(User.role == "ADMIN").first()

    if not admin_exists:
        admin_user = User(
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()

    # Also ensure a sample OPERATOR and VIEWER exist for multi-role demonstration
    operator_exists = db.query(User).filter(User.username == OPERATOR_USERNAME).first()
    if not operator_exists:
        op_user = User(
            username=OPERATOR_USERNAME,
            password_hash=hash_password(OPERATOR_PASSWORD),
            role="OPERATOR",
            is_active=True,
        )
        db.add(op_user)
        db.commit()

    viewer_exists = db.query(User).filter(User.username == VIEWER_USERNAME).first()
    if not viewer_exists:
        view_user = User(
            username=VIEWER_USERNAME,
            password_hash=hash_password(VIEWER_PASSWORD),
            role="VIEWER",
            is_active=True,
        )
        db.add(view_user)
        db.commit()
