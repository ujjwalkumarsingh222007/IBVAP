"""
models.py — SQLAlchemy database models for IBVAP backend.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String
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
