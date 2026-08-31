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
    UNKNOWN_PERSON = "UNKNOWN_PERSON"
    FLAGGED_PERSON = "FLAGGED_PERSON"
    UNKNOWN_VEHICLE = "UNKNOWN_VEHICLE"
    FLAGGED_VEHICLE = "FLAGGED_VEHICLE"


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
# Health & System Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """System health check response."""
    status: str = Field(..., description="Overall system health status (e.g. healthy).")
    service: str = Field(..., description="Service name identifier.")
    database: str = Field(..., description="Database connection status (connected/disconnected).")
    version: str = Field(default="1.0.0", description="Backend API service version.")
    uptime_seconds: Optional[float] = Field(default=None, description="System uptime in seconds.")
    active_cameras: Optional[int] = Field(default=None, description="Number of currently active/online cameras.")
    total_events: Optional[int] = Field(default=None, description="Total persisted surveillance events.")
    ai_pipeline_status: Optional[str] = Field(default="ONLINE", description="AI pipeline status.")
    anpr_detector: Optional[str] = Field(default=None, description="Active license plate detector.")
    ocr_engine: Optional[str] = Field(default=None, description="Active OCR recognition engine.")


# ---------------------------------------------------------------------------
# Demo Management Schemas
# ---------------------------------------------------------------------------

class DemoResetRequest(BaseModel):
    """Payload to confirm demo data reset."""
    confirm: bool = Field(..., description="Confirmation flag required to clear demo events.")


class DemoResetResponse(BaseModel):
    """Result of demo data reset."""
    status: str = Field(..., description="Result status.")
    message: str = Field(..., description="Explanation of action taken.")
    events_cleared: int = Field(0, description="Count of surveillance events cleared.")
    cameras_restored: int = Field(0, description="Count of cameras verified/restored.")


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


# ---------------------------------------------------------------------------
# Authentication & User Schemas
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    """Allowed user security roles."""
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class LoginRequest(BaseModel):
    """User credentials for authentication."""
    username: str = Field(..., min_length=1, max_length=64, description="User username")
    password: str = Field(..., min_length=1, description="User password")


class TokenResponse(BaseModel):
    """Bearer token payload returned after successful login."""
    access_token: str = Field(..., description="JWT Bearer access token")
    token_type: str = Field(default="bearer", description="Token scheme")
    expires_in: int = Field(..., description="Access token lifetime in seconds")
    role: Optional[str] = Field(default=None, description="Assigned role of authenticated user")
    username: Optional[str] = Field(default=None, description="Username of authenticated user")


class UserCreate(BaseModel):
    """Schema for registering a new user."""
    username: str = Field(..., min_length=3, max_length=64, description="Unique username")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    role: UserRole = Field(default=UserRole.OPERATOR, description="Assigned role")


class UserResponse(BaseModel):
    """Safe user profile response (password hash omitted)."""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique database user ID")
    username: str = Field(..., description="Username")
    role: str = Field(..., description="User role")
    is_active: bool = Field(default=True, description="Whether the account is active")
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")


class AuditLogResponse(BaseModel):
    """Audit log item schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Unique audit log entry ID")
    user_id: Optional[int] = Field(default=None, description="User ID if authenticated")
    username: str = Field(..., description="Username of actor")
    action: str = Field(..., description="Action performed")
    endpoint: str = Field(..., description="API endpoint")
    timestamp: datetime = Field(..., description="Timestamp of action")
    success: bool = Field(default=True, description="Whether action succeeded")
    details: Optional[str] = Field(default=None, description="Context details")


# ---------------------------------------------------------------------------
# AI Frame Processing Schemas
# ---------------------------------------------------------------------------

class AIFrameProcessResponse(BaseModel):
    """Response payload returned when a live webcam/video frame is analyzed by Member 1 CV & Member 2 ANPR."""
    status: str = Field("success", description="Processing status")
    camera_id: str = Field(..., description="Originating camera identifier")
    processed: bool = Field(True, description="Whether frame was processed by AI pipeline")
    detections_count: int = Field(0, description="Total detections in this frame")
    detections: List[Dict[str, Any]] = Field(default_factory=list, description="Raw bounding box detections")
    events_count: int = Field(0, description="Total analytics events generated from this frame")
    events: List[Dict[str, Any]] = Field(default_factory=list, description="Emitted Common Event records")
    correlated_threat: Optional[Dict[str, Any]] = Field(default=None, description="Active correlated threat if formed or updated")


# ---------------------------------------------------------------------------
# Phase 3D Unified Threat Intelligence & Correlation Schemas
# ---------------------------------------------------------------------------

class ThreatStatus(str, Enum):
    """Lifecycle status of a correlated threat."""
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class ThreatTimelineItem(BaseModel):
    """Chronological event entry contributing to a correlated threat."""
    id: Optional[int] = Field(None, description="Database event ID")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    event_type: str = Field(..., description="Surveillance event type")
    camera_id: str = Field(..., description="Camera identifier")
    description: str = Field(..., description="Human-readable event summary")
    confidence: float = Field(..., description="Detection confidence")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Original event metadata")


class ThreatResponse(BaseModel):
    """Summary representation of a correlated threat."""
    id: int = Field(..., description="Unique database ID")
    threat_id: str = Field(..., description="Unique threat tracking code")
    camera_id: str = Field(..., description="Originating camera identifier")
    severity: ThreatSeverity = Field(..., description="Threat severity level (CRITICAL, HIGH, MEDIUM, LOW)")
    score: float = Field(..., description="Calculated rule-based threat score (0.0 to 100.0)")
    title: str = Field(..., description="Short descriptive threat headline")
    reason: str = Field(..., description="Operational rationale for threat generation")
    status: ThreatStatus = Field(default=ThreatStatus.ACTIVE, description="Threat lifecycle state")
    first_event_time: str = Field(..., description="Timestamp of first contributing event")
    last_event_time: str = Field(..., description="Timestamp of most recent contributing event")
    event_count: int = Field(1, description="Number of correlated events")
    threat_metadata: Dict[str, Any] = Field(default_factory=dict, description="Aggregated threat metadata")
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")

    model_config = ConfigDict(from_attributes=True)


class ThreatDetailResponse(ThreatResponse):
    """Detailed representation of a correlated threat including all underlying events and timeline."""
    events: List[EventResponse] = Field(default_factory=list, description="Raw correlated surveillance events")
    timeline: List[ThreatTimelineItem] = Field(default_factory=list, description="Chronologically ordered threat timeline")


class ThreatStatsResponse(BaseModel):
    """Aggregated operational metrics for correlated threats."""
    total_threats: int = Field(0, description="Total correlated threats")
    active_threats: int = Field(0, description="Number of currently ACTIVE threats")
    critical: int = Field(0, description="CRITICAL severity threats")
    high: int = Field(0, description="HIGH severity threats")
    medium: int = Field(0, description="MEDIUM severity threats")
    low: int = Field(0, description="LOW severity threats")
    acknowledged: int = Field(0, description="ACKNOWLEDGED threats")
    resolved: int = Field(0, description="RESOLVED threats")


class ThreatStatusUpdate(BaseModel):
    """Payload for updating a threat's lifecycle status."""
    status: ThreatStatus = Field(..., description="New threat status (ACTIVE, ACKNOWLEDGED, RESOLVED)")
    reason: Optional[str] = Field(None, description="Optional operator note or resolution reason")


# ---------------------------------------------------------------------------
# Evidence Schemas
# ---------------------------------------------------------------------------

class EvidenceCreate(BaseModel):
    camera_id: str = Field(..., min_length=1)
    timestamp: str = Field(...)
    detection_type: str = Field(..., description="person or vehicle")
    status: str = Field(..., description="UNKNOWN, FLAGGED, or KNOWN")
    confidence: float = Field(..., ge=0.0, le=1.0)
    image_path: str = Field(...)
    crop_image_path: Optional[str] = Field(None)
    bbox_x1: Optional[float] = Field(None)
    bbox_y1: Optional[float] = Field(None)
    bbox_x2: Optional[float] = Field(None)
    bbox_y2: Optional[float] = Field(None)
    person_id: Optional[str] = Field(None)
    vehicle_id: Optional[str] = Field(None)
    plate_number: Optional[str] = Field(None)
    reason: Optional[str] = Field(None)
    event_id: Optional[int] = Field(None)


class EvidenceResponse(BaseModel):
    id: int
    camera_id: str
    timestamp: str
    detection_type: str
    status: str
    confidence: float
    image_path: str
    crop_image_path: Optional[str] = None
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None
    person_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    plate_number: Optional[str] = None
    reason: Optional[str] = None
    event_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceCountResponse(BaseModel):
    count: int


# ---------------------------------------------------------------------------
# Person & Face Registration Schemas
# ---------------------------------------------------------------------------

class PersonStatus(str, Enum):
    KNOWN = "KNOWN"
    FLAGGED = "FLAGGED"


class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    status: PersonStatus = Field(default=PersonStatus.KNOWN)
    person_code: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = Field(None, max_length=256)


class PersonResponse(BaseModel):
    id: int
    person_code: str
    name: str
    status: str
    face_image_path: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PersonRegisterResponse(BaseModel):
    status: str
    person_id: str
    name: str
    person_status: str
    face_image_url: Optional[str] = None
    message: str


# ---------------------------------------------------------------------------
# Registered Vehicle Schemas
# ---------------------------------------------------------------------------

class VehicleStatus(str, Enum):
    KNOWN = "KNOWN"
    FLAGGED = "FLAGGED"
    WATCHLIST = "WATCHLIST"


class VehicleRegisterRequest(BaseModel):
    plate_number: str = Field(..., min_length=1, max_length=64)
    owner_name: Optional[str] = Field(default="", max_length=128)
    status: VehicleStatus = Field(default=VehicleStatus.KNOWN)
    notes: Optional[str] = Field(None, max_length=256)


class VehicleResponse(BaseModel):
    id: int
    plate_number: str
    owner_name: str
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PersonUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    status: Optional[PersonStatus] = None
    notes: Optional[str] = Field(None, max_length=256)


class VehicleUpdateRequest(BaseModel):
    plate_number: Optional[str] = Field(None, min_length=1, max_length=64)
    owner_name: Optional[str] = Field(None, max_length=128)
    status: Optional[VehicleStatus] = None
    notes: Optional[str] = Field(None, max_length=256)


class BulkDeleteRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1, description="List of integer IDs to delete")


class BulkStatusUpdateRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1, description="List of integer IDs to update")
    status: str = Field(..., description="New status value")
