"""
models.py — SQLAlchemy database models for IBVAP backend.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String
from app.database import Base


class Event(Base):
    """
    Event model representing an alert / detection received from an analytics module
    (e.g., Member 1 CV, Member 2 ANPR).
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(64), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    timestamp = Column(String(64), nullable=False)
    confidence = Column(Float, nullable=False)
    # The database column is named "metadata", mapped to event_metadata on the model
    # to avoid conflict with SQLAlchemy's internal MetaData attribute.
    event_metadata = Column("metadata", JSON, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Event(id={self.id}, camera_id='{self.camera_id}', "
            f"event_type='{self.event_type}', confidence={self.confidence})>"
        )


class Camera(Base):
    """
    Camera model representing a physical/virtual video surveillance stream.
    """

    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    location = Column(String(256), nullable=True)
    status = Column(String(32), default="ONLINE", nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Camera(id={self.id}, camera_id='{self.camera_id}', "
            f"name='{self.name}', status='{self.status}')>"
        )


class User(Base):
    """
    User model representing an operator / administrator of the IBVAP surveillance platform.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(32), default="OPERATOR", nullable=False)  # ADMIN, OPERATOR, VIEWER
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}', is_active={self.is_active})>"


class AuditLog(Base):
    """
    Audit log recording security-sensitive surveillance and administrative actions.
    Note: Passwords and raw JWT tokens are NEVER stored.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(64), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True)  # LOGIN, CREATE_CAMERA, UPDATE_CAMERA, etc.
    endpoint = Column(String(128), nullable=False)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    success = Column(Boolean, default=True, nullable=False)
    details = Column(String(256), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, username='{self.username}', action='{self.action}', success={self.success})>"
