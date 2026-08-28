from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class CameraBase(BaseModel):
    """Base schema for camera objects."""

    camera_id: str = Field(..., description="Unique camera identifier, e.g. CAM-01")
    name: str = Field(..., description="Descriptive camera name")
    rtsp_url: str = Field(..., description="RTSP stream URL")
    location: Optional[str] = Field(None, description="Physical location or zone")
    status: str = Field("ACTIVE", description="Camera operational status (ACTIVE/INACTIVE)")


class CameraCreate(CameraBase):
    """Schema for camera registration."""

    pass


class CameraResponse(CameraBase):
    """Schema for camera responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
