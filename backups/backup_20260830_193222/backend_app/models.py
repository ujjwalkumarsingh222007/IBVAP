"""
models.py — SQLAlchemy database models for IBVAP backend.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
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


class Threat(Base):
    """
    Correlated Threat model representing high-level intelligence formed by aggregating
    and correlating related surveillance events on a camera stream.
    """

    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    threat_id = Column(String(64), unique=True, index=True, nullable=False)
    camera_id = Column(String(64), nullable=False, index=True)
    severity = Column(String(32), nullable=False, index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    score = Column(Float, nullable=False)  # 0.0 to 100.0
    title = Column(String(128), nullable=False)
    reason = Column(String(256), nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False, index=True)  # ACTIVE, ACKNOWLEDGED, RESOLVED
    first_event_time = Column(String(64), nullable=False)
    last_event_time = Column(String(64), nullable=False)
    event_count = Column(Integer, default=1, nullable=False)
    threat_metadata = Column("metadata", JSON, nullable=False, default=dict)
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
            f"<Threat(id={self.id}, threat_id='{self.threat_id}', camera_id='{self.camera_id}', "
            f"severity='{self.severity}', score={self.score}, status='{self.status}')>"
        )


class ThreatEventRelation(Base):
    """
    Join table associating individual surveillance Event records with a parent Threat.
    """

    __tablename__ = "threat_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    threat_id = Column(Integer, ForeignKey("threats.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ThreatEventRelation(id={self.id}, threat_id={self.threat_id}, event_id={self.event_id})>"


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
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
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


class Evidence(Base):
    """
    Evidence model representing a captured image and detection crop for an
    UNKNOWN or FLAGGED person or vehicle.
    """

    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(64), nullable=False, index=True)
    timestamp = Column(String(64), nullable=False)
    detection_type = Column(String(32), nullable=False, index=True)  # person / vehicle
    status = Column(String(32), nullable=False, index=True)  # UNKNOWN / FLAGGED / KNOWN
    confidence = Column(Float, nullable=False)
    image_path = Column(String(256), nullable=False)
    crop_image_path = Column(String(256), nullable=True)
    bbox_x1 = Column(Float, nullable=True)
    bbox_y1 = Column(Float, nullable=True)
    bbox_x2 = Column(Float, nullable=True)
    bbox_y2 = Column(Float, nullable=True)
    person_id = Column(String(64), nullable=True)
    vehicle_id = Column(String(64), nullable=True)
    plate_number = Column(String(64), nullable=True)
    reason = Column(String(256), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Evidence(id={self.id}, camera_id='{self.camera_id}', "
            f"type='{self.detection_type}', status='{self.status}', confidence={self.confidence})>"
        )


class Person(Base):
    """
    Person model representing a registered person with status (KNOWN / FLAGGED),
    stored face photo path, and feature embedding vector for live recognition.
    """

    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    person_code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False, index=True)
    status = Column(String(32), default="KNOWN", nullable=False, index=True)  # KNOWN / FLAGGED
    face_image_path = Column(String(256), nullable=True)
    face_embedding = Column(JSON, nullable=True)  # List[float] embedding vector
    notes = Column(String(256), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )
    embeddings = relationship("FaceEmbedding", back_populates="person", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Person(id={self.id}, code='{self.person_code}', name='{self.name}', status='{self.status}')>"


class FaceEmbedding(Base):
    """
    Multiple face embeddings per person covering 7 guided enrollment angles:
    FRONT, SLIGHT_LEFT, LEFT, SLIGHT_RIGHT, RIGHT, LOOK_UP, LOOK_DOWN.
    """

    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding = Column(JSON, nullable=False)  # List[float] embedding vector
    angle = Column(String(32), nullable=False, default="FRONT")  # FRONT, SLIGHT_LEFT, LEFT, etc.
    quality_score = Column(Float, nullable=False, default=1.0)
    image_path = Column(String(256), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    person = relationship("Person", back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<FaceEmbedding(id={self.id}, person_id={self.person_id}, angle='{self.angle}')>"


class RegisteredVehicle(Base):
    """
    Registered vehicle model representing known or watchlisted license plates.
    """

    __tablename__ = "registered_vehicles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plate_number = Column(String(64), unique=True, index=True, nullable=False)
    owner_name = Column(String(128), nullable=False)
    status = Column(String(32), default="KNOWN", nullable=False, index=True)  # KNOWN / FLAGGED / WATCHLIST
    notes = Column(String(256), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<RegisteredVehicle(id={self.id}, plate='{self.plate_number}', status='{self.status}')>"


