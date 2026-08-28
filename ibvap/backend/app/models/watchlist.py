from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Watchlist(Base):
    """SQLAlchemy model representing a vehicle plate watchlist entry."""

    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plate_number = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
