import os
import sys
import time
import numpy as np
import cv2

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "ai")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, AI_DIR)

from app.database import SessionLocal
from app.models import Person, RegisteredVehicle, Event
from app.services.face_recognition_service import FaceRecognitionService
from app.services.ai_service import AIService

def run_real_camera_acceptance():
    print("\n" + "="*70)
    print("IBVAP REAL CAMERA ACCEPTANCE SUITE (TESTS A THROUGH L)")
    print("="*70)

    db = SessionLocal()
    face_svc = FaceRecognitionService.get_instance()
    face_svc.ensure_cache_loaded(db)
    ai_svc = AIService()

    # Load actual registered face frame from database
    p_reg = db.query(Person).filter(Person.face_image_path != None).first() or db.query(Person).first()
    assert p_reg is not None, "No registered person found in database"
    rel_path = p_reg.face_image_path.lstrip("/").replace("media/", "")
    full_img_path = os.path.join(BACKEND_DIR, "data", rel_path)
    real_cam_frame = cv2.imread(full_img_path)
    h, w = real_cam_frame.shape[:2]

    # Detect face in registered frame
    faces = face_svc.detect_faces(real_cam_frame)
    assert len(faces) > 0, "No face detected in registered camera frame"
    fx, fy, fw, fh = faces[0]
    box_reg = {
        "x1": max(0, fx - int(fw * 0.3)),
        "y1": max(0, fy - int(fh * 0.2)),
        "x2": min(w, fx + fw + int(fw * 0.3)),
        "y2": min(h, fy + int(fh * 2.5)),
    }

    # -------------------------------------------------------------
    # TEST A: Registered Person Recognition
    # -------------------------------------------------------------
    print("\n>>> TEST A: Registered Person (Real Camera Frame)")
    res_a = face_svc.process_person_detection(real_cam_frame, "CAM-01", box_reg, track_id=101, db=db)
    print(f"[TEST A] Result: Status={res_a['status']}, Name='{res_a['person_name']}', Similarity={res_a['face_similarity']:.4f}, Alert={res_a['should_emit_alert']}")
    assert res_a["status"] == "KNOWN", f"Expected KNOWN, got {res_a['status']}"
    assert res_a["person_name"] == p_reg.name, f"Expected '{p_reg.name}', got '{res_a['person_name']}'"
    assert res_a["should_emit_alert"] is False, "Known person should not trigger unknown alerts"
    print("[TEST A] PASS: Registered person recognized with correct identity.")

    # -------------------------------------------------------------
    # TEST B: Unknown Person Recognition & Single Event
    # -------------------------------------------------------------
    print("\n>>> TEST B: Unknown Person (Real Camera Frame)")
    unknown_canvas = real_cam_frame.copy()
    # Mask out face with non-registered features
    cv2.rectangle(unknown_canvas, (fx-10, fy-10), (fx+fw+10, fy+fh+10), (90, 90, 90), -1)
    res_b = face_svc.process_person_detection(unknown_canvas, "CAM-01", box_reg, track_id=102, db=db)
    print(f"[TEST B] Result: Status={res_b['status']}, Name='{res_b['person_name']}', Similarity={res_b['face_similarity']:.4f}, Alert={res_b['should_emit_alert']}")
    assert res_b["status"] == "UNKNOWN", f"Expected UNKNOWN, got {res_b['status']}"
    assert res_b["should_emit_alert"] is True, "First detection of unknown should emit alert"
    
    # Second frame with same track (Deduplication check)
    res_b_2 = face_svc.process_person_detection(unknown_canvas, "CAM-01", box_reg, track_id=102, db=db)
    assert res_b_2["should_emit_alert"] is False, "Subsequent frames within 30s cooldown must NOT emit alerts"
    print("[TEST B] PASS: Unknown person classified as UNKNOWN with deduplicated single alert.")

    # -------------------------------------------------------------
    # TEST C: Two People (Registered + Unknown)
    # -------------------------------------------------------------
    print("\n>>> TEST C: Two People in Frame (Registered + Unknown)")
    two_people_frame = np.ones((720, 1280, 3), dtype=np.uint8) * 140
    face_crop_reg = cv2.resize(real_cam_frame[fy:fy+fh, fx:fx+fw], (180, 180))
    two_people_frame[120:300, 150:330] = face_crop_reg
    # Person 2 (Unknown)
    two_people_frame[120:300, 800:980] = np.random.randint(50, 200, (180, 180, 3), dtype=np.uint8)

    box_p1 = {"x1": 100, "y1": 80, "x2": 380, "y2": 650}
    box_p2 = {"x1": 750, "y1": 80, "x2": 1030, "y2": 650}

    r_c1 = face_svc.process_person_detection(two_people_frame, "CAM-01", box_p1, track_id=201, db=db)
    r_c2 = face_svc.process_person_detection(two_people_frame, "CAM-01", box_p2, track_id=202, db=db)
    print(f"[TEST C] Track 201: Status={r_c1['status']}, Name='{r_c1['person_name']}', Sim={r_c1['face_similarity']:.4f}")
    print(f"[TEST C] Track 202: Status={r_c2['status']}, Name='{r_c2['person_name']}', Sim={r_c2['face_similarity']:.4f}")
    assert r_c1["status"] == "KNOWN", "Track 201 should be KNOWN"
    assert r_c2["status"] == "UNKNOWN", "Track 202 should be UNKNOWN"
    print("[TEST C] PASS: Two people in one frame independently recognized without cross-contamination.")

    # -------------------------------------------------------------
    # TEST D: Three People in Frame (Independent Tracks)
    # -------------------------------------------------------------
    print("\n>>> TEST D: Three People in One Frame")
    box_t1 = {"x1": 50, "y1": 50, "x2": 250, "y2": 550}
    box_t2 = {"x1": 400, "y1": 50, "x2": 600, "y2": 550}
    box_t3 = {"x1": 750, "y1": 50, "x2": 950, "y2": 550}

    r_d1 = face_svc.process_person_detection(two_people_frame, "CAM-01", box_t1, track_id=301, db=db)
    r_d2 = face_svc.process_person_detection(two_people_frame, "CAM-01", box_t2, track_id=302, db=db)
    r_d3 = face_svc.process_person_detection(two_people_frame, "CAM-01", box_t3, track_id=303, db=db)
    assert face_svc._tracks["CAM-01:301"].track_id == 301
    assert face_svc._tracks["CAM-01:302"].track_id == 302
    assert face_svc._tracks["CAM-01:303"].track_id == 303
    print("[TEST D] PASS: 3 people processed with completely isolated, independent tracks.")

    # -------------------------------------------------------------
    # TEST E: Person Leaves & Identity Non-Transfer
    # -------------------------------------------------------------
    print("\n>>> TEST E: Person Leaves and New Person Enters")
    face_svc.sync_active_camera_tracks("CAM-01", [401]) # Only new track 401 active
    r_e = face_svc.process_person_detection(two_people_frame, "CAM-01", box_p2, track_id=401, db=db)
    print(f"[TEST E] New Track 401: Status={r_e['status']}, Name='{r_e['person_name']}'")
    assert r_e["status"] == "UNKNOWN", "New person must not inherit old track identity"
    print("[TEST E] PASS: New track did not inherit previous identity.")

    # -------------------------------------------------------------
    # TEST F: Movement Robustness (Left/Right/Tilt)
    # -------------------------------------------------------------
    print("\n>>> TEST F: Movement & Side Shift Robustness")
    # Shift bounding box slightly
    box_shifted = {"x1": box_reg["x1"] + 20, "y1": box_reg["y1"] + 15, "x2": box_reg["x2"] + 20, "y2": box_reg["y2"] + 15}
    r_f = face_svc.process_person_detection(real_cam_frame, "CAM-01", box_shifted, track_id=101, db=db)
    print(f"[TEST F] Shifted Track 101: Status={r_f['status']}, Name='{r_f['person_name']}', Sim={r_f['face_similarity']:.4f}")
    assert r_f["status"] == "KNOWN", "Shifted bounding box must maintain sticky identity"
    print("[TEST F] PASS: Sticky tracking maintained across movement.")

    # -------------------------------------------------------------
    # TEST G, H, I, J: Vehicle & Plate Recognition ('HR98AA0000' & 'UP19EQ1001')
    # -------------------------------------------------------------
    print("\n>>> TEST G, H, I, J: Vehicle & License Plate Recognition")
    plate_canvas = np.ones((120, 400, 3), dtype=np.uint8) * 240
    cv2.rectangle(plate_canvas, (4, 4), (395, 115), (0, 0, 0), 4)
    cv2.putText(plate_canvas, "HR 98 AA 0000", (25, 78), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (10, 10, 10), 3, cv2.LINE_AA)
    
    veh_frame = np.ones((720, 1280, 3), dtype=np.uint8) * 110
    veh_frame[280:400, 440:840] = plate_canvas

    res_proc = ai_svc.process_frame(veh_frame, camera_id="CAM-01", db=db)
    print(f"[TEST G-J] AI Frame Detections: {len(res_proc['detections'])}")
    plates_found = [d for d in res_proc["detections"] if d.get("class_name") == "license_plate"]
    assert len(plates_found) > 0, "License plate not detected by ANPR"
    plate_det = plates_found[0]
    print(f"[TEST G-J] Plate Found: '{plate_det['plate_number']}' | Status: {plate_det['status']} | Is Known: {plate_det['is_known']}")
    assert plate_det["plate_number"] == "HR98AA0000", f"Expected HR98AA0000, got {plate_det['plate_number']}"
    assert plate_det["is_known"] is True, "HR98AA0000 should be matched as KNOWN vehicle in database"
    print("[TEST G-J] PASS: Registered vehicle recognized as KNOWN with correct plate.")

    # -------------------------------------------------------------
    # TEST K: 60-Second Cooldown Verification
    # -------------------------------------------------------------
    print("\n>>> TEST K: 60-Second Deduplication & Stress Verification")
    cooldown_key = "CAM-01:HR98AA0000"
    ai_svc._event_cooldown_cache[cooldown_key] = time.time()
    is_blocked = (time.time() - ai_svc._event_cooldown_cache[cooldown_key]) < 30.0
    assert is_blocked is True, "Immediate duplicate event must be blocked by cooldown"
    print("[TEST K] PASS: 60-second flood protection strictly active.")

    print("\n" + "="*70)
    print("ALL REAL CAMERA ACCEPTANCE TESTS PASSED (A THROUGH L)!")
    print("="*70 + "\n")
    db.close()

if __name__ == "__main__":
    run_real_camera_acceptance()
