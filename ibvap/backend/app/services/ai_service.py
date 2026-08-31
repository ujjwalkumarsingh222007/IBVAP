"""
ai_service.py — Backend integration service connecting live video/webcam frames to Member 1 CV and Member 2 ANPR pipelines.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.models import Event
from app.config import (
    YOLO_MODEL_PATH,
    CV_CONFIDENCE_THRESHOLD,
    PLATE_MODEL_PATH,
    PLATE_CONFIDENCE_THRESHOLD,
    ANPR_OCR_CONF,
    ANPR_OCR_GPU,
    DUPLICATE_SUPPRESSION_WINDOW_SECONDS,
)

logger = logging.getLogger(__name__)

# Add project root and AI module directories to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MEMBER1_CV_DIR = PROJECT_ROOT / "ai" / "member1_cv"
MEMBER2_ANPR_DIR = PROJECT_ROOT / "ai" / "member2_anpr"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(MEMBER1_CV_DIR) not in sys.path:
    sys.path.insert(0, str(MEMBER1_CV_DIR))
if str(MEMBER2_ANPR_DIR) not in sys.path:
    sys.path.insert(0, str(MEMBER2_ANPR_DIR))

# Import Member 1 CV
try:
    from detection.detector import Detector, DetectionResult, BoundingBox
    from tracking.tracker import ObjectTracker
    from events.analyzer import EventAnalyzer, AnalyticsEvent
    from intrusion.detector import IntrusionDetector, IntrusionEvent
    from intrusion.fence import VirtualFence, DEFAULT_FENCE_POLYGON
    MEMBER1_AVAILABLE = True
except Exception as exc:
    MEMBER1_AVAILABLE = False
    logger.warning("Member 1 CV modules could not be directly imported: %s", exc)

# Import Member 2 ANPR
try:
    from ai.member2_anpr.pipeline import ANPRPipeline
    from ai.member2_anpr.detector import BasePlateDetector, MockPlateDetector, YOLOPlateDetector
    from ai.member2_anpr.ocr import BaseOCREngine, MockOCREngine, EasyOCREngine
    from ai.member2_anpr.recognizer import PlateRecognizer, normalise_plate, validate_indian_plate
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor
    from ai.member2_anpr.config import default_config as anpr_default_config
    MEMBER2_AVAILABLE = True
except Exception as exc:
    MEMBER2_AVAILABLE = False
    logger.warning("Member 2 ANPR modules could not be directly imported: %s", exc)


class VehicleTrackState:
    """Maintains temporal plate voting and deduplication state per tracked vehicle."""

    def __init__(self, camera_id: str, track_id: int):
        self.camera_id = camera_id
        self.track_id = track_id
        self.first_seen = time.time()
        self.last_seen = time.time()
        self.ocr_history: List[Dict[str, Any]] = []
        self.confirmed_plate: Optional[str] = None
        self.confirmed_status: str = "ANALYZING"
        self.confirmed_score: float = 0.0
        self.last_alert_time: float = 0.0
        self.last_evidence_time: float = 0.0
        self.last_log_time: float = 0.0


class AIService:
    """
    Singleton service managing the Member 1 Computer Vision pipeline
    (YOLO Detection, ByteTrack Tracking, EventAnalyzer, VirtualFence IntrusionDetector)
    and Member 2 ANPR Pipeline (Plate Detection, OCR, Recognition, Watchlist, Duplicate Suppression).
    """

    _instance: Optional[AIService] = None

    def __init__(
        self,
        model_path: str = YOLO_MODEL_PATH,
        confidence: float = CV_CONFIDENCE_THRESHOLD,
    ) -> None:
        self.model_path = model_path
        self.confidence = confidence
        self.tracker: Optional[Any] = None
        self.event_analyzer: Optional[Any] = None
        self.intrusion_detector: Optional[Any] = None
        self.virtual_fence: Optional[Any] = None
        self.anpr_pipeline: Optional[Any] = None
        self.detector_name: str = "Uninitialized"
        self.ocr_name: str = "Uninitialized"
        self._initialized = False
        self._event_cooldown_cache: Dict[str, float] = {}
        self._vehicle_tracks: Dict[str, VehicleTrackState] = {}
        self._last_vehicle_log_time: float = 0.0
        self._cooldown_seconds: float = 30.0

    @classmethod
    def get_instance(cls) -> AIService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(
        self,
        anpr_detector: Optional[BasePlateDetector] = None,
        anpr_ocr: Optional[BaseOCREngine] = None,
    ) -> None:
        """Initialize tracker, event analyzer, intrusion detector, and ANPR components."""
        if self._initialized:
            return

        # 1. Initialize Member 1 CV components
        if MEMBER1_AVAILABLE:
            try:
                self.tracker = ObjectTracker(
                    model_path=self.model_path,
                    confidence_threshold=self.confidence,
                    tracker_config="bytetrack.yaml",
                    device="cpu",
                )
                self.event_analyzer = EventAnalyzer()
                self.virtual_fence = VirtualFence(list(DEFAULT_FENCE_POLYGON))
                self.intrusion_detector = IntrusionDetector(self.virtual_fence)
                logger.info("Member 1 CV Pipeline successfully initialized for backend frame processing.")
            except Exception as exc:
                logger.warning("Failed to initialize Member 1 ObjectTracker: %s", exc)
        else:
            logger.warning("Member 1 CV is not available in environment.")

        # 2. Initialize Member 2 ANPR components
        if MEMBER2_AVAILABLE:
            try:
                detector = anpr_detector
                if detector is None:
                    candidates = [
                        PLATE_MODEL_PATH,
                        str(PROJECT_ROOT / "ai" / "member2_anpr" / "models" / "license_plate.pt"),
                        str(PROJECT_ROOT / "models" / "license_plate.pt"),
                        "ai/member2_anpr/models/license_plate.pt",
                    ]
                    valid_model = next((p for p in candidates if p and os.path.exists(p)), None)

                    if valid_model:
                        detector = YOLOPlateDetector(
                            model_path=valid_model,
                            confidence_threshold=PLATE_CONFIDENCE_THRESHOLD,
                        )
                        logger.info("ANPR Detector: YOLOPlateDetector (model=%s)", os.path.abspath(valid_model))
                    else:
                        detector = MockPlateDetector()
                        logger.warning("Model fallback: license_plate.pt not found on disk, using MockPlateDetector")

                ocr = anpr_ocr
                if ocr is None:
                    try:
                        ocr = EasyOCREngine(
                            languages=["en"],
                            gpu=ANPR_OCR_GPU,
                        )
                        logger.info("OCR Engine: EasyOCREngine")
                    except Exception as ocr_err:
                        logger.warning("OCR fallback: Failed to initialize EasyOCREngine (%s), using MockOCREngine", ocr_err)
                        ocr = MockOCREngine()

                self.detector_name = type(detector).__name__
                self.ocr_name = type(ocr).__name__

                self.anpr_pipeline = ANPRPipeline(
                    detector=detector,
                    ocr_engine=ocr,
                    recognizer=PlateRecognizer(
                        strict=anpr_default_config.strict_plate_validation,
                        min_confidence=ANPR_OCR_CONF,
                    ),
                    watchlist=InMemoryWatchlistMatcher(),
                    event_generator=ANPREventGenerator(),
                    duplicate_suppressor=DuplicateSuppressor(
                        window_seconds=DUPLICATE_SUPPRESSION_WINDOW_SECONDS,
                        enabled=True,
                    ),
                    config=anpr_default_config,
                )
                logger.info(
                    "Member 2 ANPR Pipeline successfully initialized in AIService (detector=%s, ocr=%s)",
                    self.detector_name,
                    self.ocr_name,
                )
            except Exception as exc:
                logger.error("Failed to initialize Member 2 ANPR Pipeline: %s", exc, exc_info=True)
        else:
            logger.warning("Member 2 ANPR is not available in environment.")

        self._initialized = True

    def get_status_diagnostics(self) -> Dict[str, str]:
        """Return diagnostic status of AI subsystems for health monitoring."""
        return {
            "cv_status": "ONLINE" if self.tracker is not None else "STANDBY",
            "anpr_status": "ONLINE" if self.anpr_pipeline is not None else "STANDBY",
            "anpr_detector": self.detector_name,
            "ocr_engine": self.ocr_name,
        }

    def process_frame(
        self,
        image_bytes: bytes,
        camera_id: str,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Process a single image frame through optimized Member 1 CV and Member 2 ANPR pipelines
        with strict per-track 30s event cooldown, identity stabilization, and exception isolation.
        """
        try:
            return self._process_frame_internal(image_bytes, camera_id, db)
        except Exception as exc:
            logger.error("[AI ERROR] camera_id=%s, stage=process_frame, exception=%s", camera_id, exc, exc_info=True)
            return {
                "status": "error",
                "camera_id": camera_id,
                "processed": False,
                "detections_count": 0,
                "detections": [],
                "events_count": 0,
                "events": [],
                "correlated_threat": None,
                "error": str(exc),
            }

    def _process_frame_internal(
        self,
        image_bytes: bytes,
        camera_id: str,
        db: Session,
    ) -> Dict[str, Any]:
        t_frame_start = time.perf_counter()
        now_epoch = time.time()
        now_str = datetime.now(timezone.utc).isoformat()

        if not self._initialized:
            self.initialize()

        # 1. Decode image safely
        if isinstance(image_bytes, np.ndarray):
            frame = image_bytes
        elif isinstance(image_bytes, (bytes, bytearray)):
            np_arr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        else:
            raise ValueError(f"Unsupported frame type: {type(image_bytes).__name__}")

        if frame is None or frame.size == 0:
            raise ValueError("Corrupted or unreadable image frame data.")

        orig_h, orig_w = frame.shape[:2]

        # Optimize inference resolution: scale to max width 640 for fast tracking & face detection
        scale = 1.0
        if orig_w > 640:
            scale = 640.0 / orig_w
            proc_frame = cv2.resize(frame, (640, int(orig_h * scale)), interpolation=cv2.INTER_AREA)
        else:
            proc_frame = frame

        detections: List[Any] = []
        raw_detections: List[Dict[str, Any]] = []

        # 2. Run inference & tracking (Member 1)
        t_cv_start = time.perf_counter()
        if self.tracker is not None:
            try:
                detections = self.tracker.track(proc_frame)
            except Exception as e:
                logger.error("Error during tracker.track(): %s", e)
                detections = []
        t_cv_ms = (time.perf_counter() - t_cv_start) * 1000.0

        for det in detections:
            d_dict = det.as_dict()
            if scale != 1.0 and "bbox" in d_dict:
                b = d_dict["bbox"]
                d_dict["bbox"] = {
                    "x1": b["x1"] / scale,
                    "y1": b["y1"] / scale,
                    "x2": b["x2"] / scale,
                    "y2": b["y2"] / scale,
                }
            raw_detections.append(d_dict)

        from app.models import RegisteredVehicle
        from app.services.face_recognition_service import FaceRecognitionService
        from app.services.evidence_service import EvidenceService

        face_service = FaceRecognitionService.get_instance()
        evidence_svc = EvidenceService.get_instance()

        # Supplement face-only webcam views (ensures multi-person desk/webcam detection even when full torso is out of frame)
        detected_faces = face_service.detect_faces(proc_frame, min_size=(25, 25))
        for f_idx, (fx, fy, fw, fh) in enumerate(detected_faces):
            fx_orig, fy_orig, fw_orig, fh_orig = fx / scale, fy / scale, fw / scale, fh / scale
            pb_x1 = max(0.0, fx_orig - fw_orig * 0.25)
            pb_y1 = max(0.0, fy_orig - fh_orig * 0.15)
            pb_x2 = min(float(orig_w), fx_orig + fw_orig * 1.25)
            pb_y2 = min(float(orig_h), fy_orig + fh_orig * 2.5)

            covered = False
            for existing in raw_detections:
                if existing.get("class_name") == "person":
                    eb = existing.get("bbox") or {}
                    ex1, ey1, ex2, ey2 = eb.get("x1", 0), eb.get("y1", 0), eb.get("x2", 0), eb.get("y2", 0)
                    fc_x, fc_y = fx_orig + fw_orig / 2.0, fy_orig + fh_orig / 2.0
                    if ex1 <= fc_x <= ex2 and ey1 <= fc_y <= ey2:
                        covered = True
                        break
            if not covered:
                t_id = 1000 + int((fx_orig * 7 + fy_orig * 13) % 8999)
                raw_detections.append({
                    "class_name": "person",
                    "confidence": 0.92,
                    "track_id": t_id,
                    "bbox": {"x1": pb_x1, "y1": pb_y1, "x2": pb_x2, "y2": pb_y2},
                })

        # Fast vehicle lookup from SQLite
        registered_vehicles = db.query(RegisteredVehicle).all()
        reg_vehicle_map = {v.plate_number.replace(" ", "").upper(): v for v in registered_vehicles}

        VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck", "vehicle", "license_plate"}

        # 3. Process Person Detections with Track Identity & Cosine Embedding Cache
        t_face_start = time.perf_counter()
        for det in raw_detections:
            cls_name = str(det.get("class_name", "")).lower()
            track_id = det.get("track_id")
            bbox = det.get("bbox") or {}

            # --- Person Processing ---
            if cls_name == "person":
                stab = face_service.process_person_detection(
                    frame=frame,
                    camera_id=camera_id,
                    bbox=bbox,
                    track_id=track_id,
                    db=db,
                )
                det["is_known"] = stab["is_known"]
                det["is_flagged"] = stab["is_flagged"]
                det["person_name"] = stab["person_name"]
                det["person_id"] = stab["person_id"]
                det["status"] = stab["status"]
                det["face_similarity"] = stab["face_similarity"]
                det["should_emit_alert"] = stab["should_emit_alert"]
                det["should_capture_evidence"] = stab["should_capture_evidence"]

            # --- Vehicle Processing & Temporal Plate Tracking ---
            elif cls_name in VEHICLE_CLASSES:
                v_tid = track_id or (5000 + int((bbox.get("x1", 0) * 3 + bbox.get("y1", 0) * 7) % 4000))
                det["track_id"] = v_tid
                v_key = f"{camera_id}:{v_tid}"
                v_track = self._vehicle_tracks.setdefault(v_key, VehicleTrackState(camera_id, v_tid))
                v_track.last_seen = now_epoch

                # Default to current confirmed track status
                det["status"] = v_track.confirmed_status
                det["plate_number"] = v_track.confirmed_plate or "Scanning..."
                det["plate_readable"] = bool(v_track.confirmed_plate and v_track.confirmed_plate != "Scanning...")
                det["is_known"] = (v_track.confirmed_status == "KNOWN")
                det["is_flagged"] = (v_track.confirmed_status in ("FLAGGED", "WATCHLIST"))
                det["should_emit_alert"] = False
                det["should_capture_evidence"] = False

        # Synchronize active tracks & prune old vehicle tracks
        active_person_tracks = [
            det.get("track_id")
            for det in raw_detections
            if det.get("track_id") is not None and str(det.get("class_name", "")).lower() == "person"
        ]
        face_service.sync_active_camera_tracks(camera_id, active_person_tracks)
        
        for k in list(self._vehicle_tracks.keys()):
            if k.startswith(f"{camera_id}:"):
                if now_epoch - self._vehicle_tracks[k].last_seen > 15.0:
                    self._vehicle_tracks.pop(k, None)

        t_face_ms = (time.perf_counter() - t_face_start) * 1000.0

        # 4. Run Member 2 ANPR Pipeline
        anpr_plates_count = 0
        best_plate_conf = 0.0
        best_ocr_res = "none"
        best_ocr_conf = 0.0
        db_matched = "NO"
        veh_detections = [d for d in raw_detections if str(d.get("class_name", "")).lower() in VEHICLE_CLASSES and str(d.get("class_name", "")).lower() != "license_plate"]

        if self.anpr_pipeline is not None:
            try:
                # 4a. Run plate detector on full frame
                anpr_results = self.anpr_pipeline.process_frame(
                    frame=frame,
                    camera_id=camera_id,
                    timestamp=now_str,
                )

                # 4b. If full-frame detection found no plates but vehicle bounding boxes exist, search within vehicle crops
                if (not anpr_results or all(r.error for r in anpr_results)) and veh_detections:
                    for v_det in veh_detections:
                        vb = v_det.get("bbox") or {}
                        vx1 = int(max(0, vb.get("x1", 0)))
                        vy1 = int(max(0, vb.get("y1", 0)))
                        vx2 = int(min(frame.shape[1], vb.get("x2", frame.shape[1])))
                        vy2 = int(min(frame.shape[0], vb.get("y2", frame.shape[0])))
                        if (vx2 - vx1) >= 40 and (vy2 - vy1) >= 40:
                            v_crop = frame[vy1:vy2, vx1:vx2]
                            crop_res = self.anpr_pipeline.process_frame(
                                frame=v_crop,
                                camera_id=camera_id,
                                timestamp=now_str,
                                vehicle_id=str(v_det.get("track_id", "")),
                            )
                            for cr in crop_res:
                                if not cr.error and cr.plate_number:
                                    if cr.bbox:
                                        cr.bbox = {
                                            "x1": cr.bbox["x1"] + vx1,
                                            "y1": cr.bbox["y1"] + vy1,
                                            "x2": cr.bbox["x2"] + vx1,
                                            "y2": cr.bbox["y2"] + vy1,
                                        }
                                    anpr_results.append(cr)

                valid_plates = [r for r in anpr_results if not r.error and r.plate_number]
                anpr_plates_count = len(valid_plates)

                for anpr_res in valid_plates:
                    plate_bbox = anpr_res.bbox if anpr_res.bbox else {"x1": 0, "y1": 0, "x2": 0, "y2": 0}
                    raw_ocr = anpr_res.event.metadata.get("raw_ocr_text", anpr_res.plate_number) if anpr_res.event else anpr_res.plate_number
                    clean_plate_str, _ = normalise_plate(raw_ocr)
                    if not clean_plate_str:
                        clean_plate_str = anpr_res.plate_number.replace(" ", "").upper()

                    p_conf = float(anpr_res.plate_confidence or 0.9)
                    o_conf = float(anpr_res.ocr_confidence or 0.85)
                    is_fmt_valid, fmt_reason = validate_indian_plate(clean_plate_str)
                    fmt_score = 1.0 if is_fmt_valid else 0.40

                    # Associate with closest vehicle detection
                    matched_vdet = None
                    pbx = (plate_bbox.get("x1", 0) + plate_bbox.get("x2", 0)) / 2.0
                    pby = (plate_bbox.get("y1", 0) + plate_bbox.get("y2", 0)) / 2.0

                    for v_det in veh_detections:
                        vb = v_det.get("bbox") or {}
                        vx1, vy1 = vb.get("x1", 0), vb.get("y1", 0)
                        vx2, vy2 = vb.get("x2", frame.shape[1]), vb.get("y2", frame.shape[0])
                        if vx1 <= pbx <= vx2 and vy1 <= pby <= vy2:
                            matched_vdet = v_det
                            break
                    if matched_vdet is None and veh_detections:
                        matched_vdet = veh_detections[0]

                    v_tid = matched_vdet.get("track_id") if matched_vdet else (5000 + int((pbx * 3 + pby * 7) % 4000))
                    v_key = f"{camera_id}:{v_tid}"
                    v_track = self._vehicle_tracks.setdefault(v_key, VehicleTrackState(camera_id, v_tid))
                    v_track.last_seen = now_epoch

                    # Composite score calculation (Phase 7)
                    comp_score = (
                        0.40 * o_conf
                        + 0.25 * p_conf
                        + 0.20 * fmt_score
                        + 0.15 * min(1.0, len(v_track.ocr_history) / 3.0)
                    )

                    v_track.ocr_history.append({
                        "plate": clean_plate_str,
                        "score": comp_score,
                        "raw": raw_ocr,
                        "time": now_epoch,
                    })
                    if len(v_track.ocr_history) > 8:
                        v_track.ocr_history.pop(0)

                    # Temporal Plate Election (Phase 8)
                    plate_counts: Dict[str, int] = {}
                    plate_scores: Dict[str, float] = {}
                    for h_item in v_track.ocr_history:
                        p_str = h_item["plate"]
                        plate_counts[p_str] = plate_counts.get(p_str, 0) + 1
                        plate_scores[p_str] = max(plate_scores.get(p_str, 0.0), h_item["score"])

                    elected_plate, count = max(plate_counts.items(), key=lambda it: (it[1], plate_scores.get(it[0], 0.0)))
                    top_score = plate_scores.get(elected_plate, 0.0)

                    # Finalize plate when confidence is sufficient
                    if count >= 2 or top_score >= 0.80:
                        v_track.confirmed_plate = elected_plate
                        v_track.confirmed_score = top_score
                        reg_v = reg_vehicle_map.get(elected_plate)
                        if reg_v is not None and reg_v.status in ("FLAGGED", "WATCHLIST"):
                            v_track.confirmed_status = "FLAGGED"
                        elif reg_v is not None and reg_v.status == "KNOWN":
                            v_track.confirmed_status = "KNOWN"
                        else:
                            v_track.confirmed_status = "UNKNOWN"
                    else:
                        v_track.confirmed_status = "ANALYZING"
                        v_track.confirmed_plate = "Scanning..."

                    reg_v = reg_vehicle_map.get(clean_plate_str)
                    is_wl = bool(anpr_res.watchlist_match) or (reg_v is not None and reg_v.status in ("FLAGGED", "WATCHLIST"))
                    is_reg = reg_v is not None and reg_v.status == "KNOWN" and not is_wl

                    if p_conf > best_plate_conf:
                        best_plate_conf = p_conf
                    best_ocr_res = clean_plate_str
                    best_ocr_conf = o_conf
                    if is_reg or is_wl or v_track.confirmed_status == "KNOWN":
                        db_matched = "YES"

                    # Log Phase 19 diagnostics
                    cw = int(plate_bbox.get("x2", 0) - plate_bbox.get("x1", 0))
                    ch = int(plate_bbox.get("y2", 0) - plate_bbox.get("y1", 0))
                    if now_epoch - v_track.last_log_time > 2.0:
                        v_track.last_log_time = now_epoch
                        logger.info("[VEHICLE] track=%s confidence=%.2f", str(v_tid), p_conf)
                        logger.info(
                            '[PLATE] track=%s bbox=(%d,%d,%d,%d) | crop=%dx%d | OCR_RAW="%s" | OCR_NORMALIZED="%s" | OCR_CONF=%.2f | VALID=%s',
                            str(v_tid),
                            int(plate_bbox.get("x1", 0)),
                            int(plate_bbox.get("y1", 0)),
                            int(plate_bbox.get("x2", 0)),
                            int(plate_bbox.get("y2", 0)),
                            cw,
                            ch,
                            raw_ocr,
                            clean_plate_str,
                            o_conf,
                            "YES" if is_fmt_valid else "NO",
                        )
                        logger.info("[VEHICLE] %s plate=%s", v_track.confirmed_status, v_track.confirmed_plate)

                    # Update matched vehicle detection
                    if matched_vdet:
                        matched_vdet["plate_number"] = v_track.confirmed_plate
                        matched_vdet["plate_readable"] = bool(v_track.confirmed_plate and v_track.confirmed_plate != "Scanning...")
                        matched_vdet["is_known"] = (v_track.confirmed_status == "KNOWN")
                        matched_vdet["is_flagged"] = (v_track.confirmed_status in ("FLAGGED", "WATCHLIST"))
                        matched_vdet["status"] = v_track.confirmed_status
                        matched_vdet["confidence"] = round(top_score, 4) if top_score > 0 else matched_vdet.get("confidence", 0.90)

                        # Cooldown for alerts and evidence
                        if v_track.confirmed_status in ("UNKNOWN", "FLAGGED"):
                            if (now_epoch - v_track.last_alert_time) >= 10.0:
                                matched_vdet["should_emit_alert"] = True
                                v_track.last_alert_time = now_epoch
                            if (now_epoch - v_track.last_evidence_time) >= 10.0:
                                matched_vdet["should_capture_evidence"] = True
                                v_track.last_evidence_time = now_epoch

                    # Add ANPR plate detection to raw_detections list
                    raw_detections.append({
                        "track_id": v_tid,
                        "class_name": "license_plate",
                        "confidence": round(float(p_conf), 4),
                        "plate_number": clean_plate_str,
                        "raw_ocr_text": raw_ocr,
                        "plate_confidence": p_conf,
                        "ocr_confidence": o_conf,
                        "watchlist_match": is_wl,
                        "watchlist_status": anpr_res.watchlist_status,
                        "watchlist_reason": anpr_res.watchlist_reason,
                        "is_known": is_reg,
                        "is_flagged": is_wl,
                        "status": "FLAGGED" if is_wl else "KNOWN" if is_reg else "UNKNOWN",
                        "bbox": plate_bbox,
                        "position": None,
                    })

            except Exception as exc:
                logger.error("Error during Member 2 ANPR processing: %s", exc, exc_info=True)

        # Throttled ANPR diagnostic logging
        if now_epoch - self._last_vehicle_log_time > 2.5 or anpr_plates_count > 0:
            logger.info(
                "[ANPR] detector initialized: %s | plates detected: %d | best plate confidence: %.2f | OCR result: %s | OCR confidence: %.2f | database match: %s",
                "YES" if self.anpr_pipeline is not None else "NO",
                anpr_plates_count,
                best_plate_conf,
                best_ocr_res,
                best_ocr_conf,
                db_matched,
            )

        # 5. Cooldown-Protected Event Generation & Evidence Capture
        # A detection is NOT an event. Enforce 30-second cooldown per tracked entity.
        emitted_events: List[Dict[str, Any]] = []

        for det in raw_detections:
            status_str = str(det.get("status", "UNKNOWN")).upper()
            is_known = det.get("is_known", False) or (status_str == "KNOWN")
            cls_name = str(det.get("class_name", "")).lower()
            track_id = det.get("track_id")
            plate = det.get("plate_number")
            det_bbox = det.get("bbox") or {}
            conf = float(det.get("confidence", 0.85))

            # KNOWN entities NEVER create alerts, events, or evidence
            if is_known:
                continue

            # Construct unique tracking key
            entity_id = track_id if track_id is not None else (plate if plate else "untracked")
            cooldown_key = f"{camera_id}:{cls_name}:{entity_id}"

            # Check 30-second cooldown per tracked entity
            last_event_t = self._event_cooldown_cache.get(cooldown_key, 0.0)
            should_emit_event = (now_epoch - last_event_t) >= self._cooldown_seconds

            if should_emit_event:
                self._event_cooldown_cache[cooldown_key] = now_epoch

                # Determine specific event type
                if cls_name == "person":
                    event_type_str = "FLAGGED_PERSON" if status_str == "FLAGGED" else "UNKNOWN_PERSON"
                    p_name = det.get("person_name", "Flagged Person" if status_str == "FLAGGED" else "Unknown")
                    meta_dict = {
                        "track_id": track_id,
                        "class_name": "person",
                        "person_name": p_name,
                        "is_known": False,
                        "status": status_str,
                        "bbox": [det_bbox.get("x1", 0), det_bbox.get("y1", 0), det_bbox.get("x2", 0), det_bbox.get("y2", 0)],
                    }
                    ev_payload = {
                        "camera_id": camera_id,
                        "event_type": event_type_str,
                        "timestamp": now_str,
                        "confidence": round(conf, 4),
                        "metadata": meta_dict,
                    }
                    db_ev = Event(
                        camera_id=camera_id,
                        event_type=event_type_str,
                        timestamp=now_str,
                        confidence=round(conf, 4),
                        event_metadata=meta_dict,
                    )
                    db.add(db_ev)
                    emitted_events.append(ev_payload)

                    # Capture single evidence photo for this event
                    try:
                        ev_record = evidence_svc.capture_evidence(
                            frame=frame,
                            camera_id=camera_id,
                            detection_type="person",
                            status=status_str,
                            confidence=conf,
                            bbox=det_bbox,
                            track_id=track_id,
                            person_id=det.get("person_id"),
                            reason=f"Flagged individual '{p_name}' detected" if status_str == "FLAGGED" else "Unregistered individual in camera zone",
                            db=db,
                        )
                        if ev_record is not None:
                            det["evidence_image"] = ev_record.image_path
                            det["evidence_id"] = ev_record.id
                    except Exception as ev_err:
                        logger.warning("Evidence capture failed: %s", ev_err)

                elif cls_name in ("car", "motorcycle", "bus", "truck", "vehicle") or (cls_name == "license_plate" and not any(d.get("class_name") in ("car", "truck", "bus", "motorcycle", "vehicle") for d in raw_detections)):
                    event_type_str = "FLAGGED_VEHICLE" if status_str == "FLAGGED" else "UNKNOWN_VEHICLE"
                    meta_dict = {
                        "track_id": track_id,
                        "class_name": cls_name,
                        "plate_number": plate,
                        "is_known": False,
                        "status": status_str,
                        "bbox": [det_bbox.get("x1", 0), det_bbox.get("y1", 0), det_bbox.get("x2", 0), det_bbox.get("y2", 0)],
                    }
                    ev_payload = {
                        "camera_id": camera_id,
                        "event_type": event_type_str,
                        "timestamp": now_str,
                        "confidence": round(conf, 4),
                        "metadata": meta_dict,
                    }
                    db_ev = Event(
                        camera_id=camera_id,
                        event_type=event_type_str,
                        timestamp=now_str,
                        confidence=round(conf, 4),
                        event_metadata=meta_dict,
                    )
                    db.add(db_ev)
                    emitted_events.append(ev_payload)

                    # Capture single evidence photo for this vehicle event
                    try:
                        ev_record = evidence_svc.capture_evidence(
                            frame=frame,
                            camera_id=camera_id,
                            detection_type="vehicle",
                            status=status_str,
                            confidence=conf,
                            bbox=det_bbox,
                            track_id=track_id,
                            plate_number=plate,
                            reason=det.get("watchlist_reason") if status_str == "FLAGGED" else "Unregistered vehicle detected",
                            db=db,
                        )
                        if ev_record is not None:
                            det["evidence_image"] = ev_record.image_path
                            det["evidence_id"] = ev_record.id
                    except Exception as ev_err:
                        logger.warning("Evidence capture failed for vehicle: %s", ev_err)

        # 6. Commit unified events and correlate threats in a single database transaction
        correlated_threat_dict = None
        if emitted_events:
            try:
                from app.services.threat_correlation_service import ThreatCorrelationService
                correlator = ThreatCorrelationService.get_instance()
                threat = correlator.correlate_frame_events(
                    frame_events=emitted_events,
                    camera_id=camera_id,
                    db=db,
                )

                db.commit()

                if threat is not None:
                    correlated_threat_dict = {
                        "id": threat.id,
                        "threat_id": threat.threat_id,
                        "camera_id": threat.camera_id,
                        "severity": threat.severity,
                        "score": threat.score,
                        "title": threat.title,
                        "reason": threat.reason,
                        "status": threat.status,
                        "first_event_time": threat.first_event_time,
                        "last_event_time": threat.last_event_time,
                        "event_count": threat.event_count,
                    }
            except Exception as e:
                db.rollback()
                logger.error("Failed to persist AI events or correlate threats: %s", e)

        total_ai_ms = (time.perf_counter() - t_frame_start) * 1000.0
        logger.info(
            "AI FRAME PERF | Total: %.1fms | CV Track: %.1fms | Face: %.1fms | Detections: %d | Emitted Events: %d",
            total_ai_ms,
            t_cv_ms,
            t_face_ms,
            len(raw_detections),
            len(emitted_events),
        )

        return {
            "status": "success",
            "camera_id": camera_id,
            "processed": True,
            "detections_count": len(raw_detections),
            "detections": raw_detections,
            "events_count": len(emitted_events),
            "events": emitted_events,
            "correlated_threat": correlated_threat_dict,
        }
