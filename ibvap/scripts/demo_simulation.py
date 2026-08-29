#!/usr/bin/env python3
"""
demo_simulation.py — IBVAP Live Demonstration & Event Simulation Engine (Phase 3C).

Enables judges, evaluators, and team members to simulate realistic surveillance
scenarios across all AI modules (Member 1 CV and Member 2 ANPR) without physical CCTV hardware.

Supported Event Categories:
  1. PERSON_DETECTED      (Member 1 CV: Pedestrian / Border Traveler)
  2. INTRUSION_DETECTED   (Member 1 CV: Perimeter Fence Breach)
  3. SUSPICIOUS_ACTIVITY  (Member 1 CV: Buffer Zone Loitering Anomaly)
  4. VEHICLE_DETECTED     (Member 1 CV / Member 2 ANPR: Checkpoint Vehicle)
  5. ANPR_DETECTED        (Member 2 ANPR: Standard License Plate Read)
  6. WATCHLIST_MATCH      (Member 2 ANPR: Stolen/Wanted Hotlist Vehicle Hit)
  7. OBJECT_DETECTED      (Member 1 CV: Abandoned Suspicious Object)

Key Capabilities:
  - Multi-camera realistic telemetry generation
  - Non-duplicate safe intervals
  - Demo data reset (--reset / --force)
  - Detailed CLI status with real HTTP response validation
"""

import sys
import time
import json
import random
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone

DEFAULT_BACKEND = "http://127.0.0.1:8000"

DEMO_CAMERAS = [
    {"camera_id": "CAM-BORDER-01", "name": "Sector 4 North Fence", "location": "North Perimeter Line", "status": "ONLINE"},
    {"camera_id": "CAM-BORDER-02", "name": "Sector 9 Virtual Fence", "location": "East Border Valley", "status": "ONLINE"},
    {"camera_id": "CAM-GATE-01", "name": "Main Vehicle Checkpoint", "location": "Highway 1 Entry Gate", "status": "ONLINE"},
    {"camera_id": "CAM-TOWER-04", "name": "Watchtower Thermal PTZ", "location": "Outpost Charlie", "status": "ONLINE"},
]

DEMO_EVENTS = [
    {
        "camera_id": "CAM-BORDER-01",
        "event_type": "PERSON_DETECTED",
        "confidence": 0.942,
        "metadata": {
            "track_id": 14,
            "class_name": "person",
            "bbox": [140, 80, 290, 430],
            "position": {"x": 215, "y": 255},
        },
    },
    {
        "camera_id": "CAM-BORDER-01",
        "event_type": "INTRUSION_DETECTED",
        "confidence": 0.968,
        "metadata": {
            "track_id": 14,
            "class_name": "person",
            "bbox": [180, 110, 310, 440],
            "position": {"x": 245, "y": 275},
            "fence_zone": "Sector 4 Alpha",
        },
    },
    {
        "camera_id": "CAM-GATE-01",
        "event_type": "VEHICLE_DETECTED",
        "confidence": 0.915,
        "metadata": {
            "track_id": 55,
            "class_name": "truck",
            "bbox": [50, 120, 450, 520],
            "position": {"x": 250, "y": 320},
        },
    },
    {
        "camera_id": "CAM-GATE-01",
        "event_type": "ANPR_DETECTED",
        "confidence": 0.938,
        "metadata": {
            "plate_number": "KA05MH9988",
            "raw_ocr_text": "KA 05 MH 9988",
            "plate_confidence": 0.95,
            "ocr_confidence": 0.92,
            "vehicle_id": "VEH-TRUCK-55",
            "watchlist_match": False,
            "validation_passed": True,
            "validation_reason": "Standard Indian Plate (KA)",
        },
    },
    {
        "camera_id": "CAM-GATE-01",
        "event_type": "WATCHLIST_MATCH",
        "confidence": 0.975,
        "metadata": {
            "plate_number": "MH12DE1433",
            "raw_ocr_text": "MH12DE1433",
            "plate_confidence": 0.98,
            "ocr_confidence": 0.96,
            "vehicle_id": "VEH-SEDAN-808",
            "watchlist_match": True,
            "watchlist_status": "STOLEN",
            "watchlist_reason": "Reported stolen in Pune - FIR #8821",
            "validation_passed": True,
            "validation_reason": "Standard Indian Plate (MH)",
        },
    },
    {
        "camera_id": "CAM-BORDER-02",
        "event_type": "SUSPICIOUS_ACTIVITY",
        "confidence": 0.884,
        "metadata": {
            "anomaly_type": "Prolonged Loitering Near Buffer Zone",
            "duration_seconds": 124,
            "track_id": 29,
        },
    },
    {
        "camera_id": "CAM-TOWER-04",
        "event_type": "OBJECT_DETECTED",
        "confidence": 0.862,
        "metadata": {
            "class_name": "abandoned_backpack",
            "bbox": [320, 200, 390, 280],
            "position": {"x": 355, "y": 240},
        },
    },
]


def post_json(url: str, payload: dict, timeout: float = 4.0) -> tuple:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "IBVAP-DemoSimulation/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)


def reset_demo_data(backend_url: str, force: bool = False) -> bool:
    """Safely reset demo surveillance events and reseed baseline cameras."""
    print("\n" + "=" * 70)
    print("  IBVAP — DEMO DATA MANAGEMENT RESET")
    print("=" * 70)

    if not force:
        print("  WARNING: This will clear surveillance events from the demo database")
        print("  and restore default camera nodes.")
        confirm = input("  Proceed with demo reset? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("  [CANCELLED] Reset operation aborted.")
            return False

    print(f"\n  Contacting {backend_url}/api/v1/demo/reset ...")
    status, body = post_json(f"{backend_url}/api/v1/demo/reset", {"confirm": True})

    if status == 200:
        res = json.loads(body)
        print(f"  [OK] Reset Successful (HTTP {status})")
        print(f"       Events Cleared:   {res.get('events_cleared', 0)}")
        print(f"       Cameras Restored: {res.get('cameras_restored', 0)}")
        print(f"       Message:          {res.get('message', 'Reset complete')}\n")
        return True
    else:
        print(f"  [ERROR] Demo reset failed (HTTP {status}): {body}\n")
        return False


def register_cameras(backend_url: str):
    print(f"\n[1] Synchronizing Border Cameras on {backend_url}/api/v1/cameras ...")
    for cam in DEMO_CAMERAS:
        status, body = post_json(f"{backend_url}/api/v1/cameras", cam)
        if status in (200, 201):
            print(f"  + Registered [{cam['camera_id']:14s}] {cam['name']} -> HTTP {status}")
        elif status == 409:
            print(f"  * Verified   [{cam['camera_id']:14s}] {cam['name']} -> Ready (HTTP 409)")
        else:
            print(f"  - Notice     [{cam['camera_id']:14s}] HTTP {status}: {body[:80]}")


def send_event(backend_url: str, event_data: dict) -> bool:
    payload = dict(event_data)
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    status, body = post_json(f"{backend_url}/api/v1/events", payload)

    meta = payload.get("metadata", {})
    summary_parts = []
    if "plate_number" in meta:
        summary_parts.append(f"Plate={meta['plate_number']}")
        if meta.get("watchlist_match"):
            summary_parts.append(f"HOTLIST:{meta.get('watchlist_status', 'WANTED')}")
    if "track_id" in meta:
        summary_parts.append(f"Track#{meta['track_id']}")
    if "fence_zone" in meta:
        summary_parts.append(f"Zone={meta['fence_zone']}")
    if "anomaly_type" in meta:
        summary_parts.append(f"Anomaly={meta['anomaly_type'][:20]}")

    meta_str = f" ({', '.join(summary_parts)})" if summary_parts else ""

    if status in (200, 201):
        res_json = json.loads(body)
        ev_id = res_json.get("id", "?")
        print(f"  -> [{payload['event_type']:19s}] {payload['camera_id']:14s} Conf: {payload['confidence']:.2f} -> Event #{ev_id:<3} (HTTP {status}){meta_str}")
        return True
    else:
        print(f"  x [{payload['event_type']:19s}] FAILED (HTTP {status}): {body}")
        return False


def run_demo(backend_url: str, mode: str, count: int = 1, interval: float = 0.8):
    print("=" * 75)
    print("  IBVAP — Intelligent Border Video Analytics Platform Command Center Demo")
    print(f"  Target Gateway: {backend_url}")
    print(f"  Simulation Mode:{mode.upper():>12s} | Loops: {count} | Interval: {interval}s")
    print("=" * 75)

    # 1. Health & DB Connectivity Verification
    try:
        with urllib.request.urlopen(f"{backend_url}/api/v1/health", timeout=3.0) as resp:
            health = json.loads(resp.read().decode("utf-8"))
            status = health.get("status", "unknown")
            db_state = health.get("database", "unknown")
            uptime = health.get("uptime_seconds", "N/A")
            print(f"\n[OK] Gateway Verified: Status={status} | DB={db_state} | Uptime={uptime}s")
    except Exception as e:
        print(f"\n[ERROR] Backend unreachable at {backend_url}: {e}")
        print("Please start the backend: uvicorn app.main:app --host 127.0.0.1 --port 8000")
        sys.exit(1)

    # 2. Camera Setup
    register_cameras(backend_url)

    # 3. Event Dispatch Scenario
    print(f"\n[2] Dispatching Realistic Multi-Sensor Telemetry (Mode: {mode}) ...")

    events_to_send = []
    if mode in ("all", "full"):
        events_to_send = DEMO_EVENTS
    elif mode in ("cv", "intrusion", "intrusions"):
        events_to_send = [e for e in DEMO_EVENTS if e["event_type"] in ("PERSON_DETECTED", "INTRUSION_DETECTED", "SUSPICIOUS_ACTIVITY", "OBJECT_DETECTED")]
    elif mode in ("anpr", "watchlist"):
        events_to_send = [e for e in DEMO_EVENTS if e["event_type"] in ("VEHICLE_DETECTED", "ANPR_DETECTED", "WATCHLIST_MATCH")]

    if mode == "continuous":
        print(f"  Streaming live multi-camera detections every ~{interval}s. Press CTRL+C to stop.\n")
        try:
            sent_count = 0
            while True:
                ev = random.choice(DEMO_EVENTS)
                send_event(backend_url, ev)
                sent_count += 1
                time.sleep(interval + random.uniform(-0.15, 0.35))
        except KeyboardInterrupt:
            print(f"\n[STOPPED] Continuous simulation ended after {sent_count} events.")
    else:
        for loop in range(count):
            if count > 1:
                print(f"  --- Loop {loop + 1}/{count} ---")
            for ev in events_to_send:
                send_event(backend_url, ev)
                time.sleep(interval)

    print("\n" + "=" * 75)
    print("  [COMPLETE] Demonstration scenario executed successfully.")
    print("  -> View Real-Time Command Center: http://localhost:5173/dashboard")
    print("  -> View Threat Alerts Feed:       http://localhost:5173/alerts")
    print("  -> View ANPR Hotlist Radar:       http://localhost:5173/anpr")
    print("  -> View Operational Analytics:    http://localhost:5173/analytics")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IBVAP Live Demonstration Simulation Runner (Phase 3C)")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND, help=f"Backend Gateway URL (default: {DEFAULT_BACKEND})")
    parser.add_argument("--mode", choices=["all", "cv", "intrusion", "anpr", "watchlist", "continuous"], default="all", help="Simulation mode")
    parser.add_argument("--count", type=int, default=1, help="Number of scenario loops to execute")
    parser.add_argument("--interval", type=float, default=0.8, help="Interval in seconds between simulated events")
    parser.add_argument("--reset", action="store_true", help="Safely reset demo surveillance events and reseed baseline")
    parser.add_argument("--force", action="store_true", help="Skip reset confirmation prompt for automated scripting")
    args = parser.parse_args()

    if args.reset:
        reset_demo_data(backend_url=args.backend_url, force=args.force)
    else:
        run_demo(backend_url=args.backend_url, mode=args.mode, count=args.count, interval=args.interval)
