"""
evidence_service.py — Service for capturing, cropping, deduplicating, and persisting
evidence images for UNKNOWN and FLAGGED detections.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.config import EVIDENCE_DIR
from app.models import Evidence

logger = logging.getLogger("ibvap.evidence_service")


class EvidenceService:
    """
    EvidenceService manages the persistent capture and lifecycle of UNKNOWN
    and FLAGGED visual surveillance evidence.
    """

    _instance: Optional[EvidenceService] = None

    def __init__(self) -> None:
        self.evidence_dir = Path(EVIDENCE_DIR)
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        # Deduplication cache: key -> timestamp (epoch seconds)
        self._cooldown_cache: Dict[str, float] = {}
        self.cooldown_seconds: float = 30.0  # 30-second deduplication cooldown per track
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="evidence_writer")

    @classmethod
    def get_instance(cls) -> EvidenceService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _should_capture(self, camera_id: str, detection_type: str, dedupe_key: str) -> bool:
        """Check cooldown window to prevent storing duplicate frames during continuous presence."""
        key = f"{camera_id}:{detection_type}:{dedupe_key}"
        now = time.time()
        last_time = self._cooldown_cache.get(key)
        if last_time and (now - last_time) < self.cooldown_seconds:
            return False
        self._cooldown_cache[key] = now
        return True

    def _save_image_async(self, file_path: Path, image_data: np.ndarray, quality: int = 85) -> None:
        """Write JPEG image asynchronously in background thread."""
        try:
            cv2.imwrite(str(file_path), image_data, [cv2.IMWRITE_JPEG_QUALITY, quality])
        except Exception as exc:
            logger.error("[EVIDENCE ASYNC ERROR] Failed writing evidence file %s: %s", file_path, exc)

    def capture_evidence(
        self,
        frame: np.ndarray,
        camera_id: str,
        detection_type: str,  # 'person' or 'vehicle'
        status: str,  # 'UNKNOWN' or 'FLAGGED'
        confidence: float,
        bbox: Optional[Dict[str, float]] = None,
        track_id: Optional[int] = None,
        plate_number: Optional[str] = None,
        person_id: Optional[str] = None,
        vehicle_id: Optional[str] = None,
        reason: Optional[str] = None,
        event_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Optional[Evidence]:
        """
        Capture current frame and bounding box crop for UNKNOWN or FLAGGED detection.
        Saves JPEG images asynchronously and records row in SQLite database.
        """
        if status.upper() == "KNOWN":
            return None  # Known person/vehicle NEVER captures evidence

        # Deduplication key based on: camera_id + track_id/plate/person_id + event type
        if track_id is not None:
            dedupe_key = f"track_{track_id}"
        elif plate_number:
            dedupe_key = f"plate_{plate_number.replace(' ', '').upper()}"
        elif person_id:
            dedupe_key = f"person_{person_id}"
        elif bbox and isinstance(bbox, dict) and "track_id" in bbox:
            dedupe_key = f"track_{bbox['track_id']}"
        else:
            bx = int(bbox.get("x1", 0) // 100) if (bbox and isinstance(bbox, dict)) else 0
            by = int(bbox.get("y1", 0) // 100) if (bbox and isinstance(bbox, dict)) else 0
            dedupe_key = f"pos_{bx}_{by}"

        if not self._should_capture(camera_id, detection_type, dedupe_key):
            return None

        try:
            now_dt = datetime.now(timezone.utc)
            timestamp_iso = now_dt.isoformat()
            ts_compact = now_dt.strftime("%Y%m%d_%H%M%S")
            short_id = uuid.uuid4().hex[:6]
            clean_cam = camera_id.replace(":", "-").replace("/", "-")
            det_tag = f"{detection_type}_{status.lower()}"

            # 1. Asynchronously Save Full Frame
            full_filename = f"{clean_cam}_{ts_compact}_{det_tag}_{short_id}.jpg"
            full_path = self.evidence_dir / full_filename
            frame_copy = frame.copy()
            self._executor.submit(self._save_image_async, full_path, frame_copy, 85)

            # 2. Save Crop Image if valid bbox is provided
            crop_filename: Optional[str] = None
            bx1, by1, bx2, by2 = None, None, None, None

            if bbox and isinstance(bbox, dict):
                x1 = int(max(0, bbox.get("x1", 0)))
                y1 = int(max(0, bbox.get("y1", 0)))
                x2 = int(min(frame.shape[1], bbox.get("x2", frame.shape[1])))
                y2 = int(min(frame.shape[0], bbox.get("y2", frame.shape[0])))

                if x2 > x1 and y2 > y1:
                    bx1, by1, bx2, by2 = float(x1), float(y1), float(x2), float(y2)
                    # Add 5% margin to crop
                    pad_x = int((x2 - x1) * 0.05)
                    pad_y = int((y2 - y1) * 0.05)
                    cx1 = max(0, x1 - pad_x)
                    cy1 = max(0, y1 - pad_y)
                    cx2 = min(frame.shape[1], x2 + pad_x)
                    cy2 = min(frame.shape[0], y2 + pad_y)

                    cropped_img = frame[cy1:cy2, cx1:cx2].copy()
                    if cropped_img.size > 0:
                        crop_filename = f"{clean_cam}_{ts_compact}_{det_tag}_{short_id}_crop.jpg"
                        crop_path = self.evidence_dir / crop_filename
                        self._executor.submit(self._save_image_async, crop_path, cropped_img, 90)

            # 3. Persist row in DB
            image_url_path = f"/evidence/{full_filename}"
            crop_url_path = f"/evidence/{crop_filename}" if crop_filename else None

            evidence_record = Evidence(
                camera_id=camera_id,
                timestamp=timestamp_iso,
                detection_type=detection_type.lower(),
                status=status.upper(),
                confidence=round(float(confidence), 4),
                image_path=image_url_path,
                crop_image_path=crop_url_path,
                bbox_x1=bx1,
                bbox_y1=by1,
                bbox_x2=bx2,
                bbox_y2=by2,
                person_id=person_id,
                vehicle_id=vehicle_id,
                plate_number=plate_number,
                reason=reason or (
                    "Watchlist target match"
                    if status.upper() == "FLAGGED" and detection_type.lower() == "vehicle"
                    else "Flagged individual detected"
                    if status.upper() == "FLAGGED"
                    else "Unregistered target detected"
                ),
                event_id=event_id,
            )

            if db is not None:
                db.add(evidence_record)
                db.commit()
                db.refresh(evidence_record)

            logger.info(
                "Captured evidence [%s] for %s on %s (file: %s)",
                status,
                detection_type,
                camera_id,
                full_filename,
            )
            return evidence_record

        except Exception as exc:
            logger.error("Failed to capture evidence: %s", exc)
            return None

    def get_evidence_list(
        self,
        db: Session,
        limit: int = 50,
        offset: int = 0,
        camera_id: Optional[str] = None,
        detection_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Evidence]:
        """Fetch list of evidence records with optional filters."""
        query = db.query(Evidence)
        if camera_id:
            query = query.filter(Evidence.camera_id == camera_id)
        if detection_type:
            query = query.filter(Evidence.detection_type == detection_type.lower())
        if status:
            query = query.filter(Evidence.status == status.upper())
        return query.order_by(Evidence.id.desc()).offset(offset).limit(limit).all()

    def get_evidence_count(
        self,
        db: Session,
        camera_id: Optional[str] = None,
        detection_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> int:
        """Count evidence records matching filters."""
        query = db.query(Evidence)
        if camera_id:
            query = query.filter(Evidence.camera_id == camera_id)
        if detection_type:
            query = query.filter(Evidence.detection_type == detection_type.lower())
        if status:
            query = query.filter(Evidence.status == status.upper())
        return query.count()

    def get_evidence_by_id(self, db: Session, evidence_id: int) -> Optional[Evidence]:
        """Retrieve single evidence record by ID."""
        return db.query(Evidence).filter(Evidence.id == evidence_id).first()

    def delete_evidence(self, db: Session, evidence_id: int) -> bool:
        """Delete evidence record and associated image files."""
        item = self.get_evidence_by_id(db, evidence_id)
        if not item:
            return False

        # Remove image files from disk if they exist
        try:
            if item.image_path:
                img_name = Path(item.image_path).name
                file_p = self.evidence_dir / img_name
                if file_p.exists():
                    file_p.unlink()

            if item.crop_image_path:
                crop_name = Path(item.crop_image_path).name
                crop_p = self.evidence_dir / crop_name
                if crop_p.exists():
                    crop_p.unlink()
        except Exception as exc:
            logger.warning("Error deleting evidence image file: %s", exc)

        db.delete(item)
        db.commit()
        return True
