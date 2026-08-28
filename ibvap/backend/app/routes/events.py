import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.event import Event
from app.schemas.event import EventCreate, EventResponse

logger = logging.getLogger("ibvap.routes.events")

router = APIRouter(prefix="/api/v1/events", tags=["Events"])


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
    """Ingest and persist a validated AI event."""
    db_event = Event(
        camera_id=event_in.camera_id,
        event_type=event_in.event_type,
        timestamp=event_in.timestamp,
        confidence=event_in.confidence,
        metadata_json=event_in.metadata,
    )
    try:
        db.add(db_event)
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
    response_model=List[EventResponse],
    status_code=status.HTTP_200_OK,
    summary="List Events",
    description="Retrieve ingested AI events from database."
)
def list_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get list of stored AI events."""
    try:
        events = db.query(Event).order_by(Event.id.desc()).offset(skip).limit(limit).all()
        return events
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching events: {err}")
        return []
