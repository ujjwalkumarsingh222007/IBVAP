"""
health.py — API endpoint for system and database health checks.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import HealthResponse

router = APIRouter(
    prefix="/api/v1/health",
    tags=["Health"],
)


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System and Database Health Check",
    description="Validates overall API service status and tests database connectivity.",
)
def get_health(
    response: Response,
    db: Session = Depends(get_db),
) -> HealthResponse:
    """
    Check API and database health.
    """
    try:
        # Test actual database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
        overall_status = "healthy"
    except Exception:
        db_status = "disconnected"
        overall_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=overall_status,
        service="IBVAP Backend",
        database=db_status,
    )
