"""
events.py — API endpoints for managing and receiving IBVAP events.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event
from app.schemas import EventCreate, EventResponse

router = APIRouter(
    prefix="/api/v1/events",
    tags=["Events"],
)


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
    summary="List all persisted events",
    description="Retrieve a list of recorded events for verification and inspection.",
)
def list_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[EventResponse]:
    """
    List events from the database.
    """
    events = db.query(Event).order_by(Event.id.desc()).offset(skip).limit(limit).all()
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
