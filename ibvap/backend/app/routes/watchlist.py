import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.database import get_db
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistCreate, WatchlistUpdate, WatchlistResponse, WatchlistPaginatedResponse

logger = logging.getLogger("ibvap.routes.watchlist")

router = APIRouter(prefix="/api/v1/watchlist", tags=["Watchlist"])


@router.get(
    "",
    response_model=WatchlistPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List Watchlist",
    description="Retrieve vehicle watchlist entries."
)
def list_watchlist(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ACTIVE/INACTIVE)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve list of vehicle watchlist entries with optional pagination."""
    try:
        query = db.query(Watchlist)
        if status_filter:
            query = query.filter(Watchlist.status == status_filter)

        total = query.count()
        items = query.order_by(Watchlist.id.desc()).offset(skip).limit(limit).all()

        return WatchlistPaginatedResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit
        )
    except SQLAlchemyError as err:
        logger.error(f"Database error while fetching watchlist: {err}")
        return WatchlistPaginatedResponse(items=[], total=0, skip=skip, limit=limit)


@router.post(
    "",
    response_model=WatchlistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Watchlist Item",
    description="Add a vehicle license plate to the watchlist."
)
def create_watchlist_item(
    item_in: WatchlistCreate,
    db: Session = Depends(get_db)
):
    """Create a new watchlist entry with duplicate plate validation."""
    existing = db.query(Watchlist).filter(Watchlist.plate_number == item_in.plate_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plate number '{item_in.plate_number}' already exists in watchlist."
        )

    db_item = Watchlist(
        plate_number=item_in.plate_number,
        description=item_in.description,
        status=item_in.status,
    )
    try:
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plate number '{item_in.plate_number}' already exists in watchlist."
        )
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error creating watchlist item: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while creating watchlist item."
        )


@router.put(
    "/{id}",
    response_model=WatchlistResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Watchlist Item",
    description="Update a watchlist item by ID."
)
def update_watchlist_item(
    id: int,
    item_in: WatchlistUpdate,
    db: Session = Depends(get_db)
):
    """Update a watchlist entry."""
    item = db.query(Watchlist).filter(Watchlist.id == id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {id} not found."
        )

    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error updating watchlist item {id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while updating watchlist item."
        )


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Watchlist Item",
    description="Remove a vehicle plate from the watchlist by ID."
)
def delete_watchlist_item(
    id: int,
    db: Session = Depends(get_db)
):
    """Delete a watchlist entry."""
    item = db.query(Watchlist).filter(Watchlist.id == id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item {id} not found."
        )

    try:
        db.delete(item)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except SQLAlchemyError as err:
        db.rollback()
        logger.error(f"Database error deleting watchlist item {id}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable while deleting watchlist item."
        )
