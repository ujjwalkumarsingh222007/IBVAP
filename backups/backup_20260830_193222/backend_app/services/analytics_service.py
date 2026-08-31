"""
analytics_service.py — Production-grade operational analytics and event intelligence service.

Performs SQL-level aggregations, time-range filtering, and threat matrix calculations
without loading all raw events into Python memory.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Camera, Event
from app.schemas import (
    AnalyticsCamerasResponse,
    AnalyticsDistributionResponse,
    AnalyticsSummaryResponse,
    AnalyticsTrendsResponse,
    CameraActivityRanking,
    ConfidenceStats,
    EventType,
    EventTypeDistributionItem,
    ThreatCounts,
    TrendBucket,
)


class AnalyticsService:
    """Service encapsulating database analytics, aggregation queries, and threat modeling."""

    @staticmethod
    def validate_time_range(
        start_time: Optional[str],
        end_time: Optional[str],
    ) -> None:
        """
        Validate that start_time does not exceed end_time.
        Raises HTTP 400 Bad Request if the date range is reversed or malformed.
        """
        if start_time and end_time:
            # ISO-8601 string comparison is lexicographically valid
            clean_start = start_time.strip()
            clean_end = end_time.strip()
            if clean_start > clean_end:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid time range: start_time cannot be after end_time",
                )

    @classmethod
    def _apply_filters(
        cls,
        query,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ):
        """Apply standard analytics query filters to an Event SQLAlchemy query."""
        if start_time:
            query = query.filter(Event.timestamp >= start_time.strip())
        if end_time:
            query = query.filter(Event.timestamp <= end_time.strip())
        if camera_id:
            query = query.filter(Event.camera_id == camera_id.strip())
        if event_type and event_type != "ALL":
            query = query.filter(Event.event_type == event_type.strip())
        return query

    @classmethod
    def get_summary(
        cls,
        db: Session,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> AnalyticsSummaryResponse:
        """Compute high-level operational metrics using database aggregations."""
        cls.validate_time_range(start_time, end_time)

        # 1. Base counts and confidence statistics via SQL
        base_query = db.query(
            func.count(Event.id).label("total"),
            func.avg(Event.confidence).label("avg_conf"),
            func.min(Event.confidence).label("min_conf"),
            func.max(Event.confidence).label("max_conf"),
        )
        base_query = cls._apply_filters(base_query, start_time, end_time, camera_id, event_type)
        stats_row = base_query.first()

        total_events = stats_row.total if stats_row and stats_row.total is not None else 0
        avg_conf = round(float(stats_row.avg_conf), 4) if stats_row and stats_row.avg_conf is not None else 0.0
        min_conf = round(float(stats_row.min_conf), 4) if stats_row and stats_row.min_conf is not None else 0.0
        max_conf = round(float(stats_row.max_conf), 4) if stats_row and stats_row.max_conf is not None else 0.0

        # 2. Event type breakdown via SQL GROUP BY
        type_query = db.query(
            Event.event_type,
            func.count(Event.id).label("count"),
        ).group_by(Event.event_type)
        type_query = cls._apply_filters(type_query, start_time, end_time, camera_id, event_type)
        type_counts = dict(type_query.all())

        # 3. Compute threat severity matrix
        critical_count = type_counts.get(EventType.WATCHLIST_MATCH.value, 0)
        high_count = (
            type_counts.get(EventType.INTRUSION_DETECTED.value, 0)
            + type_counts.get(EventType.SUSPICIOUS_ACTIVITY.value, 0)
        )
        medium_count = type_counts.get(EventType.VEHICLE_DETECTED.value, 0)
        low_count = (
            type_counts.get(EventType.PERSON_DETECTED.value, 0)
            + type_counts.get(EventType.OBJECT_DETECTED.value, 0)
            + type_counts.get(EventType.ANPR_DETECTED.value, 0)
        )
        total_threats = critical_count + high_count + medium_count

        return AnalyticsSummaryResponse(
            total_events=total_events,
            threats=ThreatCounts(
                total_threats=total_threats,
                critical=critical_count,
                high=high_count,
                medium=medium_count,
                low=low_count,
            ),
            confidence_stats=ConfidenceStats(
                avg_confidence=avg_conf,
                min_confidence=min_conf,
                max_confidence=max_conf,
            ),
            event_type_counts=type_counts,
            time_range={
                "start_time": start_time,
                "end_time": end_time,
            },
        )

    @classmethod
    def get_trends(
        cls,
        db: Session,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
        interval: str = "hourly",
    ) -> AnalyticsTrendsResponse:
        """
        Generate time-series event and threat trend buckets using SQL grouping.
        """
        cls.validate_time_range(start_time, end_time)

        # Use SQLite substr expression for fast, timezone-safe ISO string grouping
        if interval.lower() == "daily":
            bucket_expr = func.substr(Event.timestamp, 1, 10).label("bucket_time")  # YYYY-MM-DD
        else:
            # Default to hourly: YYYY-MM-DDTHH -> transformed to display
            bucket_expr = func.substr(Event.timestamp, 1, 13).label("bucket_time")

        query = db.query(
            bucket_expr,
            Event.event_type,
            func.count(Event.id).label("count"),
            func.avg(Event.confidence).label("avg_conf"),
        ).group_by(bucket_expr, Event.event_type).order_by(bucket_expr.asc())

        query = cls._apply_filters(query, start_time, end_time, camera_id, event_type)
        rows = query.all()

        # Consolidate SQL rows into chronological trend buckets
        buckets_map: Dict[str, Dict] = {}
        for row in rows:
            raw_bucket = row.bucket_time or "Unknown"
            # Format bucket label for human readability
            formatted_bucket = raw_bucket.replace("T", " ")
            if len(formatted_bucket) == 13:
                formatted_bucket += ":00"

            if formatted_bucket not in buckets_map:
                buckets_map[formatted_bucket] = {
                    "bucket": formatted_bucket,
                    "total_events": 0,
                    "intrusions": 0,
                    "watchlist_matches": 0,
                    "suspicious_activity": 0,
                    "vehicles": 0,
                    "persons": 0,
                    "conf_sum": 0.0,
                    "conf_count": 0,
                }

            b = buckets_map[formatted_bucket]
            count = row.count
            ev_type = row.event_type

            b["total_events"] += count
            if row.avg_conf is not None:
                b["conf_sum"] += row.avg_conf * count
                b["conf_count"] += count

            if ev_type == EventType.INTRUSION_DETECTED.value:
                b["intrusions"] += count
            elif ev_type == EventType.WATCHLIST_MATCH.value:
                b["watchlist_matches"] += count
            elif ev_type == EventType.SUSPICIOUS_ACTIVITY.value:
                b["suspicious_activity"] += count
            elif ev_type == EventType.VEHICLE_DETECTED.value:
                b["vehicles"] += count
            elif ev_type == EventType.PERSON_DETECTED.value:
                b["persons"] += count

        trend_list: List[TrendBucket] = []
        for b_key in sorted(buckets_map.keys()):
            item = buckets_map[b_key]
            total_threats = item["watchlist_matches"] + item["intrusions"] + item["suspicious_activity"] + item["vehicles"]
            avg_conf = round(item["conf_sum"] / item["conf_count"], 4) if item["conf_count"] > 0 else 0.0

            trend_list.append(
                TrendBucket(
                    bucket=item["bucket"],
                    total_events=item["total_events"],
                    intrusions=item["intrusions"],
                    watchlist_matches=item["watchlist_matches"],
                    suspicious_activity=item["suspicious_activity"],
                    vehicles=item["vehicles"],
                    persons=item["persons"],
                    total_threats=total_threats,
                    avg_confidence=avg_conf,
                )
            )

        return AnalyticsTrendsResponse(
            interval=interval,
            trends=trend_list,
        )

    @classmethod
    def get_distribution(
        cls,
        db: Session,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> AnalyticsDistributionResponse:
        """Compute percentage distribution across event categories and threat levels."""
        cls.validate_time_range(start_time, end_time)

        # 1. Total events count
        total_query = db.query(func.count(Event.id))
        total_query = cls._apply_filters(total_query, start_time, end_time, camera_id, event_type)
        total_events = total_query.scalar() or 0

        # 2. Counts per event_type
        type_query = db.query(
            Event.event_type,
            func.count(Event.id).label("count"),
        ).group_by(Event.event_type).order_by(func.count(Event.id).desc())
        type_query = cls._apply_filters(type_query, start_time, end_time, camera_id, event_type)
        type_rows = type_query.all()

        distribution: List[EventTypeDistributionItem] = []
        type_counts: Dict[str, int] = {}

        for row in type_rows:
            ev_type = row.event_type
            count = row.count
            type_counts[ev_type] = count
            pct = round((count / total_events) * 100, 2) if total_events > 0 else 0.0
            distribution.append(
                EventTypeDistributionItem(
                    event_type=ev_type,
                    count=count,
                    percentage=pct,
                )
            )

        critical_count = type_counts.get(EventType.WATCHLIST_MATCH.value, 0)
        high_count = (
            type_counts.get(EventType.INTRUSION_DETECTED.value, 0)
            + type_counts.get(EventType.SUSPICIOUS_ACTIVITY.value, 0)
        )
        medium_count = type_counts.get(EventType.VEHICLE_DETECTED.value, 0)
        low_count = (
            type_counts.get(EventType.PERSON_DETECTED.value, 0)
            + type_counts.get(EventType.OBJECT_DETECTED.value, 0)
            + type_counts.get(EventType.ANPR_DETECTED.value, 0)
        )

        return AnalyticsDistributionResponse(
            total_events=total_events,
            distribution=distribution,
            threat_breakdown=ThreatCounts(
                total_threats=critical_count + high_count + medium_count,
                critical=critical_count,
                high=high_count,
                medium=medium_count,
                low=low_count,
            ),
        )

    @classmethod
    def get_camera_ranking(
        cls,
        db: Session,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        camera_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> AnalyticsCamerasResponse:
        """
        Rank surveillance cameras by detection activity and threat density.
        """
        cls.validate_time_range(start_time, end_time)

        # 1. Fetch camera metadata dictionary
        all_cameras = db.query(Camera).all()
        cam_meta_map = {
            c.camera_id: {
                "name": c.name,
                "location": c.location,
                "status": c.status,
            }
            for c in all_cameras
        }

        # 2. Aggregate counts by camera_id and event_type via SQL
        query = db.query(
            Event.camera_id,
            Event.event_type,
            func.count(Event.id).label("count"),
            func.avg(Event.confidence).label("avg_conf"),
            func.max(Event.timestamp).label("last_time"),
        ).group_by(Event.camera_id, Event.event_type)

        query = cls._apply_filters(query, start_time, end_time, camera_id, event_type)
        rows = query.all()

        cam_stats: Dict[str, Dict] = {}

        for row in rows:
            cid = row.camera_id
            ev_type = row.event_type
            count = row.count

            if cid not in cam_stats:
                meta = cam_meta_map.get(cid, {})
                cam_stats[cid] = {
                    "camera_id": cid,
                    "camera_name": meta.get("name") or cid,
                    "location": meta.get("location") or "Unassigned Zone",
                    "status": meta.get("status") or "ONLINE",
                    "total_events": 0,
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "conf_sum": 0.0,
                    "conf_count": 0,
                    "last_time": row.last_time,
                }

            s = cam_stats[cid]
            s["total_events"] += count
            if row.avg_conf is not None:
                s["conf_sum"] += row.avg_conf * count
                s["conf_count"] += count

            if row.last_time and (s["last_time"] is None or row.last_time > s["last_time"]):
                s["last_time"] = row.last_time

            if ev_type == EventType.WATCHLIST_MATCH.value:
                s["critical"] += count
            elif ev_type in (EventType.INTRUSION_DETECTED.value, EventType.SUSPICIOUS_ACTIVITY.value):
                s["high"] += count
            elif ev_type == EventType.VEHICLE_DETECTED.value:
                s["medium"] += count

        # If a camera filter was specified and that camera has 0 events, include it
        if camera_id and camera_id not in cam_stats:
            meta = cam_meta_map.get(camera_id, {})
            cam_stats[camera_id] = {
                "camera_id": camera_id,
                "camera_name": meta.get("name") or camera_id,
                "location": meta.get("location") or "Unassigned Zone",
                "status": meta.get("status") or "ONLINE",
                "total_events": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "conf_sum": 0.0,
                "conf_count": 0,
                "last_time": None,
            }

        ranking_list: List[CameraActivityRanking] = []
        for cid, s in cam_stats.items():
            threat_count = s["critical"] + s["high"] + s["medium"]
            avg_conf = round(s["conf_sum"] / s["conf_count"], 4) if s["conf_count"] > 0 else 0.0

            ranking_list.append(
                CameraActivityRanking(
                    camera_id=cid,
                    camera_name=s["camera_name"],
                    location=s["location"],
                    status=s["status"],
                    total_events=s["total_events"],
                    threat_count=threat_count,
                    critical_threats=s["critical"],
                    high_threats=s["high"],
                    medium_threats=s["medium"],
                    avg_confidence=avg_conf,
                    last_event_time=s["last_time"],
                )
            )

        # Sort by threat count descending, then total events descending
        ranking_list.sort(key=lambda x: (x.threat_count, x.total_events), reverse=True)

        return AnalyticsCamerasResponse(cameras=ranking_list)
