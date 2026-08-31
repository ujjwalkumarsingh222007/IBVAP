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
