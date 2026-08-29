#!/usr/bin/env python3
"""
demo_simulation.py — IBVAP Live Demonstration & Event Generator.

Enables judges, evaluators, and team members to simulate realistic
surveillance scenarios across all AI modules without needing a physical CCTV camera.

Scenarios include:
  1. Border Fence Intrusion Breaches (Member 1 CV)
  2. ANPR Checkpoint Scans & Stolen Vehicle Hotlist Hits (Member 2 ANPR)
  3. Continuous Multi-Camera Surveillance Stream Simulation
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
        headers={"Content-Type": "application/json", "User-Agent": "IBVAP-Demo/1.0"},
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


def register_cameras(backend_url: str):
    print(f"\n[1] Registering Border Cameras on {backend_url}/api/v1/cameras ...")
    for cam in DEMO_CAMERAS:
        status, body = post_json(f"{backend_url}/api/v1/cameras", cam)
        if status in (200, 201):
            print(f"  + Registered {cam['camera_id']} ({cam['name']}) -> HTTP {status}")
        elif status == 409:
            print(f"  * {cam['camera_id']} already registered -> HTTP 409 Conflict (OK)")
        else:
            print(f"  - Failed {cam['camera_id']} -> HTTP {status}: {body}")


def send_event(backend_url: str, event_data: dict) -> bool:
    payload = dict(event_data)
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    status, body = post_json(f"{backend_url}/api/v1/events", payload)
    if status in (200, 201):
        res_json = json.loads(body)
        print(f"  -> [{payload['event_type']:19s}] Cam: {payload['camera_id']:14s} Conf: {payload['confidence']:.2f} -> Event #{res_json.get('id', '?')} (HTTP {status})")
        return True
    else:
        print(f"  x [{payload['event_type']:19s}] FAILED (HTTP {status}): {body}")
        return False


def run_demo(backend_url: str, mode: str, count: int = 1, interval: float = 1.0):
    print("=" * 70)
    print("  IBVAP — Intelligent Border Video Analytics Platform Demo Runner")
    print(f"  Target Backend: {backend_url}")
    print(f"  Mode:           {mode.upper()}")
    print("=" * 70)

    # 1. Health Check
    try:
        with urllib.request.urlopen(f"{backend_url}/api/v1/health", timeout=3.0) as resp:
            health = json.loads(resp.read().decode("utf-8"))
            print(f"\n[OK] Backend Connection Verified: {health.get('status')} | DB: {health.get('database')}")
    except Exception as e:
        print(f"\n[ERROR] Backend unreachable at {backend_url}: {e}")
        print("Please start the backend with: uvicorn app.main:app --host 127.0.0.1 --port 8000")
        sys.exit(1)

    # 2. Camera Setup
    register_cameras(backend_url)

    # 3. Event Dispatch
    print(f"\n[2] Dispatching Simulated Events (Mode: {mode}) ...")

    if mode == "all":
        for ev in DEMO_EVENTS:
            send_event(backend_url, ev)
            time.sleep(interval)

    elif mode == "intrusion":
        intrusions = [e for e in DEMO_EVENTS if e["event_type"] in ("PERSON_DETECTED", "INTRUSION_DETECTED", "SUSPICIOUS_ACTIVITY")]
        for ev in intrusions:
            send_event(backend_url, ev)
            time.sleep(interval)

    elif mode == "anpr":
        anprs = [e for e in DEMO_EVENTS if e["event_type"] in ("VEHICLE_DETECTED", "ANPR_DETECTED", "WATCHLIST_MATCH")]
        for ev in anprs:
            send_event(backend_url, ev)
            time.sleep(interval)

    elif mode == "continuous":
        print(f"  Streaming continuous realistic events every ~{interval}s. Press CTRL+C to stop.")
        try:
            while True:
                ev = random.choice(DEMO_EVENTS)
                send_event(backend_url, ev)
                time.sleep(interval + random.uniform(-0.2, 0.5))
        except KeyboardInterrupt:
            print("\n[STOPPED] Continuous simulation stream ended.")

    print("\n[COMPLETE] Simulation scenario finished. Check dashboard at http://localhost:5173\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IBVAP Live Demonstration Simulation Runner")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND, help=f"Backend URL (default: {DEFAULT_BACKEND})")
    parser.add_argument("--mode", choices=["all", "intrusion", "anpr", "continuous"], default="all", help="Simulation mode")
    parser.add_argument("--interval", type=float, default=0.8, help="Interval in seconds between events")
    args = parser.parse_args()

    run_demo(backend_url=args.backend_url, mode=args.mode, interval=args.interval)
