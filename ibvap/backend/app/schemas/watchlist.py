from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class WatchlistBase(BaseModel):
    """Base schema for watchlist entries."""

    plate_number: str = Field(..., description="Vehicle license plate number")
    description: Optional[str] = Field(None, description="Reason or context for watching")
    status: str = Field("ACTIVE", description="Watchlist item status (ACTIVE/INACTIVE)")


class WatchlistCreate(WatchlistBase):
    """Schema for creating a watchlist item."""

    pass


class WatchlistResponse(WatchlistBase):
    """Schema for watchlist responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
