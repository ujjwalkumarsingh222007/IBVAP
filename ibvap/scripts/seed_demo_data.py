#!/usr/bin/env python3
"""
seed_demo_data.py — Explicit, manual command-line seeding tool for IBVAP demonstrations.
Allows operators to inject verified baseline demo cameras, events, and watchlist targets
into the backend for demonstration purposes.

Usage:
  python scripts/seed_demo_data.py [--backend http://127.0.0.1:8000] [--clear-first]
"""

from __future__ import annotations

import sys
import json
import argparse
import urllib.request
import urllib.error
from typing import Any, Dict, List

DEFAULT_BACKEND = "http://127.0.0.1:8000"

SEED_CAMERAS: List[Dict[str, Any]] = [
    {"camera_id": "CAM-TOWER-01", "name": "North Perimeter Tower", "location": "Sector 1 Alpha", "status": "ONLINE"},
    {"camera_id": "CAM-TOWER-02", "name": "East Perimeter Line", "location": "Sector 2 Bravo", "status": "ONLINE"},
    {"camera_id": "CAM-GATE-01", "name": "Main Vehicle Checkpoint", "location": "Gate 1 Highway Entry", "status": "ONLINE"},
    {"camera_id": "CAM-TOWER-04", "name": "Command Center Webcam Node", "location": "Optical Sensor Lab", "status": "ONLINE"},
    {"camera_id": "CAM-BORDER-05", "name": "South Outpost PTZ", "location": "Sector 5 Zulu", "status": "ONLINE"},
]

SEED_EVENTS: List[Dict[str, Any]] = [
    {
        "camera_id": "CAM-TOWER-04",
        "event_type": "PERSON_DETECTED",
        "confidence": 0.94,
        "metadata": {
            "track_id": 101,
            "class_name": "person",
            "bbox": [100, 120, 240, 420],
            "position": {"x": 170, "y": 270},
        },
    },
    {
        "camera_id": "CAM-TOWER-04",
        "event_type": "ANPR_DETECTED",
        "confidence": 0.91,
        "metadata": {
            "plate_number": "HR98AA0000",
            "vehicle_id": "VEH-101",
            "raw_ocr_text": "HR 98 AA 0000",
            "plate_confidence": 0.93,
            "ocr_confidence": 0.89,
            "watchlist_match": False,
        },
    },
    {
        "camera_id": "CAM-GATE-01",
        "event_type": "WATCHLIST_MATCH",
        "confidence": 0.97,
        "metadata": {
            "plate_number": "TN09AB1234",
            "vehicle_id": "VEH-102",
            "raw_ocr_text": "TN 09 AB 1234",
            "plate_confidence": 0.98,
            "ocr_confidence": 0.96,
            "watchlist_match": True,
            "watchlist_status": "STOLEN",
            "watchlist_reason": "High-priority stolen vehicle alert",
        },
    },
    {
        "camera_id": "CAM-TOWER-01",
        "event_type": "INTRUSION_DETECTED",
        "confidence": 0.95,
        "metadata": {
            "track_id": 104,
            "class_name": "person",
            "fence_zone": "Sector 1 Virtual Line",
            "crossing_direction": "INWARD",
        },
    },
]


def post_json(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Explicit Demo Seeding Utility for IBVAP")
    parser.add_argument("--backend", default=DEFAULT_BACKEND, help="Base backend URL")
    parser.add_argument("--clear-first", action="store_true", help="Clear existing events before seeding")
    args = parser.parse_args()

    base_url = args.backend.rstrip("/")
    print(f"=== IBVAP Demo Data Seeder ===")
    print(f"Target Backend: {base_url}")

    # 1. Health check
    try:
        req = urllib.request.Request(f"{base_url}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            health = json.loads(resp.read().decode("utf-8"))
            print(f"[OK] Backend health: {health.get('status', 'unknown')}")
    except Exception as e:
        print(f"[ERROR] Cannot connect to backend at {base_url}: {e}")
        sys.exit(1)

    # 2. Optional Reset
    if args.clear_first:
        try:
            print("[INFO] Clearing existing surveillance events...")
            res = post_json(f"{base_url}/api/v1/demo/reset", {"confirm": True})
            print(f"[OK] {res.get('message', 'Reset successful')}")
        except Exception as e:
            print(f"[WARN] Reset failed or endpoint unavailable: {e}")

    # 3. Seed Cameras
    print("[INFO] Verifying / Seeding camera nodes...")
    for cam in SEED_CAMERAS:
        try:
            post_json(f"{base_url}/api/v1/cameras", cam)
            print(f"  + Registered camera: {cam['camera_id']} ({cam['name']})")
        except urllib.error.HTTPError as he:
            if he.code == 409 or he.code == 400:
                print(f"  . Camera {cam['camera_id']} already registered")
            else:
                print(f"  - Failed camera {cam['camera_id']}: {he}")
        except Exception as e:
            print(f"  - Failed camera {cam['camera_id']}: {e}")

    # 4. Seed Events
    print("[INFO] Dispatching verified demo events...")
    for ev in SEED_EVENTS:
        try:
            res = post_json(f"{base_url}/api/v1/events", ev)
            print(f"  + Ingested event #{res.get('id')} [{ev['event_type']}] on {ev['camera_id']}")
        except Exception as e:
            print(f"  - Event ingestion error: {e}")

    print("\n[SUCCESS] Demo data seeding completed successfully.")


if __name__ == "__main__":
    main()
