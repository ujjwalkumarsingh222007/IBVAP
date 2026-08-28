from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Alert(Base):
    """SQLAlchemy model representing a security alert."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    alert_type = Column(String(50), nullable=False)
    message = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, default="MEDIUM", index=True)
    status = Column(String(20), nullable=False, default="NEW", index=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    event = relationship("Event", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_status_severity", "status", "severity"),
    )
