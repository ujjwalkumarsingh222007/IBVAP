import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.camera import Camera
from app.schemas.camera import CameraResponse

logger = logging.getLogger("ibvap.routes.cameras")

router = APIRouter(prefix="/api/v1/cameras", tags=["Cameras"])


@router.get(
    "",
    response_model=List[CameraResponse],
    status_code=status.HTTP_200_OK,
    summary="List Cameras",
    description="Retrieve registered surveillance cameras."
)
def list_cameras(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of registered cameras."""
    try:
        cameras = db.query(Camera).offset(skip).limit(limit).all()
        return cameras
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching cameras: {err}")
        return []
