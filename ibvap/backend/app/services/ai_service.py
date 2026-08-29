"""
ai_service.py — Backend integration service connecting live video/webcam frames to Member 1 CV and Member 2 ANPR pipelines.
"""

from __future__ import annotations

import logging
import os
import sys
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
    from ai.member2_anpr.recognizer import PlateRecognizer
    from ai.member2_anpr.watchlist import InMemoryWatchlistMatcher
    from ai.member2_anpr.event_generator import ANPREventGenerator
    from ai.member2_anpr.suppressor import DuplicateSuppressor
    from ai.member2_anpr.config import default_config as anpr_default_config
    MEMBER2_AVAILABLE = True
except Exception as exc:
    MEMBER2_AVAILABLE = False
    logger.warning("Member 2 ANPR modules could not be directly imported: %s", exc)


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
        Process a single image frame through Member 1 CV and Member 2 ANPR pipelines.
        """
        if not self._initialized:
            self.initialize()

        logger.info(
            "[ANPR DEBUG] AIService.process_frame invoked: camera_id=%s, payload_size=%d bytes",
            camera_id,
            len(image_bytes),
        )

        # 1. Decode image safely
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            logger.error("[ANPR DEBUG] Image decoding failed; zero-size array")
            raise ValueError("Corrupted or unreadable image frame data.")

        logger.info("[ANPR DEBUG] Decoded frame shape: %s", frame.shape)

        detections: List[Any] = []
        raw_detections: List[Dict[str, Any]] = []

        # 2. Run inference & tracking if tracker is available (Member 1)
        if self.tracker is not None:
            try:
                detections = self.tracker.track(frame)
            except Exception as e:
                logger.error("Error during tracker.track(): %s", e)
                detections = []

        for det in detections:
            raw_detections.append(det.as_dict())

        # 2b. Face Recognition & Vehicle Registry Lookup on Detected Objects
        from app.models import Person, RegisteredVehicle
        from app.services.face_recognition_service import FaceRecognitionService
        from app.services.evidence_service import EvidenceService

        face_service = FaceRecognitionService.get_instance()
        evidence_svc = EvidenceService.get_instance()

        registered_people = db.query(Person).all()
        registered_vehicles = db.query(RegisteredVehicle).all()
        reg_vehicle_map = {v.plate_number.replace(" ", "").upper(): v for v in registered_vehicles}

        for det in raw_detections:
            cls_name = str(det.get("class_name", "")).lower()
            track_id = det.get("track_id")
            bbox = det.get("bbox") or {}

            # --- Person Processing with Face Recognition & ByteTrack Caching ---
            # --- Person Processing with Face Recognition & Temporal Identity Stabilization ---
            if cls_name == "person":
                stab = face_service.process_person_detection(
                    frame=frame,
                    camera_id=camera_id,
                    bbox=bbox,
                    registered_people=registered_people,
                    track_id=track_id,
                )
                det["is_known"] = stab["is_known"]
                det["is_flagged"] = stab["is_flagged"]
                det["person_name"] = stab["person_name"]
                det["person_id"] = stab["person_id"]
                det["status"] = stab["status"]
                det["face_similarity"] = stab["face_similarity"]
                det["should_emit_alert"] = stab["should_emit_alert"]
                det["should_capture_evidence"] = stab["should_capture_evidence"]

            # --- Vehicle Processing with License Plate Registry Lookup ---
            elif det.get("plate_number") or cls_name in ("license_plate", "car", "truck", "bus", "vehicle"):
                plate = det.get("plate_number")
                clean_p = plate.replace(" ", "").upper() if plate else ""
                reg_v = reg_vehicle_map.get(clean_p)
                is_watchlist = bool(det.get("watchlist_match")) or (reg_v is not None and reg_v.status in ("FLAGGED", "WATCHLIST"))

                if is_watchlist:
                    det["is_known"] = False
                    det["is_flagged"] = True
                    det["status"] = "FLAGGED"
                    det["watchlist_match"] = True
                elif reg_v is not None and reg_v.status == "KNOWN":
                    det["is_known"] = True
                    det["is_flagged"] = False
                    det["status"] = "KNOWN"
                else:
                    det["is_known"] = False
                    det["is_flagged"] = False
                    det["status"] = "UNKNOWN"

        # 3. Analyze Member 1 events & intrusions
        analytics_events: List[Any] = []
        intrusion_events: List[Any] = []

        if self.event_analyzer is not None and detections:
            analytics_events = self.event_analyzer.process(detections)

        if self.intrusion_detector is not None and detections:
            intrusion_events = self.intrusion_detector.process(detections)

        emitted_events: List[Dict[str, Any]] = []
        now_str = datetime.now(timezone.utc).isoformat()

        # 4. Format and persist Member 1 analytics events
        for a_ev in analytics_events:
            # Map raw PERSON_DETECTED to specific UNKNOWN_PERSON / FLAGGED_PERSON if applicable
            corresp_det = next((d for d in raw_detections if d.get("track_id") == a_ev.track_id), None)
            final_event_type = a_ev.event_type
            is_known_flag = False
            person_name_val = "Unknown"
            status_val = "NORMAL"

            if corresp_det and corresp_det.get("class_name") == "person":
                if corresp_det.get("status") == "FLAGGED":
                    final_event_type = "FLAGGED_PERSON"
                    person_name_val = corresp_det.get("person_name", "Flagged Person")
                    status_val = "FLAGGED"
                elif corresp_det.get("status") == "KNOWN":
                    final_event_type = "PERSON_DETECTED"
                    is_known_flag = True
                    person_name_val = corresp_det.get("person_name", "Known Person")
                    status_val = "KNOWN"
                else:
                    if corresp_det and corresp_det.get("should_emit_alert", True):
                        final_event_type = "UNKNOWN_PERSON"
                        status_val = "UNKNOWN"
                    else:
                        final_event_type = "OBJECT_DETECTED"
                        status_val = "PENDING"

            event_payload = {
                "camera_id": camera_id,
                "event_type": final_event_type,
                "timestamp": a_ev.timestamp or now_str,
                "confidence": round(float(a_ev.confidence), 4),
                "metadata": {
                    "track_id": a_ev.track_id,
                    "class_name": a_ev.class_name,
                    "person_name": person_name_val,
                    "is_known": is_known_flag,
                    "status": status_val,
                    "bbox": [
                        a_ev.bbox["x1"],
                        a_ev.bbox["y1"],
                        a_ev.bbox["x2"],
                        a_ev.bbox["y2"],
                    ],
                    "position": a_ev.position,
                },
            }

            db_event = Event(
                camera_id=camera_id,
                event_type=final_event_type,
                timestamp=event_payload["timestamp"],
                confidence=event_payload["confidence"],
                event_metadata=event_payload["metadata"],
            )
            db.add(db_event)
            emitted_events.append(event_payload)

        # 5. Format and persist Member 1 intrusion events
        for i_ev in intrusion_events:
            event_payload = {
                "camera_id": camera_id,
                "event_type": "INTRUSION_DETECTED",
                "timestamp": i_ev.timestamp or now_str,
                "confidence": round(float(i_ev.confidence), 4),
                "metadata": {
                    "track_id": i_ev.track_id,
                    "class_name": i_ev.class_name,
                    "bbox": [
                        i_ev.bbox["x1"],
                        i_ev.bbox["y1"],
                        i_ev.bbox["x2"],
                        i_ev.bbox["y2"],
                    ],
                    "position": i_ev.position,
                    "fence_zone": "Default Perimeter Buffer Zone",
                },
            }

            db_event = Event(
                camera_id=camera_id,
                event_type="INTRUSION_DETECTED",
                timestamp=event_payload["timestamp"],
                confidence=event_payload["confidence"],
                event_metadata=event_payload["metadata"],
            )
            db.add(db_event)
            emitted_events.append(event_payload)

        # 6. Run Member 2 ANPR Pipeline on the SAME frame
        if self.anpr_pipeline is not None:
            try:
                anpr_results = self.anpr_pipeline.process_frame(
                    frame=frame,
                    camera_id=camera_id,
                    timestamp=now_str,
                )

                for anpr_res in anpr_results:
                    if anpr_res.error:
                        continue

                    plate_bbox = anpr_res.bbox if anpr_res.bbox else {"x1": 0, "y1": 0, "x2": 0, "y2": 0}
                    clean_plate_str = anpr_res.plate_number.replace(" ", "").upper() if anpr_res.plate_number else ""
                    reg_v = reg_vehicle_map.get(clean_plate_str)
                    is_wl = bool(anpr_res.watchlist_match) or (reg_v is not None and reg_v.status in ("FLAGGED", "WATCHLIST"))
                    is_reg = reg_v is not None and reg_v.status == "KNOWN" and not is_wl

                    # Add ANPR plate detection to raw_detections for live HUD overlay
                    if anpr_res.plate_number:
                        raw_detections.append({
                            "track_id": None,
                            "class_name": "license_plate",
                            "confidence": round(float(anpr_res.plate_confidence or anpr_res.ocr_confidence or 0.9), 4),
                            "plate_number": anpr_res.plate_number,
                            "raw_ocr_text": anpr_res.event.metadata.get("raw_ocr_text") if anpr_res.event else None,
                            "plate_confidence": anpr_res.plate_confidence,
                            "ocr_confidence": anpr_res.ocr_confidence,
                            "watchlist_match": is_wl,
                            "watchlist_status": anpr_res.watchlist_status,
                            "watchlist_reason": anpr_res.watchlist_reason,
                            "is_known": is_reg,
                            "is_flagged": is_wl,
                            "status": "FLAGGED" if is_wl else "KNOWN" if is_reg else "UNKNOWN",
                            "bbox": plate_bbox,
                            "position": None,
                        })

                    # If an event was generated and is NOT duplicate-suppressed, persist to SQLite
                    if anpr_res.event is not None and not anpr_res.duplicate_suppressed:
                        ev_type_str = (
                            "WATCHLIST_MATCH"
                            if is_wl
                            else "ANPR_DETECTED"
                        )

                        event_payload = {
                            "camera_id": camera_id,
                            "event_type": ev_type_str,
                            "timestamp": anpr_res.event.timestamp or now_str,
                            "confidence": round(float(anpr_res.event.confidence), 4),
                            "metadata": {
                                **dict(anpr_res.event.metadata or {}),
                                "is_known": is_reg,
                                "is_flagged": is_wl,
                                "status": "FLAGGED" if is_wl else "KNOWN" if is_reg else "UNKNOWN",
                            },
                        }

                        db_event = Event(
                            camera_id=camera_id,
                            event_type=ev_type_str,
                            timestamp=event_payload["timestamp"],
                            confidence=event_payload["confidence"],
                            event_metadata=event_payload["metadata"],
                        )
                        db.add(db_event)
                        emitted_events.append(event_payload)
            except Exception as exc:
                logger.error("Error during Member 2 ANPR processing: %s", exc)

        # 6b. Capture Evidence Photos and Crops ONLY for UNKNOWN / FLAGGED detections
        try:
            for det in raw_detections:
                status_str = det.get("status", "UNKNOWN")
                if status_str == "KNOWN" or det.get("is_known"):
                    continue  # Known detections NEVER capture evidence or create alerts

                cls_name = str(det.get("class_name", "")).lower()
                plate = det.get("plate_number")
                det_bbox = det.get("bbox") or {}
                conf = float(det.get("confidence", 0.85))

                if plate or cls_name in ("license_plate", "car", "truck", "bus", "vehicle"):
                    evidence_svc.capture_evidence(
                        frame=frame,
                        camera_id=camera_id,
                        detection_type="vehicle",
                        status=status_str,
                        confidence=conf,
                        bbox=det_bbox,
                        plate_number=plate,
                        reason=det.get("watchlist_reason") if status_str == "FLAGGED" else "Unregistered vehicle detected",
                        db=db,
                    )
                elif cls_name == "person":
                    if det.get("should_capture_evidence", True):
                        evidence_svc.capture_evidence(
                            frame=frame,
                            camera_id=camera_id,
                            detection_type="person",
                            status=status_str,
                            confidence=conf,
                            bbox=det_bbox,
                            person_id=det.get("person_id"),
                            reason=f"Flagged individual '{det.get('person_name')}' detected" if status_str == "FLAGGED" else "Unregistered individual in camera zone",
                            db=db,
                        )
        except Exception as ev_exc:
            logger.warning("Evidence capture hook encountered error: %s", ev_exc)

        # 7. Commit unified events and correlate threats in a single database transaction
        correlated_threat_dict = None
        if emitted_events:
            try:
                db.flush()
                # Populate database IDs in emitted_events for relation linking
                for idx, ev_dict in enumerate(emitted_events):
                    # Events were added in order
                    pass

                # Run unified event correlation
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
