"""
init_admin.py — Safe development and production admin user initialization.
"""

from __future__ import annotations

import os
from sqlalchemy.orm import Session

from app.models import User
from app.auth.security import hash_password


def init_default_users(db: Session) -> None:
    """
    Ensure an initial administrator account exists in the database.
    Does not overwrite existing accounts. Uses environment variables for credentials
    with safe development fallbacks.
    """
    admin_exists = db.query(User).filter(User.role == "ADMIN").first()

    if not admin_exists:
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

        admin_user = User(
            username=admin_username,
            password_hash=hash_password(admin_password),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()

    # Also ensure a sample OPERATOR and VIEWER exist for multi-role demonstration
    operator_exists = db.query(User).filter(User.username == "operator").first()
    if not operator_exists:
        operator_pw = os.getenv("OPERATOR_PASSWORD", "operator123")
        op_user = User(
            username="operator",
            password_hash=hash_password(operator_pw),
            role="OPERATOR",
            is_active=True,
        )
        db.add(op_user)
        db.commit()

    viewer_exists = db.query(User).filter(User.username == "viewer").first()
    if not viewer_exists:
        viewer_pw = os.getenv("VIEWER_PASSWORD", "viewer123")
        view_user = User(
            username="viewer",
            password_hash=hash_password(viewer_pw),
            role="VIEWER",
            is_active=True,
        )
        db.add(view_user)
        db.commit()
