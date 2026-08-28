import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.event import Event
from app.schemas.event import EventPaginatedResponse

logger = logging.getLogger("ibvap.routes.detections")

router = APIRouter(prefix="/api/v1/detections", tags=["Detections"])

DETECTION_EVENT_TYPES = [
    "OBJECT_DETECTED",
    "VEHICLE_DETECTED",
    "PERSON_DETECTED",
    "ANPR_DETECTED",
    "INTRUSION_DETECTED",
    "SUSPICIOUS_ACTIVITY",
]


@router.get(
    "",
    response_model=EventPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Detections",
    description="Retrieve object, vehicle, person, ANPR, intrusion, and suspicious detection events."
)
def list_detections(
    camera_id: Optional[str] = Query(None, description="Filter by camera_id"),
    event_type: Optional[str] = Query(None, description="Filter by specific detection event_type"),
    start_time: Optional[datetime] = Query(None, description="Filter detections on or after start_time"),
    end_time: Optional[datetime] = Query(None, description="Filter detections on or before end_time"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum items to return (1-100)"),
    db: Session = Depends(get_db)
):
    """Retrieve list of detection events with optional filtering and pagination."""
    if start_time and end_time and start_time > end_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_time must not be later than end_time."
        )

    try:
        query = db.query(Event)

        if event_type:
            if event_type not in DETECTION_EVENT_TYPES:
                return EventPaginatedResponse(items=[], total=0, skip=skip, limit=limit)
            query = query.filter(Event.event_type == event_type)
        else:
            query = query.filter(Event.event_type.in_(DETECTION_EVENT_TYPES))

        if camera_id:
            query = query.filter(Event.camera_id == camera_id)
        if start_time:
            query = query.filter(Event.timestamp >= start_time)
        if end_time:
            query = query.filter(Event.timestamp <= end_time)

        total = query.count()
        detections = query.order_by(Event.id.desc()).offset(skip).limit(limit).all()

        return EventPaginatedResponse(
            items=detections,
            total=total,
            skip=skip,
            limit=limit
        )
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching detections: {err}")
        return EventPaginatedResponse(items=[], total=0, skip=skip, limit=limit)
