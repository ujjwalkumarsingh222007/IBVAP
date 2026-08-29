"""
analytics.py — Operational analytics and event intelligence API endpoints for IBVAP.
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    AnalyticsCamerasResponse,
    AnalyticsDistributionResponse,
    AnalyticsSummaryResponse,
    AnalyticsTrendsResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["Analytics & Intelligence"],
)


@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated operational intelligence summary",
    description="Returns high-level surveillance metrics, threat breakdown by severity, and confidence statistics.",
)
def get_analytics_summary(
    start_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 start timestamp filter (e.g. 2026-08-28T00:00:00Z).",
    ),
    end_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 end timestamp filter (e.g. 2026-08-29T23:59:59Z).",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Filter events originating from a specific camera ID.",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter by event category (e.g. INTRUSION_DETECTED, WATCHLIST_MATCH).",
    ),
    db: Session = Depends(get_db),
) -> AnalyticsSummaryResponse:
    """
    Retrieve operational metrics summary using database-level aggregation.
    """
    return AnalyticsService.get_summary(
        db=db,
        start_time=start_time,
        end_time=end_time,
        camera_id=camera_id,
        event_type=event_type,
    )


@router.get(
    "/trends",
    response_model=AnalyticsTrendsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get time-series event and threat trends",
    description="Returns chronological trend buckets aggregated by hourly or daily granularity.",
)
def get_analytics_trends(
    start_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 start timestamp filter.",
    ),
    end_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 end timestamp filter.",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Filter trends for a specific camera ID.",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter trends by specific event category.",
    ),
    interval: str = Query(
        default="hourly",
        pattern="^(hourly|daily)$",
        description="Time bucket granularity: 'hourly' or 'daily'.",
    ),
    db: Session = Depends(get_db),
) -> AnalyticsTrendsResponse:
    """
    Retrieve time-series trend analysis using SQL grouping.
    """
    return AnalyticsService.get_trends(
        db=db,
        start_time=start_time,
        end_time=end_time,
        camera_id=camera_id,
        event_type=event_type,
        interval=interval,
    )


@router.get(
    "/distribution",
    response_model=AnalyticsDistributionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get event type and threat severity distribution",
    description="Returns event counts and percentage breakdown across categories and severity levels.",
)
def get_analytics_distribution(
    start_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 start timestamp filter.",
    ),
    end_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 end timestamp filter.",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Filter distribution for a specific camera ID.",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter distribution for a specific event category.",
    ),
    db: Session = Depends(get_db),
) -> AnalyticsDistributionResponse:
    """
    Retrieve event type distribution and threat severity breakdown.
    """
    return AnalyticsService.get_distribution(
        db=db,
        start_time=start_time,
        end_time=end_time,
        camera_id=camera_id,
        event_type=event_type,
    )


@router.get(
    "/cameras",
    response_model=AnalyticsCamerasResponse,
    status_code=status.HTTP_200_OK,
    summary="Get camera activity and threat density ranking",
    description="Returns cameras ordered by threat density and total surveillance event volume.",
)
def get_analytics_cameras(
    start_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 start timestamp filter.",
    ),
    end_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 end timestamp filter.",
    ),
    camera_id: Optional[str] = Query(
        default=None,
        description="Target camera ID inspection.",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter camera rankings by event category.",
    ),
    db: Session = Depends(get_db),
) -> AnalyticsCamerasResponse:
    """
    Retrieve ranked camera surveillance activity and threat density.
    """
    return AnalyticsService.get_camera_ranking(
        db=db,
        start_time=start_time,
        end_time=end_time,
        camera_id=camera_id,
        event_type=event_type,
    )
