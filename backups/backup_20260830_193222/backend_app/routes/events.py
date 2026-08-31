"""
events.py — API endpoints for managing, receiving, and querying IBVAP surveillance events.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event
from app.schemas import (
    EventCountResponse,
    EventCreate,
    EventResponse,
    EventStatsResponse,
    EventType,
)

router = APIRouter(
    prefix="/api/v1/events",
    tags=["Events"],
)


def _apply_event_filters(
    query,
    event_type: Optional[EventType] = None,
    camera_id: Optional[str] = None,
    confidence_min: Optional[float] = None,
    confidence_max: Optional[float] = None,
):
    """Helper to apply common filtering to an Event query."""
    if confidence_min is not None and confidence_max is not None:
        if confidence_min > confidence_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="confidence_min cannot be greater than confidence_max",
            )

    if event_type is not None:
        query = query.filter(Event.event_type == event_type.value)
    if camera_id is not None:
        query = query.filter(Event.camera_id == camera_id)
    if confidence_min is not None:
        query = query.filter(Event.confidence >= confidence_min)
    if confidence_max is not None:
        query = query.filter(Event.confidence <= confidence_max)

    return query


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive and persist an analytics event",
    description=(
        "Accepts a structured Common Event from an analytics module (e.g. Member 1 CV, "
        "Member 2 ANPR), validates its schema and event type, persists it into the database, "
        "and returns the saved record with its generated database ID."
    ),
)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Create a new event record in the database.
    """
    db_event = Event(
        camera_id=event_in.camera_id,
        event_type=event_in.event_type.value,
        timestamp=event_in.timestamp,
        confidence=event_in.confidence,
        event_metadata=event_in.metadata,
    )
    db.add(db_event)
    db.flush()

    try:
        from app.services.threat_correlation_service import ThreatCorrelationService
        event_dict = {
            "id": db_event.id,
            "camera_id": db_event.camera_id,
            "event_type": db_event.event_type,
            "timestamp": db_event.timestamp,
            "confidence": db_event.confidence,
            "metadata": db_event.event_metadata,
        }
        ThreatCorrelationService.get_instance().correlate_frame_events(
            frame_events=[event_dict],
            camera_id=db_event.camera_id,
            db=db,
        )
    except Exception as exc:
        logger.warning("Threat correlation error on event create: %s", exc)

    db.commit()
    db.refresh(db_event)

    return EventResponse(
        id=db_event.id,
        camera_id=db_event.camera_id,
        event_type=db_event.event_type,
        timestamp=db_event.timestamp,
        confidence=db_event.confidence,
        metadata=db_event.event_metadata,
        created_at=db_event.created_at,
    )


@router.get(
    "",
    response_model=List[EventResponse],
    status_code=status.HTTP_200_OK,
    summary="List and filter persisted surveillance events",
    description=(
        "Retrieve a paginated list of surveillance events ordered newest first (created_at DESC, id DESC). "
        "Supports filtering by event_type, camera_id, and confidence range."
    ),
)
def list_events(
    event_type: Optional[EventType] = Query(
        default=None,
        description="Filter events by category/type (e.g. INTRUSION_DETECTED, ANPR_DETECTED).",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Filter events by camera identifier (e.g. CAM-01).",
    ),
    confidence_min: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Filter events with confidence score greater than or equal to this value.",
    ),
    confidence_max: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Filter events with confidence score less than or equal to this value.",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Maximum number of events to return (between 1 and 100).",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of events to skip for pagination (0 or greater).",
    ),
    db: Session = Depends(get_db),
) -> List[EventResponse]:
    """
    List events from the database with optional filtering and pagination.
    """
    query = _apply_event_filters(
        db.query(Event),
        event_type=event_type,
        camera_id=camera_id,
        confidence_min=confidence_min,
        confidence_max=confidence_max,
    )

    # Order newest first (created_at DESC, then id DESC)
    events = (
        query.order_by(Event.created_at.desc(), Event.id.desc())
        .offset(offset)
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


@router.get(
    "/count",
    response_model=EventCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Count surveillance events matching filters",
    description="Returns the total number of surveillance events that match the supplied query filters.",
)
def count_events(
    event_type: Optional[EventType] = Query(
        default=None,
        description="Filter count by event category.",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Filter count by camera identifier.",
    ),
    confidence_min: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Filter count with confidence >= min.",
    ),
    confidence_max: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Filter count with confidence <= max.",
    ),
    db: Session = Depends(get_db),
) -> EventCountResponse:
    """
    Count matching events using SQL COUNT without loading rows into Python.
    """
    query = _apply_event_filters(
        db.query(func.count(Event.id)),
        event_type=event_type,
        camera_id=camera_id,
        confidence_min=confidence_min,
        confidence_max=confidence_max,
    )
    total = query.scalar() or 0
    return EventCountResponse(count=total)


@router.get(
    "/stats",
    response_model=EventStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get surveillance event statistics",
    description="Returns aggregate counts of events categorized by event type for the dashboard.",
)
def get_event_stats(
    db: Session = Depends(get_db),
) -> EventStatsResponse:
    """
    Calculate and return aggregate event statistics from the database.
    """
    total_events = db.query(func.count(Event.id)).scalar() or 0

    # Aggregate counts by event_type in a single grouped SQL query
    counts = (
        db.query(Event.event_type, func.count(Event.id))
        .group_by(Event.event_type)
        .all()
    )
    counts_dict = dict(counts)

    return EventStatsResponse(
        total_events=total_events,
        total_intrusions=counts_dict.get(EventType.INTRUSION_DETECTED.value, 0),
        total_vehicles=counts_dict.get(EventType.VEHICLE_DETECTED.value, 0),
        total_persons=counts_dict.get(EventType.PERSON_DETECTED.value, 0),
        total_anpr=counts_dict.get(EventType.ANPR_DETECTED.value, 0),
        total_watchlist_matches=counts_dict.get(EventType.WATCHLIST_MATCH.value, 0),
        total_suspicious_activity=counts_dict.get(EventType.SUSPICIOUS_ACTIVITY.value, 0),
    )


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    status_code=status.HTTP_200_OK,
    summary="Get an event by ID",
    description="Fetch details of a specific event using its unique database ID.",
)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Fetch a single event by ID.
    """
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {event_id} not found",
        )
    return EventResponse(
        id=ev.id,
        camera_id=ev.camera_id,
        event_type=ev.event_type,
        timestamp=ev.timestamp,
        confidence=ev.confidence,
        metadata=ev.event_metadata,
        created_at=ev.created_at,
    )
