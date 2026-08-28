import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.database import get_db
from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate, CameraResponse, CameraPaginatedResponse

logger = logging.getLogger("ibvap.routes.cameras")

router = APIRouter(prefix="/api/v1/cameras", tags=["Cameras"])


@router.get(
    "",
    response_model=CameraPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Cameras",
    description="Retrieve registered surveillance cameras."
)
def list_cameras(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by camera status (ACTIVE/INACTIVE)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve list of registered cameras with optional pagination."""
    try:
        query = db.query(Camera)
        if status_filter:
            query = query.filter(Camera.status == status_filter)

        total = query.count()
        cameras = query.offset(skip).limit(limit).all()

        return CameraPaginatedResponse(
            items=cameras,
            total=total,
            skip=skip,
            limit=limit
        )
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching cameras: {err}")
        return CameraPaginatedResponse(items=[], total=0, skip=skip, limit=limit)


@router.post(
    "",
    response_model=CameraResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Camera",
    description="Register a new surveillance camera."
)
def create_camera(
    camera_in: CameraCreate,
    db: Session = Depends(get_db)
):
    """Create a new camera record with duplicate camera_id validation."""
    existing = db.query(Camera).filter(Camera.camera_id == camera_in.camera_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Camera with camera_id '{camera_in.camera_id}' already exists."
        )

    db_camera = Camera(
        camera_id=camera_in.camera_id,
        name=camera_in.name,
        rtsp_url=camera_in.rtsp_url,
        location=camera_in.location,
        status=camera_in.status,
    )
    try:
        db.add(db_camera)
        db.commit()
        db.refresh(db_camera)
        return db_camera
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Camera with camera_id '{camera_in.camera_id}' already exists."
        )
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error while creating camera: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while creating camera."
        )


@router.get(
    "/{camera_id}",
    response_model=CameraResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Camera Detail",
    description="Retrieve camera details by camera_id string."
)
def get_camera_detail(
    camera_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve details for a single camera by camera_id."""
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )
    return camera


@router.put(
    "/{camera_id}",
    response_model=CameraResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Camera",
    description="Update camera configuration by camera_id."
)
def update_camera(
    camera_id: str,
    camera_in: CameraUpdate,
    db: Session = Depends(get_db)
):
    """Update camera details."""
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )

    update_data = camera_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)

    try:
        db.commit()
        db.refresh(camera)
        return camera
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error updating camera {camera_id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while updating camera."
        )


@router.delete(
    "/{camera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Camera",
    description="Delete camera configuration by camera_id."
)
def delete_camera(
    camera_id: str,
    db: Session = Depends(get_db)
):
    """Delete a camera record."""
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )

    try:
        db.delete(camera)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error deleting camera {camera_id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while deleting camera."
        )
