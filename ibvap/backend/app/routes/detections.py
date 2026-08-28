import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.event import Event
from app.schemas.event import EventResponse

logger = logging.getLogger("ibvap.routes.detections")

router = APIRouter(prefix="/api/v1/detections", tags=["Detections"])


@router.get(
    "",
    response_model=List[EventResponse],
    status_code=status.HTTP_200_OK,
    summary="List Detections",
    description="Retrieve object, vehicle, person, and ANPR detection events."
)
def list_detections(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of detection events."""
    detection_types = [
        "OBJECT_DETECTED",
        "VEHICLE_DETECTED",
        "PERSON_DETECTED",
        "ANPR_DETECTED"
    ]
    try:
        detections = (
            db.query(Event)
            .filter(Event.event_type.in_(detection_types))
            .order_by(Event.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return detections
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching detections: {err}")
        return []
