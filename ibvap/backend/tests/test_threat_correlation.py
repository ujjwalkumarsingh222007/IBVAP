"""
test_threat_correlation.py — Unit and integration tests for Phase 3D Event Correlation & Threat Intelligence.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Event, Threat, ThreatEventRelation
from app.schemas import ThreatSeverity, ThreatStatus
from app.services.threat_correlation_service import ThreatCorrelationService


@pytest.fixture(name="db_session")
def fixture_db_session():
    """In-memory SQLite session for testing correlation service."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def reset_service():
    """Reset singleton state before each test."""
    service = ThreatCorrelationService.get_instance()
    service.reset_state()
    service.window_seconds = 10.0
    service.cooldown_seconds = 10.0
    yield
    service.reset_state()


def test_same_camera_event_correlation_within_window(db_session):
    """Person detection and Vehicle detection on the same camera correlate into a MEDIUM threat."""
    service = ThreatCorrelationService.get_instance()
    now_iso = datetime.now(timezone.utc).isoformat()

    ev1 = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "PERSON_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.92,
        "metadata": {"track_id": 7, "class_name": "person"},
    }
    ev2 = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.88,
        "metadata": {"track_id": 12, "class_name": "car"},
    }

    # Buffer first event
    threat1 = service.correlate_frame_events([ev1], camera_id="CAM-TOWER-04", db=db_session)
    # Standalone person is LOW -> no persistent threat entity
    assert threat1 is None

    # Ingest second event on same camera within window
    threat2 = service.correlate_frame_events([ev2], camera_id="CAM-TOWER-04", db=db_session)
    assert threat2 is not None
    assert threat2.camera_id == "CAM-TOWER-04"
    assert threat2.severity == ThreatSeverity.MEDIUM.value
    assert "Correlated Person & Vehicle Activity" in threat2.title
    assert threat2.score >= 50.0
    assert threat2.event_count == 2


def test_different_camera_events_do_not_correlate(db_session):
    """Events on different cameras must NOT correlate with each other."""
    service = ThreatCorrelationService.get_instance()
    now_iso = datetime.now(timezone.utc).isoformat()

    ev1 = {
        "camera_id": "CAM-GATE-01",
        "event_type": "PERSON_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.90,
        "metadata": {"track_id": 1},
    }
    ev2 = {
        "camera_id": "CAM-TOWER-02",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.90,
        "metadata": {"track_id": 2},
    }

    # Person on CAM-GATE-01
    t1 = service.correlate_frame_events([ev1], camera_id="CAM-GATE-01", db=db_session)
    assert t1 is None

    # Vehicle on CAM-TOWER-02
    t2 = service.correlate_frame_events([ev2], camera_id="CAM-TOWER-02", db=db_session)
    # Standalone vehicle is MEDIUM on its own camera
    assert t2 is not None
    assert t2.camera_id == "CAM-TOWER-02"
    assert t2.event_count == 1
    # Ensure CAM-GATE-01's person was not included
    assert "PERSON_DETECTED" not in t2.threat_metadata.get("correlated_types", [])


def test_correlation_window_expiry(db_session):
    """Events occurring further apart than the correlation window are not correlated together."""
    service = ThreatCorrelationService.get_instance()
    service.window_seconds = 2.0  # 2 second window

    past_time = (datetime.now(timezone.utc) - timedelta(seconds=15)).isoformat()
    now_time = datetime.now(timezone.utc).isoformat()

    ev1 = {
        "camera_id": "CAM-01",
        "event_type": "PERSON_DETECTED",
        "timestamp": past_time,
        "confidence": 0.95,
        "metadata": {"track_id": 3},
    }
    ev2 = {
        "camera_id": "CAM-01",
        "event_type": "VEHICLE_DETECTED",
        "timestamp": now_time,
        "confidence": 0.95,
        "metadata": {"track_id": 4},
    }

    service.correlate_frame_events([ev1], camera_id="CAM-01", db=db_session)
    threat = service.correlate_frame_events([ev2], camera_id="CAM-01", db=db_session)

    # Past event was pruned; only ev2 is present
    assert threat is not None
    assert threat.event_count == 1
    assert "PERSON_DETECTED" not in threat.threat_metadata.get("correlated_types", [])


def test_watchlist_match_escalates_to_critical_threat(db_session):
    """Watchlist match combined with active person/vehicle tracking escalates to CRITICAL."""
    service = ThreatCorrelationService.get_instance()
    now_iso = datetime.now(timezone.utc).isoformat()

    ev_person = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "PERSON_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.90,
        "metadata": {"track_id": 5},
    }
    ev_watchlist = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "WATCHLIST_MATCH",
        "timestamp": now_iso,
        "confidence": 0.95,
        "metadata": {
            "plate_number": "TN09AB1234",
            "watchlist_status": "STOLEN",
            "watchlist_match": True,
        },
    }

    service.correlate_frame_events([ev_person], camera_id="CAM-TOWER-04", db=db_session)
    threat = service.correlate_frame_events([ev_watchlist], camera_id="CAM-TOWER-04", db=db_session)

    assert threat is not None
    assert threat.severity == ThreatSeverity.CRITICAL.value
    assert threat.score >= 90.0
    assert "TN09AB1234" in threat.title
    assert "Watchlisted vehicle detected during active camera activity" in threat.reason
    assert "TN09AB1234" in threat.threat_metadata["plates"]


def test_watchlist_plus_intrusion_maximum_threat_score(db_session):
    """Watchlist vehicle detected alongside perimeter intrusion yields maximum threat level."""
    service = ThreatCorrelationService.get_instance()
    now_iso = datetime.now(timezone.utc).isoformat()

    ev_intrusion = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.96,
        "metadata": {"fence_zone": "North Buffer Zone"},
    }
    ev_watchlist = {
        "camera_id": "CAM-TOWER-04",
        "event_type": "WATCHLIST_MATCH",
        "timestamp": now_iso,
        "confidence": 0.98,
        "metadata": {"plate_number": "TN09AB1234", "watchlist_match": True},
    }

    threat = service.correlate_frame_events([ev_intrusion, ev_watchlist], camera_id="CAM-TOWER-04", db=db_session)

    assert threat is not None
    assert threat.severity == ThreatSeverity.CRITICAL.value
    assert threat.score >= 98.0
    assert "Critical Watchlist Target & Perimeter Intrusion" in threat.title
    assert "alongside perimeter intrusion" in threat.reason


def test_intrusion_plus_anpr_correlation(db_session):
    """Perimeter intrusion correlated with vehicle / ANPR detection produces HIGH threat."""
    service = ThreatCorrelationService.get_instance()
    now_iso = datetime.now(timezone.utc).isoformat()

    ev_intrusion = {
        "camera_id": "CAM-NORTH-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.89,
        "metadata": {"track_id": 9},
    }
    ev_anpr = {
        "camera_id": "CAM-NORTH-01",
        "event_type": "ANPR_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.85,
        "metadata": {"plate_number": "HR98AA0000", "watchlist_match": False},
    }

    threat = service.correlate_frame_events([ev_intrusion, ev_anpr], camera_id="CAM-NORTH-01", db=db_session)

    assert threat is not None
    assert threat.severity == ThreatSeverity.HIGH.value
    assert threat.score >= 85.0
    assert "Correlated Intrusion & Vehicle Presence" in threat.title
    assert "Perimeter intrusion correlated with vehicle presence" in threat.reason


def test_duplicate_threat_suppression_and_update(db_session):
    """Consecutive frames within cooldown update the existing active threat rather than duplicating rows."""
    service = ThreatCorrelationService.get_instance()
    service.cooldown_seconds = 10.0
    now_iso = datetime.now(timezone.utc).isoformat()

    ev = {
        "camera_id": "CAM-01",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": now_iso,
        "confidence": 0.90,
        "metadata": {"track_id": 1},
    }

    # Frame 1: creates threat
    t1 = service.correlate_frame_events([ev], camera_id="CAM-01", db=db_session)
    assert t1 is not None
    initial_id = t1.id

    # Frame 2: 100ms later with same event type
    t2 = service.correlate_frame_events([ev], camera_id="CAM-01", db=db_session)
    assert t2 is not None
    assert t2.id == initial_id  # Reused same threat entity!

    # Check database row count
    threat_count = db_session.query(Threat).count()
    assert threat_count == 1


def test_timeline_chronological_ordering(db_session):
    """Threat timeline items are ordered chronologically by timestamp."""
    # Create persistent events in database
    t1_iso = "2026-08-29T10:15:20.000000+00:00"
    t2_iso = "2026-08-29T10:15:22.000000+00:00"
    t3_iso = "2026-08-29T10:15:24.000000+00:00"

    e1 = Event(camera_id="CAM-01", event_type="PERSON_DETECTED", timestamp=t1_iso, confidence=0.9, event_metadata={"track_id": 1})
    e2 = Event(camera_id="CAM-01", event_type="VEHICLE_DETECTED", timestamp=t2_iso, confidence=0.88, event_metadata={"track_id": 2})
    e3 = Event(camera_id="CAM-01", event_type="WATCHLIST_MATCH", timestamp=t3_iso, confidence=0.95, event_metadata={"plate_number": "TN09AB1234", "watchlist_status": "STOLEN"})
    db_session.add_all([e1, e2, e3])
    db_session.flush()

    threat = Threat(
        threat_id="THR-CAM-01-TEST1",
        camera_id="CAM-01",
        severity=ThreatSeverity.CRITICAL.value,
        score=95.0,
        title="Watchlist Vehicle Activity",
        reason="Watchlisted vehicle detected during active camera activity",
        status=ThreatStatus.ACTIVE.value,
        first_event_time=t1_iso,
        last_event_time=t3_iso,
        event_count=3,
        threat_metadata={},
    )
    db_session.add(threat)
    db_session.flush()

    # Link relations (intentionally added out of order)
    r3 = ThreatEventRelation(threat_id=threat.id, event_id=e3.id)
    r1 = ThreatEventRelation(threat_id=threat.id, event_id=e1.id)
    r2 = ThreatEventRelation(threat_id=threat.id, event_id=e2.id)
    db_session.add_all([r3, r1, r2])
    db_session.commit()

    timeline = ThreatCorrelationService.build_timeline(threat, db_session)
    assert len(timeline) == 3
    assert timeline[0]["event_type"] == "PERSON_DETECTED"
    assert timeline[1]["event_type"] == "VEHICLE_DETECTED"
    assert timeline[2]["event_type"] == "WATCHLIST_MATCH"
    assert timeline[0]["timestamp"] < timeline[1]["timestamp"] < timeline[2]["timestamp"]
