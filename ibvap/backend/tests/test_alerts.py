from datetime import datetime, timezone


def test_acknowledge_and_resolve_alert(client):
    """Test full alert lifecycle: NEW -> ACKNOWLEDGED -> RESOLVED."""
    payload = {
        "camera_id": "CAM-FENCE-02",
        "event_type": "INTRUSION_DETECTED",
        "timestamp": "2026-08-28T17:00:00",
        "confidence": 0.98
    }
    client.post("/api/v1/events", json=payload)

    alerts_res = client.get("/api/v1/alerts")
    alert_id = alerts_res.json()["items"][0]["id"]
    assert alerts_res.json()["items"][0]["status"] == "NEW"

    # Acknowledge alert
    ack_res = client.post(f"/api/v1/alerts/{alert_id}/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # Resolve alert
    res_res = client.post(f"/api/v1/alerts/{alert_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"


def test_invalid_alert_state_transitions(client):
    """Test that invalid alert state transitions return 400 Bad Request."""
    payload = {
        "camera_id": "CAM-FENCE-03",
        "event_type": "WATCHLIST_MATCH",
        "timestamp": "2026-08-28T17:30:00",
        "confidence": 0.95
    }
    client.post("/api/v1/events", json=payload)

    alerts_res = client.get("/api/v1/alerts")
    alert_id = alerts_res.json()["items"][0]["id"]

    # Resolve first
    client.post(f"/api/v1/alerts/{alert_id}/resolve")

    # Trying to acknowledge a RESOLVED alert must fail with 400
    ack_fail = client.post(f"/api/v1/alerts/{alert_id}/acknowledge")
    assert ack_fail.status_code == 400

    # Trying to resolve an ALREADY RESOLVED alert must fail with 400
    res_fail = client.post(f"/api/v1/alerts/{alert_id}/resolve")
    assert res_fail.status_code == 400


def test_alert_not_found(client):
    """Test acknowledge or resolve on nonexistent alert returns 404 Not Found."""
    assert client.post("/api/v1/alerts/99999/acknowledge").status_code == 404
    assert client.post("/api/v1/alerts/99999/resolve").status_code == 404


def test_event_deletion_preserves_alert_audit_trail(db_session):
    """Test that deleting an Event does NOT delete its associated Alert."""
    from app.models.event import Event
    from app.models.alert import Alert

    event = Event(
        camera_id="CAM-AUDIT-01",
        event_type="INTRUSION_DETECTED",
        timestamp=datetime.now(timezone.utc),
        confidence=0.99,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    alert = Alert(
        event_id=event.id,
        alert_type="INTRUSION_ALERT",
        message="Intrusion on CAM-AUDIT-01",
        severity="HIGH",
        status="NEW"
    )
    db_session.add(alert)
    db_session.commit()
    alert_id = alert.id

    # Delete the underlying Event
    db_session.delete(event)
    db_session.commit()
    db_session.expire_all()

    # Verify Alert still exists in database for audit trail
    persisted_alert = db_session.query(Alert).filter(Alert.id == alert_id).first()
    assert persisted_alert is not None
