"""
evidence.py — API endpoints for viewing and managing captured surveillance evidence.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EvidenceCountResponse, EvidenceCreate, EvidenceResponse
from app.services.evidence_service import EvidenceService

router = APIRouter(
    prefix="/api/v1/evidence",
    tags=["Evidence Management"],
)


@router.get(
    "",
    response_model=List[EvidenceResponse],
    status_code=status.HTTP_200_OK,
    summary="Get list of captured surveillance evidence records",
)
def list_evidence(
    limit: int = Query(50, ge=1, le=200, description="Max evidence items to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    detection_type: Optional[str] = Query(None, description="Filter by detection type (person/vehicle)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (UNKNOWN/FLAGGED)"),
    db: Session = Depends(get_db),
) -> List[EvidenceResponse]:
    """Retrieve paginated list of captured evidence photos and metadata."""
    service = EvidenceService.get_instance()
    items = service.get_evidence_list(
        db=db,
        limit=limit,
        offset=offset,
        camera_id=camera_id,
        detection_type=detection_type,
        status=status_filter,
    )
    return [EvidenceResponse.model_validate(item) for item in items]


@router.get(
    "/count",
    response_model=EvidenceCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get count of captured evidence records",
)
def count_evidence(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    detection_type: Optional[str] = Query(None, description="Filter by detection type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    db: Session = Depends(get_db),
) -> EvidenceCountResponse:
    """Count total evidence records matching query filters."""
    service = EvidenceService.get_instance()
    total = service.get_evidence_count(
        db=db,
        camera_id=camera_id,
        detection_type=detection_type,
        status=status_filter,
    )
    return EvidenceCountResponse(count=total)


@router.get(
    "/{evidence_id}",
    response_model=EvidenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single evidence record by ID",
)
def get_evidence_detail(
    evidence_id: int,
    db: Session = Depends(get_db),
) -> EvidenceResponse:
    """Retrieve detailed metadata for an individual evidence capture."""
    service = EvidenceService.get_instance()
    item = service.get_evidence_by_id(db, evidence_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence record #{evidence_id} not found.",
        )
    return EvidenceResponse.model_validate(item)


@router.delete(
    "/{evidence_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete evidence record and associated images",
)
def delete_evidence_item(
    evidence_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete evidence record from database and remove stored image files from disk."""
    service = EvidenceService.get_instance()
    success = service.delete_evidence(db, evidence_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence record #{evidence_id} not found.",
        )
    return {"status": "success", "message": f"Evidence #{evidence_id} deleted successfully."}
