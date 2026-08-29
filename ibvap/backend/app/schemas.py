"""
schemas.py — Pydantic request and response schemas for IBVAP backend.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Event Schemas
# ---------------------------------------------------------------------------

class EventType(str, Enum):
    """
    Allowed IBVAP event types. Any incoming event or query filter with an unlisted type
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


class EventStatsResponse(BaseModel):
    """Aggregated surveillance statistics for the dashboard."""
    total_events: int = Field(0, description="Total count of all surveillance events.")
    total_intrusions: int = Field(0, description="Count of INTRUSION_DETECTED events.")
    total_vehicles: int = Field(0, description="Count of VEHICLE_DETECTED events.")
    total_persons: int = Field(0, description="Count of PERSON_DETECTED events.")
    total_anpr: int = Field(0, description="Count of ANPR_DETECTED events.")
    total_watchlist_matches: int = Field(0, description="Count of WATCHLIST_MATCH events.")
    total_suspicious_activity: int = Field(0, description="Count of SUSPICIOUS_ACTIVITY events.")


class EventCountResponse(BaseModel):
    """Event count response model."""
    count: int = Field(..., description="Count of events matching the query filters.")


# ---------------------------------------------------------------------------
# Camera Schemas
# ---------------------------------------------------------------------------

class CameraStatus(str, Enum):
    """Allowed camera operating states."""
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    UNKNOWN = "UNKNOWN"


class CameraBase(BaseModel):
    """Base fields for camera management."""
    camera_id: str = Field(
        ...,
        min_length=1,
        description="Unique identifier for the camera.",
        examples=["CAM-01"],
    )
    name: str = Field(
        ...,
        min_length=1,
        description="Descriptive name of the camera stream.",
        examples=["Main Gate Camera"],
    )
    location: Optional[str] = Field(
        default=None,
        description="Physical location or zone.",
        examples=["North Perimeter Gate"],
    )
    status: CameraStatus = Field(
        default=CameraStatus.ONLINE,
        description="Current operational status of the camera.",
        examples=[CameraStatus.ONLINE],
    )


class CameraCreate(CameraBase):
    """Schema for registering a new camera."""
    pass


class CameraUpdate(BaseModel):
    """Schema for updating camera metadata or status."""
    name: Optional[str] = Field(None, min_length=1, description="Updated camera name.")
    location: Optional[str] = Field(None, description="Updated physical location.")
    status: Optional[CameraStatus] = Field(None, description="Updated operational status.")


class CameraResponse(CameraBase):
    """Schema returned for camera operations."""
    id: int = Field(..., description="Unique database ID.")
    created_at: datetime = Field(..., description="Timestamp when the camera was registered.")
    updated_at: datetime = Field(..., description="Timestamp when the camera was last updated.")

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Dashboard Schemas
# ---------------------------------------------------------------------------

class DashboardSummaryResponse(BaseModel):
    """Comprehensive dashboard summary metrics."""
    total_events: int = Field(0, description="Total count of all surveillance events.")
    total_intrusions: int = Field(0, description="Count of intrusion detections.")
    total_persons: int = Field(0, description="Count of person detections.")
    total_vehicles: int = Field(0, description="Count of vehicle detections.")
    total_anpr: int = Field(0, description="Count of ANPR license plate detections.")
    total_watchlist_matches: int = Field(0, description="Count of watchlist matches.")
    total_suspicious_activity: int = Field(0, description="Count of suspicious activity detections.")
    active_cameras: int = Field(0, description="Number of currently ONLINE cameras.")
    total_cameras: int = Field(0, description="Total number of registered cameras.")


# ---------------------------------------------------------------------------
# Health Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """System health check response."""
    status: str = Field(..., description="Overall system health status (e.g. healthy).")
    service: str = Field(..., description="Service name identifier.")
    database: str = Field(..., description="Database connection status (connected/disconnected).")


# ---------------------------------------------------------------------------
# Phase 3B Analytics & Threat Intelligence Schemas
# ---------------------------------------------------------------------------

class ThreatSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ThreatCounts(BaseModel):
    """Breakdown of threats by operational severity."""
    total_threats: int = Field(0, description="Total high-risk surveillance events (Critical + High + Medium).")
    critical: int = Field(0, description="CRITICAL severity: Watchlist matches / wanted targets.")
    high: int = Field(0, description="HIGH severity: Perimeter intrusions & suspicious activity.")
    medium: int = Field(0, description="MEDIUM severity: Vehicle detections / tracking anomalies.")
    low: int = Field(0, description="LOW severity: Standard person and object detections.")


class ConfidenceStats(BaseModel):
    """Statistical summary of detection confidence."""
    avg_confidence: float = Field(0.0, description="Average confidence score across filtered events (0.0 to 1.0).")
    min_confidence: float = Field(0.0, description="Minimum confidence score observed.")
    max_confidence: float = Field(0.0, description="Maximum confidence score observed.")


class AnalyticsSummaryResponse(BaseModel):
    """High-level operational analytics summary."""
    total_events: int = Field(0, description="Total surveillance detections matching filter criteria.")
    threats: ThreatCounts = Field(default_factory=ThreatCounts, description="Threat counts by severity.")
    confidence_stats: ConfidenceStats = Field(default_factory=ConfidenceStats, description="Detection confidence statistics.")
    event_type_counts: Dict[str, int] = Field(default_factory=dict, description="Counts broken down by event type.")
    time_range: Dict[str, Optional[str]] = Field(default_factory=dict, description="Active start and end time filters.")


class TrendBucket(BaseModel):
    """Aggregated event and threat counts for a time bucket."""
    bucket: str = Field(..., description="Timestamp bucket (e.g., '2026-08-29 10:00' or '2026-08-29').")
    total_events: int = Field(0, description="Total events within this bucket.")
    intrusions: int = Field(0, description="Intrusions within this bucket.")
    watchlist_matches: int = Field(0, description="Watchlist hits within this bucket.")
    suspicious_activity: int = Field(0, description="Suspicious activity detections.")
    vehicles: int = Field(0, description="Vehicle detections.")
    persons: int = Field(0, description="Person detections.")
    total_threats: int = Field(0, description="Total threats (critical + high + medium).")
    avg_confidence: float = Field(0.0, description="Average confidence in this bucket.")


class AnalyticsTrendsResponse(BaseModel):
    """Time-series trend analysis response."""
    interval: str = Field("hourly", description="Interval granularity used ('hourly' or 'daily').")
    trends: List[TrendBucket] = Field(default_factory=list, description="Ordered chronological trend buckets.")


class CameraActivityRanking(BaseModel):
    """Per-camera operational activity and threat ranking."""
    camera_id: str = Field(..., description="Unique camera identifier.")
    camera_name: Optional[str] = Field(None, description="Registered camera name.")
    location: Optional[str] = Field(None, description="Physical installation zone.")
    status: Optional[str] = Field("ONLINE", description="Camera operating status.")
    total_events: int = Field(0, description="Total events generated by this camera.")
    threat_count: int = Field(0, description="Total threat events (critical + high + medium).")
    critical_threats: int = Field(0, description="Watchlist hits originating from this camera.")
    high_threats: int = Field(0, description="Intrusions and suspicious events from this camera.")
    medium_threats: int = Field(0, description="Vehicle events from this camera.")
    avg_confidence: float = Field(0.0, description="Mean detection confidence.")
    last_event_time: Optional[str] = Field(None, description="Timestamp of the latest event.")


class AnalyticsCamerasResponse(BaseModel):
    """Ranking of surveillance cameras by detection and threat volume."""
    cameras: List[CameraActivityRanking] = Field(default_factory=list, description="Cameras ordered by threat volume.")


class EventTypeDistributionItem(BaseModel):
    """Distribution item for event category."""
    event_type: str = Field(..., description="Surveillance event type.")
    count: int = Field(..., description="Number of occurrences.")
    percentage: float = Field(..., description="Percentage of total events (0.0 to 100.0).")


class AnalyticsDistributionResponse(BaseModel):
    """Category distribution and threat severity breakdown."""
    total_events: int = Field(0, description="Total events analyzed.")
    distribution: List[EventTypeDistributionItem] = Field(default_factory=list, description="Distribution by event type.")
    threat_breakdown: ThreatCounts = Field(default_factory=ThreatCounts, description="Threat counts by severity.")
