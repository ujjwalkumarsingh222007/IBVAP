"""
cameras.py — API endpoints for camera registration, management, and status monitoring.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Camera
from app.schemas import CameraCreate, CameraResponse, CameraUpdate

router = APIRouter(
    prefix="/api/v1/cameras",
    tags=["Cameras"],
)


@router.post(
    "",
    response_model=CameraResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new camera",
    description="Registers a surveillance camera stream. Rejects duplicate camera_id with HTTP 409 Conflict.",
)
def create_camera(
    camera_in: CameraCreate,
    db: Session = Depends(get_db),
) -> CameraResponse:
    """
    Create a new camera stream entry.
    """
    existing = db.query(Camera).filter(Camera.camera_id == camera_in.camera_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Camera with ID '{camera_in.camera_id}' already exists",
        )

    db_camera = Camera(
        camera_id=camera_in.camera_id,
        name=camera_in.name,
        location=camera_in.location,
        status=camera_in.status.value,
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)

    return CameraResponse(
        id=db_camera.id,
        camera_id=db_camera.camera_id,
        name=db_camera.name,
        location=db_camera.location,
        status=db_camera.status,
        created_at=db_camera.created_at,
        updated_at=db_camera.updated_at,
    )


@router.get(
    "",
    response_model=List[CameraResponse],
    status_code=status.HTTP_200_OK,
    summary="List all registered cameras",
    description="Returns a list of all registered cameras and their current statuses.",
)
def list_cameras(
    db: Session = Depends(get_db),
) -> List[CameraResponse]:
    """
    List all cameras.
    """
    cameras = db.query(Camera).order_by(Camera.created_at.desc(), Camera.id.desc()).all()
    return [
        CameraResponse(
            id=cam.id,
            camera_id=cam.camera_id,
            name=cam.name,
            location=cam.location,
            status=cam.status,
            created_at=cam.created_at,
            updated_at=cam.updated_at,
        )
        for cam in cameras
    ]


@router.get(
    "/{camera_id}",
    response_model=CameraResponse,
    status_code=status.HTTP_200_OK,
    summary="Get camera details by ID",
    description="Fetch camera information using its unique string camera identifier (e.g. CAM-01).",
)
def get_camera(
    camera_id: str,
    db: Session = Depends(get_db),
) -> CameraResponse:
    """
    Fetch a single camera.
    """
    cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{camera_id}' not found",
        )
    return CameraResponse(
        id=cam.id,
        camera_id=cam.camera_id,
        name=cam.name,
        location=cam.location,
        status=cam.status,
        created_at=cam.created_at,
        updated_at=cam.updated_at,
    )


@router.put(
    "/{camera_id}",
    response_model=CameraResponse,
    status_code=status.HTTP_200_OK,
    summary="Update camera details or status",
    description="Update the name, location, or operational status of an existing camera.",
)
def update_camera(
    camera_id: str,
    camera_in: CameraUpdate,
    db: Session = Depends(get_db),
) -> CameraResponse:
    """
    Update a camera record.
    """
    cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{camera_id}' not found",
        )

    if camera_in.name is not None:
        cam.name = camera_in.name
    if camera_in.location is not None:
        cam.location = camera_in.location
    if camera_in.status is not None:
        cam.status = camera_in.status.value

    db.commit()
    db.refresh(cam)

    return CameraResponse(
        id=cam.id,
        camera_id=cam.camera_id,
        name=cam.name,
        location=cam.location,
        status=cam.status,
        created_at=cam.created_at,
        updated_at=cam.updated_at,
    )


@router.delete(
    "/{camera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a camera",
    description="Deletes a camera stream entry. Historical surveillance events associated with this camera_id remain intact.",
)
def delete_camera(
    camera_id: str,
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a camera record without deleting historical events.
    """
    cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with ID '{camera_id}' not found",
        )

    db.delete(cam)
    db.commit()
    return None
