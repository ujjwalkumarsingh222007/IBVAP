import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.event import Event
from app.models.alert import Alert
from app.schemas.event import EventCreate, EventResponse, EventPaginatedResponse

logger = logging.getLogger("ibvap.routes.events")

router = APIRouter(prefix="/api/v1/events", tags=["Events"])

ALERT_TRIGGER_CONFIG = {
    "INTRUSION_DETECTED": ("INTRUSION_ALERT", "Intrusion detected on camera", "HIGH"),
    "WATCHLIST_MATCH": ("WATCHLIST_ALERT", "Watchlist match detected on camera", "CRITICAL"),
    "SUSPICIOUS_ACTIVITY": ("SUSPICIOUS_ACTIVITY_ALERT", "Suspicious activity detected on camera", "MEDIUM"),
}


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest AI Event",
    description="Ingest a standardized AI event from Member 1 (CV) or Member 2 (ANPR)."
)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db)
):
    """Ingest, validate, and persist a standardized AI event."""
    db_event = Event(
        camera_id=event_in.camera_id,
        event_type=event_in.event_type,
        timestamp=event_in.timestamp,
        confidence=event_in.confidence,
        metadata_json=event_in.metadata,
    )
    try:
        db.add(db_event)
        db.flush()  # Assigns db_event.id before commit

        # Auto-generate alert if event type warrants alert notification
        if event_in.event_type in ALERT_TRIGGER_CONFIG:
            alert_type, msg_prefix, severity = ALERT_TRIGGER_CONFIG[event_in.event_type]
            db_alert = Alert(
                event_id=db_event.id,
                alert_type=alert_type,
                message=f"{msg_prefix} {event_in.camera_id}",
                severity=severity,
                status="NEW",
            )
            db.add(db_alert)

        db.commit()
        db.refresh(db_event)
        return db_event
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error while saving event: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable while storing event."
        )


@router.get(
    "",
    response_model=EventPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Events",
    description="Retrieve ingested AI events with filtering and pagination."
)
def list_events(
    camera_id: Optional[str] = Query(None, description="Filter by camera_id"),
    event_type: Optional[str] = Query(None, description="Filter by event_type"),
    start_time: Optional[datetime] = Query(None, description="Filter events on or after start_time"),
    end_time: Optional[datetime] = Query(None, description="Filter events on or before end_time"),
    skip: int = Query(0, ge=0, description="Number of events to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum events to return (1-100)"),
    db: Session = Depends(get_db)
):
    """Get list of stored AI events with optional database-side filtering and pagination."""
    if start_time and end_time and start_time > end_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_time must not be later than end_time."
        )

    try:
        query = db.query(Event)

        if camera_id:
            query = query.filter(Event.camera_id == camera_id)
        if event_type:
            query = query.filter(Event.event_type == event_type)
        if start_time:
            query = query.filter(Event.timestamp >= start_time)
        if end_time:
            query = query.filter(Event.timestamp <= end_time)

        total = query.count()
        events = query.order_by(Event.id.desc()).offset(skip).limit(limit).all()

        return EventPaginatedResponse(
            items=events,
            total=total,
            skip=skip,
            limit=limit
        )
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching events: {err}")
        return EventPaginatedResponse(items=[], total=0, skip=skip, limit=limit)


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Event Detail",
    description="Retrieve single event details by integer ID."
)
def get_event_detail(
    event_id: int,
    db: Session = Depends(get_db)
):
    """Retrieve event details by ID."""
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID {event_id} not found."
            )
        return event
    except HTTPException:
        raise
    except SQLAlchemyError as err:
        logger.error(f"Database error fetching event {event_id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while fetching event."
        )
