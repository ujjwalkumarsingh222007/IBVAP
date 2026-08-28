from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Event(Base):
    """SQLAlchemy model representing an AI-detected event."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(50), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False)
    confidence = Column(Float, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=utc_now)
