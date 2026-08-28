from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class WatchlistBase(BaseModel):
    """Base schema for watchlist entries."""

    plate_number: str = Field(..., min_length=1, description="Vehicle license plate number")
    description: Optional[str] = Field(None, description="Reason or context for watching")
    status: str = Field("ACTIVE", description="Watchlist item status (ACTIVE/INACTIVE)")


class WatchlistCreate(WatchlistBase):
    """Schema for creating a watchlist item."""

    pass


class WatchlistUpdate(BaseModel):
    """Schema for updating a watchlist item."""

    description: Optional[str] = None
    status: Optional[str] = None


class WatchlistResponse(WatchlistBase):
    """Schema for watchlist responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WatchlistPaginatedResponse(BaseModel):
    """Paginated list response for watchlist entries."""

    items: List[WatchlistResponse]
    total: int
    skip: int
    limit: int
