import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertPaginatedResponse

logger = logging.getLogger("ibvap.routes.alerts")

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get(
    "",
    response_model=AlertPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Alerts",
    description="Retrieve security alerts with status and severity filtering."
)
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (NEW, OPEN, ACKNOWLEDGED, RESOLVED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve list of security alerts with optional filtering and pagination."""
    try:
        query = db.query(Alert)
        if status_filter:
            query = query.filter(Alert.status == status_filter)
        if severity:
            query = query.filter(Alert.severity == severity)

        total = query.count()
        alerts = query.order_by(Alert.id.desc()).offset(skip).limit(limit).all()

        return AlertPaginatedResponse(
            items=alerts,
            total=total,
            skip=skip,
            limit=limit
        )
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching alerts: {err}")
        return AlertPaginatedResponse(items=[], total=0, skip=skip, limit=limit)


@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Acknowledge Alert",
    description="Transition alert status to ACKNOWLEDGED."
)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Acknowledge an alert (NEW or OPEN -> ACKNOWLEDGED)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found."
        )

    if alert.status in ("ACKNOWLEDGED", "RESOLVED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot acknowledge alert in status '{alert.status}'."
        )

    alert.status = "ACKNOWLEDGED"
    try:
        db.commit()
        db.refresh(alert)
        return alert
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error acknowledging alert {alert_id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while updating alert."
        )


@router.post(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve Alert",
    description="Transition alert status to RESOLVED."
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Resolve an alert (NEW, OPEN, or ACKNOWLEDGED -> RESOLVED)."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found."
        )

    if alert.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert is already in RESOLVED status."
        )

    alert.status = "RESOLVED"
    try:
        db.commit()
        db.refresh(alert)
        return alert
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error resolving alert {alert_id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while updating alert."
        )
