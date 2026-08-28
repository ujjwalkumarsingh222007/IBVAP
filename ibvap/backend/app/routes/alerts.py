import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse

logger = logging.getLogger("ibvap.routes.alerts")

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get(
    "",
    response_model=List[AlertResponse],
    status_code=status.HTTP_200_OK,
    summary="List Alerts",
    description="Retrieve generated security alerts."
)
def list_alerts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of security alerts."""
    try:
        alerts = db.query(Alert).order_by(Alert.id.desc()).offset(skip).limit(limit).all()
        return alerts
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching alerts: {err}")
        return []
