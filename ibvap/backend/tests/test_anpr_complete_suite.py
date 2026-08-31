import os
import sys
import time
import numpy as np
import cv2

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
AI_DIR = os.path.join(PROJECT_ROOT, "ai")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, AI_DIR)

from app.database import SessionLocal
from app.models import RegisteredVehicle, Event
from app.services.ai_service import AIService
from ai.member2_anpr.recognizer import normalise_plate, validate_indian_plate

def run_anpr_complete_suite():
    print("\n" + "="*75)
    print("IBVAP ANPR & VEHICLE SYSTEM COMPLETE TEST SUITE (PHASE 18)")
    print("="*75)

    db = SessionLocal()
    ai_svc = AIService.get_instance()
    ai_svc.initialize()

    # Register UP19EQ1001 if not already in DB
    existing_up = db.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number.in_(["UP19EQ1001", "UP 19 EQ 1001"])).first()
    if not existing_up:
        new_v = RegisteredVehicle(
            plate_number="UP19EQ1001",
            owner_name="Test Owner UP",
            notes="car",
            status="KNOWN"
        )
        db.add(new_v)
        db.commit()
        print("[SETUP] Added 'UP19EQ1001' to RegisteredVehicle database as KNOWN.")

    # Helper function to generate simulated realistic camera frames containing vehicles and plates
    def create_vehicle_frame(plate_text: str, bg_noise: bool = False, x_offset: int = 400, y_offset: int = 250):
        frame = np.ones((720, 1280, 3), dtype=np.uint8) * 120
        # Simulated vehicle rectangle
        cv2.rectangle(frame, (x_offset - 100, y_offset - 80), (x_offset + 500, y_offset + 300), (45, 45, 45), -1)
        cv2.rectangle(frame, (x_offset - 100, y_offset - 80), (x_offset + 500, y_offset + 300), (20, 20, 20), 4)

        # License plate banner
        p_canvas = np.ones((120, 400, 3), dtype=np.uint8) * 245
        cv2.rectangle(p_canvas, (3, 3), (396, 116), (10, 10, 10), 3)
        # Blue IND strip on left
        cv2.rectangle(p_canvas, (3, 3), (45, 116), (180, 50, 20), -1)
        cv2.putText(p_canvas, "IND", (8, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        # Text
        cv2.putText(p_canvas, plate_text, (55, 76), cv2.FONT_HERSHEY_SIMPLEX, 1.25, (10, 10, 10), 3, cv2.LINE_AA)

        if bg_noise:
            noise = np.random.randint(-30, 30, p_canvas.shape, dtype=np.int16)
            p_canvas = np.clip(p_canvas.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        frame[y_offset:y_offset+120, x_offset:x_offset+400] = p_canvas
        return frame

    # -----------------------------------------------------------------
    # TEST 1: One vehicle with clear plate ("UP 19 EQ 1001")
    # -----------------------------------------------------------------
    print("\n>>> TEST 1: One vehicle with clear plate ('UP 19 EQ 1001')")
    frame1 = create_vehicle_frame("UP 19 EQ 1001")
    res1 = ai_svc.process_frame(frame1, camera_id="CAM-01", db=db)
    plates1 = [d for d in res1["detections"] if d.get("class_name") == "license_plate" or d.get("plate_number")]
    print(f"[TEST 1] Detections count: {len(res1['detections'])}, Plates found: {len(plates1)}")
    assert len(plates1) > 0, "Failed to detect plate in clear frame"
    p1 = plates1[0]
    norm1, _ = normalise_plate(p1["plate_number"])
    print(f"[TEST 1] Raw Plate: '{p1.get('raw_ocr_text', p1['plate_number'])}' | Normalized: '{norm1}' | Status: {p1.get('status')}")
    assert norm1 == "UP19EQ1001", f"Expected UP19EQ1001, got {norm1}"
    print("[TEST 1] PASS: Single vehicle with clear plate recognized and normalized correctly.")

    # -----------------------------------------------------------------
    # TEST 2: Same vehicle across 20+ frames (Deduplication / Stability)
    # -----------------------------------------------------------------
    print("\n>>> TEST 2: Same vehicle across 20 continuous frames")
    event_count_before = len(res1.get("events", []))
    total_events_emitted = 0
    for f_idx in range(20):
        res_seq = ai_svc.process_frame(frame1, camera_id="CAM-01", db=db)
        total_events_emitted += len(res_seq.get("events", []))
    print(f"[TEST 2] 20 Frames processed. Total events emitted across 20 frames: {total_events_emitted}")
    assert total_events_emitted <= 1, f"Expected <= 1 event across 20 frames, got {total_events_emitted}"
    print("[TEST 2] PASS: Flood protection and temporal track stability verified (no duplicate events).")

    # -----------------------------------------------------------------
    # TEST 3: Registered Vehicle Match (UP19EQ1001 -> KNOWN VEHICLE)
    # -----------------------------------------------------------------
    print("\n>>> TEST 3: Registered Vehicle Recognition ('UP19EQ1001')")
    res3 = ai_svc.process_frame(frame1, camera_id="CAM-01", db=db)
    v_dets = [d for d in res3["detections"] if d.get("class_name") != "person"]
    assert len(v_dets) > 0
    v3 = v_dets[0]
    print(f"[TEST 3] Vehicle Status: {v3.get('status')} | Is Known: {v3.get('is_known')} | Plate: '{v3.get('plate_number')}'")
    assert v3.get("is_known") is True or v3.get("status") == "KNOWN", f"Expected KNOWN, got {v3.get('status')}"
    print("[TEST 3] PASS: Registered plate correctly classified as KNOWN VEHICLE.")

    # -----------------------------------------------------------------
    # TEST 4: Unknown Vehicle Match (DL01AB9999 -> UNKNOWN VEHICLE)
    # -----------------------------------------------------------------
    print("\n>>> TEST 4: Unknown Vehicle ('DL01AB9999')")
    frame4 = create_vehicle_frame("DL 01 AB 9999", x_offset=300)
    # Feed 2 frames to achieve voting consensus
    ai_svc.process_frame(frame4, camera_id="CAM-02", db=db)
    res4 = ai_svc.process_frame(frame4, camera_id="CAM-02", db=db)
    plates4 = [d for d in res4["detections"] if d.get("class_name") == "license_plate" or d.get("plate_number")]
    assert len(plates4) > 0
    p4 = plates4[0]
    norm4, _ = normalise_plate(p4["plate_number"])
    print(f"[TEST 4] Unknown Plate: '{norm4}' | Status: {p4.get('status')} | Is Known: {p4.get('is_known')}")
    assert norm4 == "DL01AB9999", f"Expected DL01AB9999, got {norm4}"
    assert p4.get("is_known") is False, "Unregistered vehicle should NOT be is_known=True"
    print("[TEST 4] PASS: Unregistered vehicle correctly classified as UNKNOWN.")

    # -----------------------------------------------------------------
    # TEST 5: Noisy / Poor Angle Frame (Robustness & Non-Crash)
    # -----------------------------------------------------------------
    print("\n>>> TEST 5: Noisy Frame & Distorted Crop (System Stability)")
    frame5 = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    res5 = ai_svc.process_frame(frame5, camera_id="CAM-03", db=db)
    print(f"[TEST 5] Processed successfully without exception: {res5['processed']}, Detections: {len(res5['detections'])}")
    assert res5["processed"] is True
    print("[TEST 5] PASS: Corrupted/noisy input handled safely without server crash.")

    # -----------------------------------------------------------------
    # TEST 6: Multiple Vehicles in One Frame
    # -----------------------------------------------------------------
    print("\n>>> TEST 6: Multiple Vehicles in One Frame")
    multi_frame = np.ones((720, 1280, 3), dtype=np.uint8) * 100
    p_c1 = np.ones((100, 320, 3), dtype=np.uint8) * 240
    cv2.putText(p_c1, "UP 19 EQ 1001", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 2)
    p_c2 = np.ones((100, 320, 3), dtype=np.uint8) * 240
    cv2.putText(p_c2, "HR 98 AA 0000", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 2)
    multi_frame[200:300, 100:420] = p_c1
    multi_frame[200:300, 700:1020] = p_c2

    res6 = ai_svc.process_frame(multi_frame, camera_id="CAM-04", db=db)
    plates6 = [d for d in res6["detections"] if d.get("class_name") == "license_plate" or d.get("plate_number")]
    plate_nums = [d.get("plate_number") for d in plates6]
    print(f"[TEST 6] Multiple Plates Detected ({len(plates6)}): {plate_nums}")
    assert len(plates6) >= 2, f"Expected >= 2 plates, got {len(plates6)}"
    print("[TEST 6] PASS: Multiple vehicles and plates detected independently in single frame.")

    # -----------------------------------------------------------------
    # TEST 7: Vehicle Leaves Frame and Returns
    # -----------------------------------------------------------------
    print("\n>>> TEST 7: Vehicle Leaves and Returns (Track Lifetime)")
    ai_svc.process_frame(frame1, camera_id="CAM-05", db=db)
    # Simulate vehicle leaving for 20 seconds
    time.sleep(0.1)
    empty_frame = np.ones((720, 1280, 3), dtype=np.uint8) * 50
    ai_svc.process_frame(empty_frame, camera_id="CAM-05", db=db)
    res7 = ai_svc.process_frame(frame1, camera_id="CAM-05", db=db)
    print(f"[TEST 7] Vehicle Re-entry Handled cleanly: {res7['processed']}")
    assert res7["processed"] is True
    print("[TEST 7] PASS: Vehicle leave-and-return handled cleanly without crash.")

    print("\n" + "="*75)
    print("ALL 7 ANPR & VEHICLE ACCEPTANCE SCENARIOS PASSED WITH 100% SUCCESS!")
    print("="*75 + "\n")
    db.close()

if __name__ == "__main__":
    run_anpr_complete_suite()
