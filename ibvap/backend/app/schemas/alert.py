from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class AlertBase(BaseModel):
    """Base schema for security alerts."""

    event_id: Optional[int] = Field(None, description="Associated event ID")
    alert_type: str = Field(..., description="Alert classification")
    message: str = Field(..., description="Alert detail message")
    severity: str = Field("MEDIUM", description="Alert severity level (LOW, MEDIUM, HIGH, CRITICAL)")
    status: str = Field("NEW", description="Alert status (NEW, OPEN, ACKNOWLEDGED, RESOLVED)")


class AlertCreate(AlertBase):
    """Schema for creating alerts."""

    pass


class AlertResponse(AlertBase):
    """Schema for alert responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertPaginatedResponse(BaseModel):
    """Paginated list response for security alerts."""

    items: List[AlertResponse]
    total: int
    skip: int
    limit: int
