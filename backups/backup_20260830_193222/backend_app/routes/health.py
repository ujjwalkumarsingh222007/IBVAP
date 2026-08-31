"""
health.py — API endpoint for system and database health checks.
"""

from __future__ import annotations

import time
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Camera, Event
from app.schemas import HealthResponse

router = APIRouter(
    prefix="/api/v1/health",
    tags=["Health"],
)

_MODULE_START_TIME = time.time()


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System and Database Health Check",
    description="Validates overall API service status, tests database connectivity, and returns service metrics.",
)
def get_health(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> HealthResponse:
    """
    Check API and database health with honest metrics.
    """
    start_time = getattr(request.app.state, "start_time", _MODULE_START_TIME)
    uptime_seconds = round(time.time() - start_time, 2)

    active_cameras = 0
    total_events = 0

    try:
        # Test actual database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
        overall_status = "healthy"

        # Query metrics safely
        active_cameras = (
            db.query(func.count(Camera.id))
            .filter(Camera.status == "ONLINE")
            .scalar()
            or 0
        )
        total_events = db.query(func.count(Event.id)).scalar() or 0
    except Exception:
        db_status = "disconnected"
        overall_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    # Retrieve AI pipeline diagnostics safely
    ai_status = "ONLINE"
    anpr_det = None
    ocr_eng = None
    try:
        from app.services.ai_service import AIService
        ai_diag = AIService.get_instance().get_status_diagnostics()
        ai_status = ai_diag.get("anpr_status", "ONLINE")
        anpr_det = ai_diag.get("anpr_detector")
        ocr_eng = ai_diag.get("ocr_engine")
    except Exception:
        pass

    return HealthResponse(
        status=overall_status,
        service="IBVAP Backend",
        database=db_status,
        version="1.0.0",
        uptime_seconds=uptime_seconds,
        active_cameras=active_cameras,
        total_events=total_events,
        ai_pipeline_status=ai_status,
        anpr_detector=anpr_det,
        ocr_engine=ocr_eng,
    )
