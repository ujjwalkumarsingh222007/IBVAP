"""
threats.py — Threat Intelligence and Event Correlation REST API Router.

Provides endpoints for listing correlated threats, active threats, timeline inspection,
operational statistics, and threat lifecycle status updates.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Event, Threat, ThreatEventRelation
from app.schemas import (
    EventResponse,
    ThreatDetailResponse,
    ThreatResponse,
    ThreatSeverity,
    ThreatStatsResponse,
    ThreatStatus,
    ThreatStatusUpdate,
    ThreatTimelineItem,
)
from app.services.threat_correlation_service import ThreatCorrelationService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/threats",
    tags=["Threat Intelligence"],
)


@router.get(
    "",
    response_model=List[ThreatResponse],
    status_code=status.HTTP_200_OK,
    summary="List correlated threats",
    description="Retrieve correlated surveillance threats with optional filtering by camera, severity, status, and time range.",
)
def list_threats(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    severity: Optional[str] = Query(None, description="Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    threat_status: Optional[str] = Query(None, alias="status", description="Filter by lifecycle status (ACTIVE, ACKNOWLEDGED, RESOLVED)"),
    start_time: Optional[str] = Query(None, description="ISO-8601 start timestamp filter"),
    end_time: Optional[str] = Query(None, description="ISO-8601 end timestamp filter"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    db: Session = Depends(get_db),
) -> List[ThreatResponse]:
    query = db.query(Threat)

    if camera_id is not None and camera_id.strip():
        query = query.filter(Threat.camera_id == camera_id.strip())
    if severity is not None and severity.strip() and severity != "ALL":
        query = query.filter(Threat.severity == severity.strip().upper())
    if threat_status is not None and threat_status.strip() and threat_status != "ALL":
        query = query.filter(Threat.status == threat_status.strip().upper())
    if start_time is not None and start_time.strip():
        query = query.filter(Threat.last_event_time >= start_time.strip())
    if end_time is not None and end_time.strip():
        query = query.filter(Threat.first_event_time <= end_time.strip())

    threats = query.order_by(Threat.updated_at.desc(), Threat.score.desc()).offset(skip).limit(limit).all()
    return threats


@router.get(
    "/active",
    response_model=List[ThreatResponse],
    status_code=status.HTTP_200_OK,
    summary="List active high-priority threats",
    description="Retrieve currently ACTIVE correlated threats ordered by threat score.",
)
def get_active_threats(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of active threats"),
    db: Session = Depends(get_db),
) -> List[ThreatResponse]:
    query = db.query(Threat).filter(Threat.status == ThreatStatus.ACTIVE.value)
    if camera_id is not None and camera_id.strip():
        query = query.filter(Threat.camera_id == camera_id.strip())

    threats = query.order_by(Threat.score.desc(), Threat.updated_at.desc()).limit(limit).all()
    return threats


@router.get(
    "/stats",
    response_model=ThreatStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get threat statistics",
    description="Aggregated operational counts of threats by severity and lifecycle status.",
)
def get_threat_stats(db: Session = Depends(get_db)) -> ThreatStatsResponse:
    total = db.query(func.count(Threat.id)).scalar() or 0
    active = db.query(func.count(Threat.id)).filter(Threat.status == ThreatStatus.ACTIVE.value).scalar() or 0
    acknowledged = db.query(func.count(Threat.id)).filter(Threat.status == ThreatStatus.ACKNOWLEDGED.value).scalar() or 0
    resolved = db.query(func.count(Threat.id)).filter(Threat.status == ThreatStatus.RESOLVED.value).scalar() or 0

    critical = db.query(func.count(Threat.id)).filter(Threat.severity == ThreatSeverity.CRITICAL.value).scalar() or 0
    high = db.query(func.count(Threat.id)).filter(Threat.severity == ThreatSeverity.HIGH.value).scalar() or 0
    medium = db.query(func.count(Threat.id)).filter(Threat.severity == ThreatSeverity.MEDIUM.value).scalar() or 0
    low = db.query(func.count(Threat.id)).filter(Threat.severity == ThreatSeverity.LOW.value).scalar() or 0

    return ThreatStatsResponse(
        total_threats=total,
        active_threats=active,
        critical=critical,
        high=high,
        medium=medium,
        low=low,
        acknowledged=acknowledged,
        resolved=resolved,
    )


@router.get(
    "/{threat_id}",
    response_model=ThreatDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get threat details with correlated events",
    description="Retrieve a specific threat by tracking code or ID, including all contributing events and timeline.",
)
def get_threat_by_id(
    threat_id: str,
    db: Session = Depends(get_db),
) -> ThreatDetailResponse:
    threat = None
    if threat_id.isdigit():
        threat = db.query(Threat).filter(Threat.id == int(threat_id)).first()
    if threat is None:
        threat = db.query(Threat).filter(Threat.threat_id == threat_id).first()

    if threat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat '{threat_id}' not found",
        )

    # Fetch contributing events via ThreatEventRelation
    relations = db.query(ThreatEventRelation).filter(ThreatEventRelation.threat_id == threat.id).all()
    event_ids = [r.event_id for r in relations]
    events = db.query(Event).filter(Event.id.in_(event_ids)).all() if event_ids else []

    timeline_dicts = ThreatCorrelationService.build_timeline(threat, db)

    event_responses = [
        EventResponse(
            id=e.id,
            camera_id=e.camera_id,
            event_type=e.event_type,
            timestamp=e.timestamp,
            confidence=e.confidence,
            metadata=e.event_metadata or {},
            created_at=e.created_at,
        )
        for e in events
    ]

    timeline_items = [
        ThreatTimelineItem(
            id=item.get("id"),
            timestamp=item["timestamp"],
            event_type=item["event_type"],
            camera_id=item["camera_id"],
            description=item["description"],
            confidence=item["confidence"],
            metadata=item["metadata"],
        )
        for item in timeline_dicts
    ]

    return ThreatDetailResponse(
        id=threat.id,
        threat_id=threat.threat_id,
        camera_id=threat.camera_id,
        severity=threat.severity,
        score=threat.score,
        title=threat.title,
        reason=threat.reason,
        status=threat.status,
        first_event_time=threat.first_event_time,
        last_event_time=threat.last_event_time,
        event_count=threat.event_count,
        threat_metadata=threat.threat_metadata or {},
        created_at=threat.created_at,
        updated_at=threat.updated_at,
        events=event_responses,
        timeline=timeline_items,
    )


@router.get(
    "/{threat_id}/timeline",
    response_model=List[ThreatTimelineItem],
    status_code=status.HTTP_200_OK,
    summary="Get threat timeline",
    description="Retrieve the chronological sequence of events contributing to a specific threat.",
)
def get_threat_timeline(
    threat_id: str,
    db: Session = Depends(get_db),
) -> List[ThreatTimelineItem]:
    threat = None
    if threat_id.isdigit():
        threat = db.query(Threat).filter(Threat.id == int(threat_id)).first()
    if threat is None:
        threat = db.query(Threat).filter(Threat.threat_id == threat_id).first()

    if threat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat '{threat_id}' not found",
        )

    timeline_dicts = ThreatCorrelationService.build_timeline(threat, db)
    return [
        ThreatTimelineItem(
            id=item.get("id"),
            timestamp=item["timestamp"],
            event_type=item["event_type"],
            camera_id=item["camera_id"],
            description=item["description"],
            confidence=item["confidence"],
            metadata=item["metadata"],
        )
        for item in timeline_dicts
    ]


@router.patch(
    "/{threat_id}/status",
    response_model=ThreatResponse,
    status_code=status.HTTP_200_OK,
    summary="Update threat lifecycle status",
    description="Update the status of a threat (ACTIVE, ACKNOWLEDGED, RESOLVED).",
)
def update_threat_status(
    threat_id: str,
    update_in: ThreatStatusUpdate,
    db: Session = Depends(get_db),
) -> ThreatResponse:
    threat = None
    if threat_id.isdigit():
        threat = db.query(Threat).filter(Threat.id == int(threat_id)).first()
    if threat is None:
        threat = db.query(Threat).filter(Threat.threat_id == threat_id).first()

    if threat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat '{threat_id}' not found",
        )

    threat.status = update_in.status.value
    threat.updated_at = datetime.now(timezone.utc)

    if update_in.reason:
        meta = dict(threat.threat_metadata or {})
        meta["status_update_reason"] = update_in.reason
        threat.threat_metadata = meta

    db.commit()
    db.refresh(threat)
    return threat
