"""
vehicles.py — REST API endpoints for Registered & Watchlist Vehicles Management.
"""

from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RegisteredVehicle
from app.schemas import VehicleRegisterRequest, VehicleResponse

logger = logging.getLogger("ibvap.vehicles_route")

router = APIRouter(
    prefix="/api/v1/vehicles",
    tags=["Vehicle Management"],
)


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a known or watchlist vehicle",
)
def register_vehicle(
    payload: VehicleRegisterRequest,
    db: Session = Depends(get_db),
) -> VehicleResponse:
    """Register or update vehicle license plate status in SQLite database."""
    clean_plate = payload.plate_number.replace(" ", "").upper()
    existing = db.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number == clean_plate).first()
    if existing:
        existing.owner_name = payload.owner_name or existing.owner_name
        existing.status = payload.status.value
        existing.notes = payload.notes or existing.notes
        db.commit()
        db.refresh(existing)
        return VehicleResponse.model_validate(existing)

    vehicle = RegisteredVehicle(
        plate_number=clean_plate,
        owner_name=payload.owner_name or "",
        status=payload.status.value,
        notes=payload.notes,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.get(
    "",
    response_model=List[VehicleResponse],
    summary="Get list of registered and watchlist vehicles",
)
def list_vehicles(
    db: Session = Depends(get_db),
) -> List[VehicleResponse]:
    """Retrieve all registered vehicles from SQLite database."""
    vehicles = db.query(RegisteredVehicle).order_by(RegisteredVehicle.id.desc()).all()
    return [VehicleResponse.model_validate(v) for v in vehicles]


@router.delete(
    "/{vehicle_id}",
    summary="Delete vehicle registration",
)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete vehicle from database."""
    vehicle = db.query(RegisteredVehicle).filter(RegisteredVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle #{vehicle_id} not found.",
        )
    db.delete(vehicle)
    db.commit()
    return {"status": "success", "message": f"Vehicle #{vehicle_id} deleted successfully."}


@router.put(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Update vehicle registration details",
)
def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdateRequest,
    db: Session = Depends(get_db),
) -> VehicleResponse:
    """Update vehicle plate, owner name, status, or notes in SQLite database."""
    from app.schemas import VehicleUpdateRequest

    vehicle = db.query(RegisteredVehicle).filter(RegisteredVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle #{vehicle_id} not found.",
        )

    if payload.plate_number is not None:
        clean_p = payload.plate_number.replace(" ", "").upper()
        # Check if plate already exists under another ID
        existing = db.query(RegisteredVehicle).filter(
            RegisteredVehicle.plate_number == clean_p,
            RegisteredVehicle.id != vehicle_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Plate '{clean_p}' is already registered under ID #{existing.id}.",
            )
        vehicle.plate_number = clean_p

    if payload.owner_name is not None:
        vehicle.owner_name = payload.owner_name.strip()
    if payload.status is not None:
        vehicle.status = payload.status.value
    if payload.notes is not None:
        vehicle.notes = payload.notes.strip()

    db.commit()
    db.refresh(vehicle)
    logger.info("[VEHICLE UPDATE] Vehicle #%d ('%s') updated (status=%s)", vehicle.id, vehicle.plate_number, vehicle.status)
    return VehicleResponse.model_validate(vehicle)


@router.post(
    "/bulk-delete",
    summary="Bulk delete multiple vehicle records",
)
def bulk_delete_vehicles(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Delete multiple registered vehicles in a single transaction."""
    from app.schemas import BulkDeleteRequest

    if not payload.ids:
        return {"status": "success", "deleted_count": 0}

    vehicles = db.query(RegisteredVehicle).filter(RegisteredVehicle.id.in_(payload.ids)).all()
    count = len(vehicles)

    for v in vehicles:
        db.delete(v)

    db.commit()
    logger.info("[VEHICLE BULK DELETE] Deleted %d vehicle(s)", count)
    return {"status": "success", "deleted_count": count, "message": f"Successfully deleted {count} vehicles."}


@router.post(
    "/bulk-status",
    summary="Bulk update status of multiple vehicle records",
)
def bulk_status_vehicles(
    payload: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Update status (KNOWN / FLAGGED / WATCHLIST) for multiple vehicles."""
    from app.schemas import BulkStatusUpdateRequest

    new_status = payload.status.strip().upper()
    if new_status not in ("KNOWN", "FLAGGED", "WATCHLIST"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid status. Must be KNOWN, FLAGGED, or WATCHLIST.",
        )

    vehicles = db.query(RegisteredVehicle).filter(RegisteredVehicle.id.in_(payload.ids)).all()
    for v in vehicles:
        v.status = new_status

    db.commit()
    logger.info("[VEHICLE BULK STATUS] Updated %d vehicle(s) to status=%s", len(vehicles), new_status)
    return {"status": "success", "updated_count": len(vehicles), "message": f"Updated {len(vehicles)} vehicles to {new_status}."}

