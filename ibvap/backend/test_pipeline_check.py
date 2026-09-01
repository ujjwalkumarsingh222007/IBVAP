import sys
import os
import time
from pathlib import Path

backend_dir = Path("D:/IBVAP/IBVAP/ibvap/backend")
sys.path.insert(0, str(backend_dir))
sys.path.insert(1, str(backend_dir.parent))

print("[STEP 1] Initializing Database...", flush=True)
from app.database import init_db, SessionLocal
from app.models import Person, RegisteredVehicle, Camera
init_db()

with SessionLocal() as db:
    people = db.query(Person).all()
    print(f"[DB] Found {len(people)} registered persons:", flush=True)
    for p in people:
        print(f"     Person: {p.name} (code={p.person_code}, status={p.status})", flush=True)

print("[STEP 2] Initializing Face Recognition Service...", flush=True)
from app.services.face_recognition_service import FaceRecognitionService
fs = FaceRecognitionService.get_instance()
with SessionLocal() as db:
    fs.ensure_cache_loaded(db)
print(f"[FACE] Cache loaded. Embeddings count: {len(fs._cache_metadata)}", flush=True)

print("[STEP 3] Initializing AIService...", flush=True)
from app.services.ai_service import AIService
ai_svc = AIService.get_instance()
ai_svc.initialize()
print(f"[AI] AIService diagnostics: {ai_svc.get_status_diagnostics()}", flush=True)

print("[STEP 4] Testing frame inference...", flush=True)
import cv2
import numpy as np

# Find real evidence frame
ev_dir = backend_dir / "evidence"
jpgs = [p for p in ev_dir.glob("*.jpg") if not p.name.endswith("_crop.jpg")]

if jpgs:
    sample_img = sorted(jpgs, key=lambda p: p.stat().st_mtime)[-1]
    print(f"[TEST] Using frame: {sample_img.name}", flush=True)
    frame = cv2.imread(str(sample_img))
    print(f"[TEST] Frame resolution: {frame.shape[1]}x{frame.shape[0]}", flush=True)

    with SessionLocal() as db:
        t0 = time.time()
        res = ai_svc.process_frame(frame, "CAM-01", db)
        dt = (time.time() - t0) * 1000.0
        print(f"[TEST] Inference finished in {dt:.1f}ms", flush=True)
        print(f"[TEST] Status: {res.get('status')}", flush=True)
        print(f"[TEST] Detections count: {res.get('detections_count')}", flush=True)
        for idx, det in enumerate(res.get("detections", [])):
            print(f"       Det {idx+1}: class={det.get('class_name')} track_id={det.get('track_id')} status={det.get('status')} name={det.get('person_name')} sim={det.get('face_similarity')} bbox={det.get('bbox')}", flush=True)
        print(f"[TEST] Emitted events: {res.get('events_count')}", flush=True)

print("[DONE] All checks completed successfully.", flush=True)
