from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CameraBase(BaseModel):
    """Base schema for camera objects."""

    camera_id: str = Field(..., min_length=1, description="Unique camera identifier, e.g. CAM-01")
    name: str = Field(..., min_length=1, description="Descriptive camera name")
    rtsp_url: str = Field(..., min_length=1, description="RTSP stream URL")
    location: Optional[str] = Field(None, description="Physical location or zone")
    status: str = Field("ACTIVE", description="Camera operational status (ACTIVE/INACTIVE)")


class CameraCreate(CameraBase):
    """Schema for camera registration."""

    pass


class CameraUpdate(BaseModel):
    """Schema for updating camera details."""

    name: Optional[str] = Field(None, min_length=1)
    rtsp_url: Optional[str] = Field(None, min_length=1)
    location: Optional[str] = None
    status: Optional[str] = None


class CameraResponse(CameraBase):
    """Schema for camera responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CameraPaginatedResponse(BaseModel):
    """Paginated list response for cameras."""

    items: List[CameraResponse]
    total: int
    skip: int
    limit: int
