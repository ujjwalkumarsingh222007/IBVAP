import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistResponse

logger = logging.getLogger("ibvap.routes.watchlist")

router = APIRouter(prefix="/api/v1/watchlist", tags=["Watchlist"])


@router.get(
    "",
    response_model=List[WatchlistResponse],
    status_code=status.HTTP_200_OK,
    summary="List Watchlist",
    description="Retrieve vehicle watchlist entries."
)
def list_watchlist(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of vehicle watchlist entries."""
    try:
        items = db.query(Watchlist).offset(skip).limit(limit).all()
        return items
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching watchlist: {err}")
        return []
