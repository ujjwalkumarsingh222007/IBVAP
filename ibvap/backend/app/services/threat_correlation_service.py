"""
threat_correlation_service.py — Unified Threat Intelligence & Event Correlation Engine.

Correlates Common Events emitted by Member 1 CV and Member 2 ANPR on the same camera
within a configurable time window, computes rule-based threat scores, assigns severity,
manages threat lifecycles, and maintains chronological event timelines.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import Event, Threat, ThreatEventRelation
from app.schemas import ThreatSeverity, ThreatStatus
from app.config import (
    THREAT_CORRELATION_WINDOW_SECONDS,
    THREAT_SUPPRESSION_COOLDOWN_SECONDS,
)

logger = logging.getLogger(__name__)


def _parse_iso_to_timestamp(ts_str: Optional[str]) -> float:
    """Parse ISO-8601 string or numeric string to epoch float."""
    if not ts_str:
        return datetime.now(timezone.utc).timestamp()
    try:
        clean = ts_str.strip()
        # Try ISO format
        if "T" in clean:
            dt = datetime.fromisoformat(clean.replace("Z", "+00:00"))
            return dt.timestamp()
        return float(clean)
    except Exception:
        return datetime.now(timezone.utc).timestamp()


class ThreatCorrelationService:
    """
    Singleton service that correlates surveillance events across temporal sliding windows
    and manages threat lifecycles.
    """

    _instance: Optional["ThreatCorrelationService"] = None

    def __init__(
        self,
        window_seconds: Optional[float] = None,
        cooldown_seconds: Optional[float] = None,
    ) -> None:
        self.window_seconds: float = (
            window_seconds
            if window_seconds is not None
            else THREAT_CORRELATION_WINDOW_SECONDS
        )
        self.cooldown_seconds: float = (
            cooldown_seconds
            if cooldown_seconds is not None
            else THREAT_SUPPRESSION_COOLDOWN_SECONDS
        )

        # In-memory sliding buffer: camera_id -> list of buffered event dicts
        self._camera_buffers: Dict[str, List[Dict[str, Any]]] = {}

        # Tracking last threat creation time per camera & title: (camera_id, title) -> (timestamp, threat_id)
        self._recent_threats: Dict[Tuple[str, str], Tuple[float, int]] = {}

    @classmethod
    def get_instance(cls) -> "ThreatCorrelationService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def reset_state(self) -> None:
        """Clear all in-memory buffers (useful between test runs)."""
        self._camera_buffers.clear()
        self._recent_threats.clear()

    def buffer_event(self, event_dict: Dict[str, Any]) -> None:
        """
        Buffer an incoming event into the in-memory camera sliding window and purge stale events.
        """
        camera_id = event_dict.get("camera_id")
        if not camera_id:
            return

        ts = _parse_iso_to_timestamp(event_dict.get("timestamp"))
        event_entry = dict(event_dict)
        event_entry["_epoch"] = ts

        buf = self._camera_buffers.setdefault(camera_id, [])
        buf.append(event_entry)

        # Purge events outside the correlation window relative to the latest event
        cutoff = ts - self.window_seconds
        self._camera_buffers[camera_id] = [e for e in buf if e.get("_epoch", 0) >= cutoff]

    def correlate_frame_events(
        self,
        frame_events: List[Dict[str, Any]],
        camera_id: str,
        db: Optional[Session] = None,
    ) -> Optional[Threat]:
        """
        Correlate events from a single frame ingestion alongside recent historical events on the same camera.
        Persists a new Threat or updates an active Threat if a meaningful correlation exists.
        """
        if not frame_events and not self._camera_buffers.get(camera_id):
            return None

        # 1. Buffer all new events
        for ev in frame_events:
            self.buffer_event(ev)

        # 2. Get active sliding window for this camera
        window_events = self._camera_buffers.get(camera_id, [])
        if not window_events:
            return None

        # 3. Evaluate threat rules and scoring
        threat_assessment = self._assess_threat(window_events, camera_id)
        if not threat_assessment:
            return None

        title, reason, severity, score, metadata = threat_assessment

        # Only form explicit Threat entities for MEDIUM, HIGH, or CRITICAL severity
        if severity == ThreatSeverity.LOW:
            return None

        # 4. Check for deduplication / update existing active threat
        if db is not None:
            return self._persist_or_update_threat(
                db=db,
                camera_id=camera_id,
                title=title,
                reason=reason,
                severity=severity,
                score=score,
                metadata=metadata,
                contributing_events=window_events,
            )

        return None

    def _assess_threat(
        self,
        events: List[Dict[str, Any]],
        camera_id: str,
    ) -> Optional[Tuple[str, str, ThreatSeverity, float, Dict[str, Any]]]:
        """
        Pure rule-based threat evaluation function.
        Returns: (title, reason, severity, score, metadata) or None.
        """
        types_present = set(e.get("event_type") for e in events if e.get("event_type"))
        if not types_present:
            return None

        has_flagged_person = "FLAGGED_PERSON" in types_present
        has_flagged_vehicle = "FLAGGED_VEHICLE" in types_present or "WATCHLIST_MATCH" in types_present
        has_watchlist = has_flagged_vehicle
        has_unknown_person = "UNKNOWN_PERSON" in types_present
        has_unknown_vehicle = "UNKNOWN_VEHICLE" in types_present
        has_intrusion = "INTRUSION_DETECTED" in types_present
        has_suspicious = "SUSPICIOUS_ACTIVITY" in types_present
        has_vehicle = "VEHICLE_DETECTED" in types_present or has_unknown_vehicle
        has_anpr = "ANPR_DETECTED" in types_present
        has_person = "PERSON_DETECTED" in types_present or has_unknown_person or has_flagged_person

        # Collect event metadata references
        plates: List[str] = []
        track_ids: List[int] = []
        confidences: List[float] = []
        flagged_names: List[str] = []

        for e in events:
            conf = float(e.get("confidence", 0.8))
            confidences.append(conf)
            meta = e.get("metadata") or {}
            if "plate_number" in meta and meta["plate_number"]:
                plates.append(str(meta["plate_number"]))
            if "track_id" in meta and meta["track_id"] is not None:
                track_ids.append(int(meta["track_id"]))
            if meta.get("person_name") and meta.get("person_name") != "Unknown":
                flagged_names.append(str(meta["person_name"]))

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.85
        unique_plates = list(set(plates))
        unique_tracks = list(set(track_ids))
        target_name = flagged_names[0] if flagged_names else ""

        base_meta = {
            "correlated_types": list(types_present),
            "event_count": len(events),
            "plates": unique_plates,
            "track_ids": unique_tracks,
            "mean_confidence": round(avg_conf, 4),
        }

        # Rule 0: Flagged Person (Critical Alert)
        if has_flagged_person:
            name_str = f" ({target_name})" if target_name else ""
            return (
                f"Flagged person found{name_str}",
                f"Flagged individual '{target_name or 'target'}' detected on camera",
                ThreatSeverity.CRITICAL,
                round(min(95.0 + (avg_conf * 4.0), 99.0), 2),
                base_meta,
            )

        # Rule 1: Watchlist Match + Intrusion (Extreme Critical)
        if has_watchlist and has_intrusion:
            plate_str = f" ({unique_plates[0]})" if unique_plates else ""
            return (
                f"Critical Watchlist Target & Perimeter Intrusion{plate_str}",
                "Watchlisted vehicle detected alongside perimeter intrusion",
                ThreatSeverity.CRITICAL,
                round(min(98.0 + (avg_conf * 2.0), 100.0), 2),
                base_meta,
            )

        # Rule 2: Watchlist Match + Person or Vehicle Activity (Critical)
        if has_watchlist and (has_person or has_vehicle or has_anpr):
            plate_str = f" ({unique_plates[0]})" if unique_plates else ""
            return (
                f"Flagged vehicle found{plate_str}",
                "Watchlisted vehicle detected during active camera activity",
                ThreatSeverity.CRITICAL,
                round(min(92.0 + (avg_conf * 4.0), 97.0), 2),
                base_meta,
            )

        # Rule 3: Standalone Watchlist Match (Critical)
        if has_watchlist:
            plate_str = f" ({unique_plates[0]})" if unique_plates else ""
            return (
                f"Flagged vehicle found{plate_str}",
                "Watchlisted vehicle detected on camera",
                ThreatSeverity.CRITICAL,
                round(88.0 + (avg_conf * 4.0), 2),
                base_meta,
            )

        # Rule 4: Perimeter Intrusion + Vehicle/ANPR (High Escalated)
        if has_intrusion and (has_vehicle or has_anpr):
            return (
                "Correlated Intrusion & Vehicle Presence",
                "Perimeter intrusion correlated with vehicle presence",
                ThreatSeverity.HIGH,
                round(min(86.0 + (avg_conf * 4.0), 92.0), 2),
                base_meta,
            )

        # Rule 5: Perimeter Intrusion + Person Tracking (High)
        if has_intrusion and has_person:
            return (
                "Perimeter Intrusion & Person Activity",
                "Perimeter breach detected with active person tracking",
                ThreatSeverity.HIGH,
                round(min(82.0 + (avg_conf * 4.0), 88.0), 2),
                base_meta,
            )

        # Rule 6: Standalone Perimeter Intrusion (High)
        if has_intrusion:
            return (
                "Perimeter Intrusion Detected",
                "Unauthorized movement across virtual perimeter line",
                ThreatSeverity.HIGH,
                round(75.0 + (avg_conf * 5.0), 2),
                base_meta,
            )

        # Rule 7: Suspicious Activity + Active Movement (High)
        if has_suspicious and (has_person or has_vehicle):
            return (
                "Suspicious Behavioral Movement",
                "Loitering or erratic motion pattern flagged alongside active subjects",
                ThreatSeverity.HIGH,
                round(min(72.0 + (avg_conf * 4.0), 78.0), 2),
                base_meta,
            )

        # Rule 8: Standalone Suspicious Activity (High)
        if has_suspicious:
            return (
                "Suspicious Activity Flagged",
                "Anomalous dwell time or behavior flagged by video analytics",
                ThreatSeverity.HIGH,
                round(68.0 + (avg_conf * 4.0), 2),
                base_meta,
            )

        # Rule 8b: Standalone Unknown Person (Medium Alert)
        if has_unknown_person:
            return (
                "Unknown person detected",
                "Unregistered individual detected in camera zone",
                ThreatSeverity.MEDIUM,
                round(60.0 + (avg_conf * 4.0), 2),
                base_meta,
            )

        # Rule 8c: Standalone Unknown Vehicle (Medium Alert)
        if has_unknown_vehicle:
            return (
                "Unknown vehicle detected",
                "Unregistered vehicle detected in camera zone",
                ThreatSeverity.MEDIUM,
                round(58.0 + (avg_conf * 4.0), 2),
                base_meta,
            )

        # Rule 9: Correlated Person + Vehicle Activity (Medium)
        if has_person and (has_vehicle or has_anpr):
            plate_info = f" [Plate: {unique_plates[0]}]" if unique_plates else ""
            return (
                f"Correlated Person & Vehicle Activity{plate_info}",
                "Correlated person and vehicle activity detected at same camera",
                ThreatSeverity.MEDIUM,
                round(min(56.0 + (avg_conf * 6.0), 65.0), 2),
                base_meta,
            )

        # Rule 10: Standalone Vehicle (Medium)
        if has_vehicle:
            return (
                "Vehicle Presence Detected",
                "Vehicle detected within camera perimeter zone",
                ThreatSeverity.MEDIUM,
                round(45.0 + (avg_conf * 5.0), 2),
                base_meta,
            )

        # Standard Baseline (Low)
        return (
            "Standard Surveillance Detection",
            "Routine baseline person or object detection",
            ThreatSeverity.LOW,
            round(20.0 + (avg_conf * 5.0), 2),
            base_meta,
        )

    def _persist_or_update_threat(
        self,
        db: Session,
        camera_id: str,
        title: str,
        reason: str,
        severity: ThreatSeverity,
        score: float,
        metadata: Dict[str, Any],
        contributing_events: List[Dict[str, Any]],
    ) -> Threat:
        """
        Inserts a new Threat record or updates an existing ACTIVE Threat on the camera within cooldown.
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        now_epoch = now.timestamp()

        # Check if there is an active threat in memory for this camera & title
        threat_key = (camera_id, title)
        last_info = self._recent_threats.get(threat_key)

        existing_threat: Optional[Threat] = None
        if last_info:
            last_ts, threat_db_id = last_info
            if (now_epoch - last_ts) <= self.cooldown_seconds:
                existing_threat = db.query(Threat).filter(Threat.id == threat_db_id).first()

        if existing_threat is not None and existing_threat.status == "ACTIVE":
            # Update existing threat
            existing_threat.last_event_time = now_iso
            existing_threat.event_count = len(contributing_events)
            existing_threat.score = max(existing_threat.score, score)
            existing_threat.updated_at = now
            existing_threat.threat_metadata = metadata
            db.add(existing_threat)
            db.flush()

            self._recent_threats[threat_key] = (now_epoch, existing_threat.id)
            self._link_events_to_threat(db, existing_threat.id, contributing_events)
            return existing_threat

        # Create new Threat record
        threat_id_str = f"THR-{camera_id}-{uuid.uuid4().hex[:8].upper()}"
        first_time = contributing_events[0].get("timestamp", now_iso) if contributing_events else now_iso

        new_threat = Threat(
            threat_id=threat_id_str,
            camera_id=camera_id,
            severity=severity.value if hasattr(severity, "value") else str(severity),
            score=score,
            title=title,
            reason=reason,
            status=ThreatStatus.ACTIVE.value,
            first_event_time=first_time,
            last_event_time=now_iso,
            event_count=len(contributing_events),
            threat_metadata=metadata,
            created_at=now,
            updated_at=now,
        )
        db.add(new_threat)
        db.flush()

        self._recent_threats[threat_key] = (now_epoch, new_threat.id)
        self._link_events_to_threat(db, new_threat.id, contributing_events)
        return new_threat

    def _link_events_to_threat(
        self,
        db: Session,
        threat_id: int,
        contributing_events: List[Dict[str, Any]],
    ) -> None:
        """
        Associate database Event records with the Threat via ThreatEventRelation.
        """
        for ev in contributing_events:
            ev_id = ev.get("id")
            # If event was persisted in this session and has an id
            if ev_id:
                # Check if relation already exists
                exists = (
                    db.query(ThreatEventRelation)
                    .filter(
                        ThreatEventRelation.threat_id == threat_id,
                        ThreatEventRelation.event_id == ev_id,
                    )
                    .first()
                )
                if not exists:
                    rel = ThreatEventRelation(threat_id=threat_id, event_id=ev_id)
                    db.add(rel)
        db.flush()

    @staticmethod
    def build_timeline(threat: Threat, db: Session) -> List[Dict[str, Any]]:
        """
        Construct an ordered chronological timeline of all events contributing to a Threat.
        """
        relations = (
            db.query(ThreatEventRelation)
            .filter(ThreatEventRelation.threat_id == threat.id)
            .all()
        )
        event_ids = [r.event_id for r in relations]

        timeline_items: List[Dict[str, Any]] = []

        if event_ids:
            events = db.query(Event).filter(Event.id.in_(event_ids)).all()
            # Sort events chronologically
            events.sort(key=lambda e: e.timestamp or "")

            for ev in events:
                desc = ThreatCorrelationService._format_event_description(ev)
                timeline_items.append({
                    "id": ev.id,
                    "timestamp": ev.timestamp,
                    "event_type": ev.event_type,
                    "camera_id": ev.camera_id,
                    "description": desc,
                    "confidence": ev.confidence,
                    "metadata": ev.event_metadata or {},
                })

        return timeline_items

    @staticmethod
    def _format_event_description(ev: Event) -> str:
        """Generate human-readable description for an event in the threat timeline."""
        etype = ev.event_type
        meta = ev.event_metadata or {}

        if etype == "WATCHLIST_MATCH":
            plate = meta.get("plate_number", "Unknown")
            status = meta.get("watchlist_status", "WATCHLIST")
            return f"🚨 Watchlist Match: Vehicle {plate} flagged as {status}"
        elif etype == "ANPR_DETECTED":
            plate = meta.get("plate_number", "Unknown")
            return f"🚗 License Plate Detected: {plate}"
        elif etype == "INTRUSION_DETECTED":
            zone = meta.get("fence_zone", "Perimeter Zone")
            return f"⚠️ Perimeter Intrusion in {zone}"
        elif etype == "SUSPICIOUS_ACTIVITY":
            return "🔍 Suspicious activity detected by analytics"
        elif etype == "VEHICLE_DETECTED":
            tid = meta.get("track_id", "")
            return f"🚙 Vehicle detected (Track #{tid})" if tid else "🚙 Vehicle detected"
        elif etype == "PERSON_DETECTED":
            tid = meta.get("track_id", "")
            return f"👤 Person detected (Track #{tid})" if tid else "👤 Person detected"
        elif etype == "OBJECT_DETECTED":
            cls_name = meta.get("class_name", "object")
            return f"📦 Object detected: {cls_name}"
        return f"Event: {etype}"
