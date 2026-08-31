import os
import sys
import numpy as np
import cv2

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AI_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "ai")
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, AI_DIR)

from member2_anpr.pipeline import ANPRPipeline
from member2_anpr.detector import YOLOPlateDetector
from member2_anpr.ocr import EasyOCREngine
from member2_anpr.recognizer import normalise_plate, validate_indian_plate
from app.database import SessionLocal
from app.models import RegisteredVehicle

def test_anpr_standalone():
    print("\n" + "="*70)
    print("ANPR STANDALONE DIAGNOSTIC TEST")
    print("="*70)

    # 1. Create test image containing plate 'UP 19 EQ 1001'
    plate_canvas = np.ones((120, 400, 3), dtype=np.uint8) * 240
    cv2.rectangle(plate_canvas, (4, 4), (395, 115), (0, 0, 0), 4)
    cv2.putText(plate_canvas, "UP 19 EQ 1001", (25, 78), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (10, 10, 10), 3, cv2.LINE_AA)

    test_img = np.ones((720, 1280, 3), dtype=np.uint8) * 130
    test_img[300:420, 440:840] = plate_canvas

    # STAGE 1: Plate Detection
    model_path = os.path.join(AI_DIR, "member2_anpr", "models", "license_plate.pt")
    detector = YOLOPlateDetector(model_path=model_path, confidence_threshold=0.20)
    plates = detector.detect(test_img)
    print(f"[STAGE 1 - Plate Detection] Plates Detected: {len(plates)}")
    assert len(plates) > 0, "Plate detector failed to detect plate in test image"
    p = plates[0]
    print(f"  BBox: ({p.x1}, {p.y1}, {p.x2}, {p.y2}), Confidence: {p.confidence:.4f}")

    # STAGE 2: Crop Verification
    crop = test_img[p.y1:p.y2, p.x1:p.x2]
    print(f"[STAGE 2 - Crop Size] Crop shape: {crop.shape}")
    assert crop.shape[0] > 20 and crop.shape[1] > 40, "Invalid crop shape"

    # STAGE 3: OCR
    ocr = EasyOCREngine(languages=["en"], gpu=False)
    ocr_res = ocr.read(crop)
    print(f"[STAGE 3 - OCR] Raw Text: '{ocr_res.raw_text}', Confidence: {ocr_res.confidence:.4f}")
    assert len(ocr_res.raw_text.strip()) > 0, "OCR returned empty string"

    # STAGE 4: Normalization & Validation
    norm_p, was_mod = normalise_plate(ocr_res.raw_text)
    is_valid, reason = validate_indian_plate(norm_p)
    print(f"[STAGE 4 - Normalization] Normalized: '{norm_p}' (Modified={was_mod}), Valid Indian Plate: {is_valid} ({reason})")
    assert norm_p == "UP19EQ1001", f"Expected UP19EQ1001, got {norm_p}"

    # STAGE 5: Database Lookup
    db = SessionLocal()
    reg = db.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number == norm_p).first()
    db_match = bool(reg is not None)
    print(f"[STAGE 5 - Database Lookup] Match found: {db_match} (Owner: {reg.owner_name if reg else 'N/A'}, Status: {reg.status if reg else 'UNKNOWN'})")
    db.close()

    print("\n[ANPR STANDALONE TEST] ALL 5 STAGES PASSED!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_anpr_standalone()
