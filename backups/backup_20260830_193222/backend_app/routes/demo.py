"""
demo.py — API endpoints for evaluator demonstration data control and safe reset.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Camera, Event, User
from app.auth.dependencies import get_current_user_optional, log_audit_action
from app.schemas import DemoResetRequest, DemoResetResponse

router = APIRouter(
    prefix="/api/v1/demo",
    tags=["Demo Management"],
)

DEMO_DEFAULT_CAMERAS = [
    {"camera_id": "CAM-BORDER-01", "name": "Sector 4 North Fence", "location": "North Perimeter Line", "status": "ONLINE"},
    {"camera_id": "CAM-BORDER-02", "name": "Sector 9 Virtual Fence", "location": "East Border Valley", "status": "ONLINE"},
    {"camera_id": "CAM-GATE-01", "name": "Main Vehicle Checkpoint", "location": "Highway 1 Entry Gate", "status": "ONLINE"},
    {"camera_id": "CAM-TOWER-04", "name": "Watchtower Thermal PTZ", "location": "Outpost Charlie", "status": "ONLINE"},
]


@router.post(
    "/reset",
    response_model=DemoResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Safely reset demo surveillance events and reseed demo cameras",
    description="Clears generated events and re-establishes default camera baseline for demonstrations.",
)
def reset_demo_data(
    payload: DemoResetRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> DemoResetResponse:
    """
    Clear simulation events and reinitialize demo cameras while preserving DB schema and audit logs.
    """
    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation required: 'confirm' must be true to execute demo reset",
        )

    # 1. Clear surveillance events
    events_cleared = db.query(Event).delete()

    # 2. Reseed / ensure demo cameras exist
    cameras_restored = 0
    for cam_info in DEMO_DEFAULT_CAMERAS:
        existing_cam = db.query(Camera).filter(Camera.camera_id == cam_info["camera_id"]).first()
        if not existing_cam:
            new_cam = Camera(
                camera_id=cam_info["camera_id"],
                name=cam_info["name"],
                location=cam_info["location"],
                status=cam_info["status"],
            )
            db.add(new_cam)
            cameras_restored += 1
        else:
            # Ensure online status for demo
            existing_cam.status = cam_info["status"]
            existing_cam.name = cam_info["name"]
            existing_cam.location = cam_info["location"]
            cameras_restored += 1

    # 3. Log security audit action
    username = current_user.username if current_user else "SYSTEM/DEMO"
    user_id = current_user.id if current_user else None

    log_audit_action(
        db=db,
        username=username,
        user_id=user_id,
        action="RESET_DEMO_DATA",
        endpoint="/api/v1/demo/reset",
        success=True,
        details=f"Cleared {events_cleared} surveillance events. Verified {cameras_restored} demo cameras.",
    )

    db.commit()

    return DemoResetResponse(
        status="success",
        message=f"Demo baseline restored: {events_cleared} events cleared, {cameras_restored} cameras initialized.",
        events_cleared=events_cleared,
        cameras_restored=cameras_restored,
    )
