"""
dashboard.py — API endpoints for surveillance dashboard overview, summaries, and recent alerts.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Camera, Event
from app.schemas import (
    CameraStatus,
    DashboardSummaryResponse,
    EventResponse,
    EventType,
)

router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Surveillance Dashboard Summary",
    description="Returns aggregated event metrics across all categories along with active/total camera counts.",
)
def get_dashboard_summary(
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    """
    Compute unified dashboard metrics from events and camera tables.
    """
    total_events = db.query(func.count(Event.id)).scalar() or 0

    # Aggregate counts by event_type
    counts = (
        db.query(Event.event_type, func.count(Event.id))
        .group_by(Event.event_type)
        .all()
    )
    counts_dict = dict(counts)

    # Camera metrics
    total_cameras = db.query(func.count(Camera.id)).scalar() or 0
    active_cameras = (
        db.query(func.count(Camera.id))
        .filter(Camera.status == CameraStatus.ONLINE.value)
        .scalar()
        or 0
    )

    return DashboardSummaryResponse(
        total_events=total_events,
        total_intrusions=counts_dict.get(EventType.INTRUSION_DETECTED.value, 0),
        total_persons=counts_dict.get(EventType.PERSON_DETECTED.value, 0),
        total_vehicles=counts_dict.get(EventType.VEHICLE_DETECTED.value, 0),
        total_anpr=counts_dict.get(EventType.ANPR_DETECTED.value, 0),
        total_watchlist_matches=counts_dict.get(EventType.WATCHLIST_MATCH.value, 0),
        total_suspicious_activity=counts_dict.get(EventType.SUSPICIOUS_ACTIVITY.value, 0),
        active_cameras=active_cameras,
        total_cameras=total_cameras,
    )


@router.get(
    "/recent-events",
    response_model=List[EventResponse],
    status_code=status.HTTP_200_OK,
    summary="Get recent surveillance events",
    description="Returns the most recent surveillance events ordered newest first (created_at DESC, id DESC).",
)
def get_recent_events(
    limit: int = Query(
        default=10,
        ge=1,
        le=50,
        description="Number of recent events to retrieve (between 1 and 50).",
    ),
    db: Session = Depends(get_db),
) -> List[EventResponse]:
    """
    Fetch the latest surveillance events for dashboard feeds.
    """
    events = (
        db.query(Event)
        .order_by(Event.created_at.desc(), Event.id.desc())
        .limit(limit)
        .all()
    )
    return [
        EventResponse(
            id=ev.id,
            camera_id=ev.camera_id,
            event_type=ev.event_type,
            timestamp=ev.timestamp,
            confidence=ev.confidence,
            metadata=ev.event_metadata,
            created_at=ev.created_at,
        )
        for ev in events
    ]
