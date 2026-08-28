"""
schemas.py — Pydantic request and response schemas for IBVAP backend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class EventType(str, Enum):
    """
    Allowed IBVAP event types. Any incoming event with an unlisted type
    will be rejected by FastAPI/Pydantic validation with HTTP 422.
    """
    OBJECT_DETECTED = "OBJECT_DETECTED"
    VEHICLE_DETECTED = "VEHICLE_DETECTED"
    PERSON_DETECTED = "PERSON_DETECTED"
    ANPR_DETECTED = "ANPR_DETECTED"
    INTRUSION_DETECTED = "INTRUSION_DETECTED"
    WATCHLIST_MATCH = "WATCHLIST_MATCH"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"


class EventBase(BaseModel):
    """Base fields shared across event schemas."""
    camera_id: str = Field(
        ...,
        min_length=1,
        description="Identifier of the camera/sensor that generated the event.",
        examples=["CAM-01"],
    )
    event_type: EventType = Field(
        ...,
        description="Category of the event.",
        examples=["INTRUSION_DETECTED"],
    )
    timestamp: str = Field(
        ...,
        min_length=1,
        description="ISO-8601 formatted timestamp string.",
        examples=["2026-08-28T15:30:00Z"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Detection confidence score between 0.0 and 1.0.",
        examples=[0.94],
    )
    metadata: Dict[str, Any] = Field(
        ...,
        description="Flexible metadata payload (e.g. track_id, class_name, bbox, position).",
        examples=[
            {
                "track_id": 17,
                "class_name": "person",
                "bbox": [120, 80, 300, 450],
                "position": {"x": 210, "y": 265},
            }
        ],
    )


class EventCreate(EventBase):
    """Schema for creating a new event via POST /api/v1/events."""
    pass


class EventResponse(EventBase):
    """Schema returned after an event is successfully created/retrieved."""
    id: int = Field(..., description="Unique generated database event ID.")
    created_at: Optional[datetime] = Field(
        default=None,
        description="Server timestamp when the event was persisted.",
    )

    model_config = ConfigDict(from_attributes=True)
