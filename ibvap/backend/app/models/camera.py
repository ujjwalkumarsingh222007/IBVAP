from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Camera(Base):
    """SQLAlchemy model representing a surveillance camera."""

    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    rtsp_url = Column(String(255), nullable=False)
    location = Column(String(150), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    created_at = Column(DateTime, default=utc_now)
