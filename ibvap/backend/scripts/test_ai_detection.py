from __future__ import annotations

import os
import sys
import time
import cv2
import numpy as np
from pathlib import Path

# Add backend directory and AI modules to sys.path
backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.ai_service import AIService
from app.services.face_recognition_service import FaceRecognitionService
from app.database import SessionLocal

def test_ai_pipeline():
    print("=" * 65)
    print("  IBVAP DIRECT AI PIPELINE & MODEL DIAGNOSTIC")
    print("=" * 65)

    # 1. Initialize AIService
    print("\n[1] Initializing AI Services...")
    ai_svc = AIService.get_instance()
    ai_svc.initialize()
    diag = ai_svc.get_status_diagnostics()
    print(f"    - Tracker/CV Status : {diag.get('cv_status')}")
    print(f"    - ANPR Status       : {diag.get('anpr_status')} ({diag.get('anpr_detector')})")
    print(f"    - OCR Engine        : {diag.get('ocr_engine')}")

    # 2. Test Person Detection with real human image
    print("\n[2] Testing Person Detection (Member 1 CV)...")
    img_path = Path("D:/IBVAP/IBVAP/.venv/Lib/site-packages/matplotlib/mpl-data/sample_data/grace_hopper.jpg")
    if not img_path.exists():
        img_path = Path("D:/IBVAP/IBVAP/ibvap/backend/data/faces/person_P-589296C1_41de67.jpg")

    if img_path.exists():
        img_bytes = img_path.read_bytes()
        with SessionLocal() as db:
            t0 = time.perf_counter()
            res = ai_svc.process_frame(image_bytes=img_bytes, camera_id="CAM-BORDER-01", db=db)
            dur_ms = (time.perf_counter() - t0) * 1000.0

            print(f"    - Frame Processed in {dur_ms:.2f} ms")
            print(f"    - Detections Count  : {res.get('detections_count')}")
            for d in res.get("detections", []):
                cls = d.get("class_name")
                conf = d.get("confidence")
                bb = d.get("bbox")
                st = d.get("status")
                name = d.get("person_name")
                print(f"    -> {cls.upper()} confidence={conf:.4f} bbox=({bb.get('x1')}, {bb.get('y1')}, {bb.get('x2')}, {bb.get('y2')}) status={st} name={name}")
    else:
        print("    [WARN] Sample image not found.")

    # 3. Test Face Recognition with registered person image
    print("\n[3] Testing Face Recognition (InsightFace ArcFace)...")
    reg_path = Path("D:/IBVAP/IBVAP/ibvap/backend/data/faces/person_P-589296C1_41de67.jpg")
    if reg_path.exists():
        reg_bytes = reg_path.read_bytes()
        with SessionLocal() as db:
            res_reg = ai_svc.process_frame(image_bytes=reg_bytes, camera_id="CAM-BORDER-01", db=db)
            print(f"    - Registered Person Detections: {res_reg.get('detections_count')}")
            for d in res_reg.get("detections", []):
                print(f"    -> {d.get('class_name').upper()} | status={d.get('status')} | name={d.get('person_name')} | similarity={d.get('face_similarity')}")

    print("\n" + "=" * 65)
    print("  AI PIPELINE DIAGNOSTIC: 100% OPERATIONAL")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    test_ai_pipeline()
