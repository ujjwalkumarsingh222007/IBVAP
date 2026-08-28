from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, ConfigDict, AliasChoices

SUPPORTED_EVENT_TYPES = {
    "OBJECT_DETECTED",
    "VEHICLE_DETECTED",
    "PERSON_DETECTED",
    "ANPR_DETECTED",
    "INTRUSION_DETECTED",
    "WATCHLIST_MATCH",
    "SUSPICIOUS_ACTIVITY",
}


class EventBase(BaseModel):
    """Base schema for AI event data contract."""

    camera_id: str = Field(..., min_length=1, description="Camera identifier, e.g. CAM-01")
    event_type: str = Field(..., description="Event type identifier")
    timestamp: datetime = Field(..., description="ISO 8601 timestamp of event occurrence")
    confidence: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Detection confidence score (0.0 - 1.0)"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Flexible module-specific metadata payload"
    )

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, value: str) -> str:
        if value not in SUPPORTED_EVENT_TYPES:
            raise ValueError(
                f"Invalid event_type '{value}'. Must be one of: {', '.join(sorted(SUPPORTED_EVENT_TYPES))}"
            )
        return value


class EventCreate(EventBase):
    """Schema for creating a new event."""

    pass


class EventResponse(EventBase):
    """Schema for returning an event."""

    id: int
    created_at: datetime
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metadata_json", "metadata")
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EventPaginatedResponse(BaseModel):
    """Paginated list response for events."""

    items: List[EventResponse]
    total: int = Field(..., description="Total matching items count")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Maximum items requested")
