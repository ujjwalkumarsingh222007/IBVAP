"""
face_recognition_service.py — Multi-angle face detection (frontal + profile head turns),
high-precision zero-centered embeddings, periodic inference caching, and temporal identity stabilization.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.config import FACE_RECOGNITION_THRESHOLD, FACES_DIR
from app.models import Person

logger = logging.getLogger("ibvap.face_recognition")


@dataclass
class TrackIdentityState:
    """Temporal identity tracking and stabilization state for an active person track."""
    track_id: int
    camera_id: str
    first_seen: float
    last_seen: float
    last_bbox: Tuple[float, float, float, float]

    # Frame and streak tracking
    frame_count: int = 0
    missed_frames: int = 0
    known_streak: int = 0
    unknown_streak: int = 0
    flagged_streak: int = 0

    # Confirmed persistent identity
    confirmed_status: str = "PENDING"  # PENDING, KNOWN, FLAGGED, UNKNOWN
    confirmed_person: Optional[Dict[str, Any]] = None
    confirmed_similarity: float = 0.0

    # Notification & evidence capture state
    alert_emitted: bool = False
    evidence_captured: bool = False
    last_evidence_time: float = 0.0
    last_alert_time: float = 0.0
    last_recognition_time: float = 0.0


class FaceRecognitionService:
    """
    Singleton service providing OpenCV Multi-Angle Face Detection (frontal + profile turns),
    high-resolution zero-centered discriminative feature embeddings, cosine similarity matching,
    and multi-frame temporal identity stabilization with tracking grace periods.
    """

    _instance: Optional[FaceRecognitionService] = None

    def __init__(self, threshold: float = FACE_RECOGNITION_THRESHOLD) -> None:
        self.threshold = threshold
        self.faces_dir = Path(FACES_DIR)
        self.faces_dir.mkdir(parents=True, exist_ok=True)

        # 1. Frontal Cascades
        cascade_front_default = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade_front_alt2 = cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"
        cascade_profile = cv2.data.haarcascades + "haarcascade_profileface.xml"

        self.frontal_cascade = cv2.CascadeClassifier(cascade_front_default)
        self.frontal_alt2 = cv2.CascadeClassifier(cascade_front_alt2)
        self.profile_cascade = cv2.CascadeClassifier(cascade_profile)

        # Temporal identity tracker: track_key -> TrackIdentityState
        self._tracks: Dict[str, TrackIdentityState] = {}
        self.track_ttl_seconds: float = 10.0
        self.unknown_confirmation_frames: int = 3
        self.known_confirmation_frames: int = 2
        self.grace_period_frames: int = 8
        self.recognition_interval_frames: int = 4

    @classmethod
    def get_instance(cls) -> FaceRecognitionService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # -----------------------------------------------------------------------
    # Database Embedding Migration / Sync Helper
    # -----------------------------------------------------------------------

    def sync_registered_embeddings(self, db: Session) -> int:
        """
        Recompute embeddings for registered persons from their saved face photos
        to ensure all stored embeddings strictly match the current feature representation.
        """
        people = db.query(Person).all()
        updated_count = 0
        for p in people:
            if p.face_image_path:
                rel_path = p.face_image_path.lstrip("/").replace("media/faces/", "")
                img_path = self.faces_dir / rel_path
                if img_path.exists():
                    img_bgr = cv2.imread(str(img_path))
                    if img_bgr is not None:
                        new_emb = self.extract_embedding(img_bgr)
                        if new_emb:
                            p.face_embedding = new_emb
                            updated_count += 1
        if updated_count > 0:
            db.commit()
            logger.info("Synced %d registered face embeddings with current descriptor.", updated_count)
        return updated_count

    # -----------------------------------------------------------------------
    # Multi-Angle Face Detection (Frontal + Left/Right Profile Turns)
    # -----------------------------------------------------------------------

    def detect_faces(
        self, image_bgr: np.ndarray, min_size: Tuple[int, int] = (30, 30)
    ) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces across multiple head angles:
        1. Frontal faces (frontalface_alt2 + frontalface_default)
        2. Left profile head turns (profileface)
        3. Right profile head turns (flipped profileface)
        Returns de-duplicated list of (x, y, w, h) bounding boxes.
        """
        if image_bgr is None or image_bgr.size == 0:
            return []

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        h_img, w_img = gray.shape[:2]

        raw_faces: List[Tuple[int, int, int, int]] = []

        # 1. Frontal detection (alt2 first for high precision, then default)
        if not self.frontal_alt2.empty():
            f_alt2 = self.frontal_alt2.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=3, minSize=min_size, flags=cv2.CASCADE_SCALE_IMAGE
            )
            for (x, y, w, h) in f_alt2:
                raw_faces.append((int(x), int(y), int(w), int(h)))

        if not raw_faces and not self.frontal_cascade.empty():
            f_def = self.frontal_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=3, minSize=min_size, flags=cv2.CASCADE_SCALE_IMAGE
            )
            for (x, y, w, h) in f_def:
                raw_faces.append((int(x), int(y), int(w), int(h)))

        # 2. Profile detection (left head turn)
        if not self.profile_cascade.empty():
            p_left = self.profile_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=3, minSize=min_size, flags=cv2.CASCADE_SCALE_IMAGE
            )
            for (x, y, w, h) in p_left:
                raw_faces.append((int(x), int(y), int(w), int(h)))

            # 3. Flipped profile detection (right head turn)
            flipped_gray = cv2.flip(gray, 1)
            p_right = self.profile_cascade.detectMultiScale(
                flipped_gray, scaleFactor=1.1, minNeighbors=3, minSize=min_size, flags=cv2.CASCADE_SCALE_IMAGE
            )
            for (fx, fy, fw, fh) in p_right:
                orig_x = w_img - (fx + fw)
                raw_faces.append((int(orig_x), int(fy), int(fw), int(fh)))

        if not raw_faces:
            return []

        # De-duplicate overlapping boxes with Non-Maximum Suppression (NMS)
        boxes = [[x, y, x + w, y + h] for (x, y, w, h) in raw_faces]
        kept: List[Tuple[int, int, int, int]] = []

        while boxes:
            b = boxes.pop(0)
            kept.append((b[0], b[1], b[2] - b[0], b[3] - b[1]))
            remaining: List[List[int]] = []
            for other in boxes:
                ixA = max(b[0], other[0])
                iyA = max(b[1], other[1])
                ixB = min(b[2], other[2])
                iyB = min(b[3], other[3])
                interW = max(0, ixB - ixA)
                interH = max(0, iyB - iyA)
                interArea = interW * interH
                areaB = (b[2] - b[0]) * (b[3] - b[1])
                areaOther = (other[2] - other[0]) * (other[3] - other[1])
                unionArea = areaB + areaOther - interArea
                iou = interArea / float(unionArea) if unionArea > 0 else 0
                if iou < 0.35:
                    remaining.append(other)
            boxes = remaining

        return kept

    def validate_registration_face(
        self, image_bgr: np.ndarray
    ) -> Tuple[bool, str, Optional[Tuple[int, int, int, int]]]:
        """
        Validate single-face requirement for person registration:
        - 0 faces -> (False, "Face not detected", None)
        - >1 faces -> (False, "Please keep only one person in frame", None)
        - 1 face -> (True, "Face detected ✓", (x, y, w, h))
        """
        faces = self.detect_faces(image_bgr, min_size=(40, 40))
        if len(faces) == 0:
            return False, "Face not detected", None
        if len(faces) > 1:
            return False, "Please keep only one person in frame", None
        return True, "Face detected ✓", faces[0]

    # -----------------------------------------------------------------------
    # High-Precision Zero-Centered Feature Embedding Generation
    # -----------------------------------------------------------------------

    def extract_embedding(
        self, image_bgr: np.ndarray, face_bbox: Optional[Tuple[int, int, int, int]] = None
    ) -> Optional[List[float]]:
        """
        Extract high-resolution, zero-centered, unit-normalized feature embedding vector.
        CRITICAL: Requires a true face detection. If no face is found, returns None
        so unknown individuals or non-face crops are NEVER falsely matched as known.
        """
        if image_bgr is None or image_bgr.size == 0:
            return None

        face_crop: Optional[np.ndarray] = None

        if face_bbox is not None:
            x, y, w, h = face_bbox
            x1 = max(0, x)
            y1 = max(0, y)
            x2 = min(image_bgr.shape[1], x + w)
            y2 = min(image_bgr.shape[0], y + h)
            if x2 > x1 and y2 > y1:
                face_crop = image_bgr[y1:y2, x1:x2]
        else:
            # 1. Try multi-angle face detection
            faces = self.detect_faces(image_bgr, min_size=(30, 30))
            if faces:
                x, y, w, h = faces[0]
                face_crop = image_bgr[y:y+h, x:x+w]
            else:
                # 2. Upper 45% head region fallback for full-body person crops
                h_img, w_img = image_bgr.shape[:2]
                if h_img >= 60 and w_img >= 30:
                    head_region = image_bgr[0:int(h_img * 0.45), :]
                    head_faces = self.detect_faces(head_region, min_size=(25, 25))
                    if head_faces:
                        hx, hy, hw, hh = head_faces[0]
                        face_crop = head_region[hy:hy+hh, hx:hx+hw]

        # If still no face detected, return None (NO guessing on torso or background)
        if face_crop is None or face_crop.size == 0:
            return None

        try:
            if len(face_crop.shape) == 3:
                gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            else:
                gray = face_crop.copy()

            # Normalize size and equalize contrast
            resized = cv2.resize(gray, (128, 128), interpolation=cv2.INTER_AREA)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            norm_gray = clahe.apply(resized)

            features: List[float] = []

            # 1. High-resolution 8x8 spatial grid cell gradients (16x16 pixels per cell)
            cell_size = 16
            grid = 8

            gx = cv2.Sobel(norm_gray, cv2.CV_32F, 1, 0, ksize=3)
            gy = cv2.Sobel(norm_gray, cv2.CV_32F, 0, 1, ksize=3)
            mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

            for r in range(grid):
                for c in range(grid):
                    cell_mag = mag[r*cell_size:(r+1)*cell_size, c*cell_size:(c+1)*cell_size]
                    cell_ang = ang[r*cell_size:(r+1)*cell_size, c*cell_size:(c+1)*cell_size]
                    cell_gray = norm_gray[r*cell_size:(r+1)*cell_size, c*cell_size:(c+1)*cell_size]

                    # HOG 8-bin histogram per cell
                    hist, _ = np.histogram(cell_ang, bins=8, range=(0, 360), weights=cell_mag)
                    h_norm = np.linalg.norm(hist) + 1e-5
                    features.extend((hist / h_norm).tolist())

                    # Cell intensity variance
                    features.append(float(np.std(cell_gray)) / 64.0)

            # 2. Local Binary Patterns (LBP) on 4x4 spatial blocks
            padded = np.pad(norm_gray, 1, mode='edge')
            center = padded[1:-1, 1:-1]
            lbp = np.zeros_like(norm_gray, dtype=np.uint8)
            shifts = [(-1,-1), (-1,0), (-1,1), (0,1), (1,1), (1,0), (1,-1), (0,-1)]
            for bit, (dr, dc) in enumerate(shifts):
                neighbor = padded[1+dr : padded.shape[0]-1+dr, 1+dc : padded.shape[1]-1+dc]
                lbp |= ((neighbor >= center).astype(np.uint8) << bit)

            lbp_cell = 32
            for r in range(4):
                for c in range(4):
                    c_lbp = lbp[r*lbp_cell:(r+1)*lbp_cell, c*lbp_cell:(c+1)*lbp_cell]
                    hist, _ = np.histogram(c_lbp, bins=16, range=(0, 256))
                    h_norm = np.linalg.norm(hist) + 1e-5
                    features.extend((hist / h_norm).tolist())

            # 3. Structural band profiles (Eye band, Nose band, Mouth band)
            bands = [norm_gray[20:50, :], norm_gray[50:80, :], norm_gray[80:110, :]]
            for band in bands:
                h_proj = np.mean(band, axis=0) / 255.0
                v_proj = np.mean(band, axis=1) / 255.0
                h_proj = h_proj - np.mean(h_proj)
                v_proj = v_proj - np.mean(v_proj)
                features.extend(h_proj.tolist())
                features.extend(v_proj.tolist())

            vec = np.array(features, dtype=np.float32)
            # Zero-center entire vector to guarantee wide angle separation between different faces
            vec = vec - np.mean(vec)
            norm = np.linalg.norm(vec)
            if norm > 1e-6:
                vec = vec / norm

            return [round(float(v), 6) for v in vec]

        except Exception as exc:
            logger.error("Failed to extract face embedding: %s", exc)
            return None

    # -----------------------------------------------------------------------
    # Cosine Similarity Matching
    # -----------------------------------------------------------------------

    def compute_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        """Compute cosine similarity between two unit-normalized embedding vectors."""
        if not emb1 or not emb2 or len(emb1) != len(emb2):
            return 0.0
        v1 = np.array(emb1, dtype=np.float32)
        v2 = np.array(emb2, dtype=np.float32)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < 1e-6 or norm2 < 1e-6:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))

    def match_face(
        self,
        embedding: List[float],
        registered_people: List[Person],
    ) -> Optional[Tuple[Person, float]]:
        """
        Compare query embedding against registered persons in SQLite database.
        Returns: (matched_person, similarity_score) ONLY IF max(similarity) >= threshold.
        Otherwise returns None.
        CRITICAL: Never assigns the nearest registered person if similarity is below threshold.
        """
        if not embedding or not registered_people:
            return None

        best_person: Optional[Person] = None
        best_similarity: float = -1.0

        for person in registered_people:
            if not person.face_embedding:
                continue
            sim = self.compute_similarity(embedding, person.face_embedding)
            if sim > best_similarity:
                best_similarity = sim
                best_person = person

        if best_person is not None and best_similarity >= self.threshold:
            logger.info(
                "[FACE RECOGNITION MATCH] Person='%s' | Similarity=%.4f >= Threshold=%.2f | Status=%s",
                best_person.name,
                best_similarity,
                self.threshold,
                best_person.status,
            )
            return best_person, round(best_similarity, 4)

        if best_person is not None:
            logger.info(
                "[FACE RECOGNITION NO-MATCH] Best Candidate='%s' | Similarity=%.4f < Threshold=%.2f -> UNKNOWN",
                best_person.name,
                best_similarity,
                self.threshold,
            )

        return None

    # -----------------------------------------------------------------------
    # Registration Image Persistence
    # -----------------------------------------------------------------------

    def save_face_image(self, image_bgr: np.ndarray, person_code: str) -> str:
        """
        Save captured registration face photo to backend/data/faces/
        Returns HTTP-accessible relative URL path (e.g. /media/faces/person_P001_abc123.jpg).
        """
        clean_code = person_code.replace(":", "-").replace("/", "-")
        rand_id = uuid.uuid4().hex[:6]
        filename = f"person_{clean_code}_{rand_id}.jpg"
        file_path = self.faces_dir / filename
        cv2.imwrite(str(file_path), image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
        logger.info("Saved face image to %s", file_path)
        return f"/media/faces/{filename}"

    # -----------------------------------------------------------------------
    # Temporal Recognition Stabilization & Tracking Grace Period
    # -----------------------------------------------------------------------

    def _compute_iou(
        self, boxA: Tuple[float, float, float, float], boxB: Tuple[float, float, float, float]
    ) -> float:
        """Compute Intersection over Union (IoU) between two bounding boxes (x1, y1, x2, y2)."""
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        boxAArea = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
        boxBArea = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])
        denom = boxAArea + boxBArea - interArea
        if denom <= 0.0:
            return 0.0
        return interArea / denom

    def _get_or_create_track(
        self, camera_id: str, track_id: Optional[int], bbox: Tuple[float, float, float, float]
    ) -> TrackIdentityState:
        """Find existing track state by track_id or spatial IoU overlap, or create new track state."""
        now = time.time()
        self._purge_stale_tracks(now)

        # 1. Direct track_id lookup (Strict track isolation)
        if track_id is not None:
            key = f"{camera_id}:{track_id}"
            if key in self._tracks:
                track = self._tracks[key]
                track.last_seen = now
                track.last_bbox = bbox
                track.frame_count += 1
                return track

            # New discrete track_id -> initialize fresh isolated track state
            new_track = TrackIdentityState(
                track_id=track_id,
                camera_id=camera_id,
                first_seen=now,
                last_seen=now,
                last_bbox=bbox,
                frame_count=1,
            )
            self._tracks[key] = new_track
            return new_track

        # 2. Spatial IoU lookup ONLY for untracked detections (where track_id is None)
        best_match: Optional[TrackIdentityState] = None
        best_iou = 0.50
        for key, trk in self._tracks.items():
            if trk.camera_id == camera_id and (now - trk.last_seen) < 2.0:
                iou = self._compute_iou(bbox, trk.last_bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_match = trk

        if best_match is not None:
            best_match.last_seen = now
            best_match.last_bbox = bbox
            best_match.frame_count += 1
            return best_match

        # 3. Create untracked temporary state
        t_id = int(now * 1000) % 1000000
        new_key = f"{camera_id}:{t_id}"
        new_track = TrackIdentityState(
            track_id=t_id,
            camera_id=camera_id,
            first_seen=now,
            last_seen=now,
            last_bbox=bbox,
            frame_count=1,
        )
        self._tracks[new_key] = new_track
        return new_track

    def _purge_stale_tracks(self, now: float) -> None:
        """Purge tracks that have been inactive longer than TTL."""
        expired_keys = [
            k for k, v in self._tracks.items() if (now - v.last_seen) > self.track_ttl_seconds
        ]
        for k in expired_keys:
            self._tracks.pop(k, None)

    def process_person_detection(
        self,
        frame: np.ndarray,
        camera_id: str,
        bbox: Dict[str, Any],
        registered_people: List[Person],
        track_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Process a detected person through multi-angle face extraction, matching,
        and temporal stabilization with tracking grace periods.
        """
        x1 = float(max(0, bbox.get("x1", 0)))
        y1 = float(max(0, bbox.get("y1", 0)))
        x2 = float(min(frame.shape[1], bbox.get("x2", frame.shape[1])))
        y2 = float(min(frame.shape[0], bbox.get("y2", frame.shape[0])))
        bbox_tuple = (x1, y1, x2, y2)

        track = self._get_or_create_track(camera_id, track_id, bbox_tuple)
        now = time.time()

        # Crop person region
        ix1, iy1, ix2, iy2 = int(x1), int(y1), int(x2), int(y2)
        person_crop = frame[iy1:iy2, ix1:ix2] if (ix2 > ix1 and iy2 > iy1) else None

        # Determine whether to run full descriptor matching on this frame:
        # Run on frame 1, or every N frames, or if track is unconfirmed
        should_run_recognition = (
            track.confirmed_status == "PENDING"
            or (track.frame_count % self.recognition_interval_frames == 1)
            or (now - track.last_recognition_time > 1.0)
        )

        instant_match: Optional[Tuple[Person, float]] = None
        face_detected = False

        if person_crop is not None and person_crop.size > 0:
            if should_run_recognition:
                track.last_recognition_time = now
                emb = self.extract_embedding(person_crop)
                if emb is not None:
                    face_detected = True
                    instant_match = self.match_face(emb, registered_people)
            else:
                # Fast path between recognition intervals: check face presence
                faces = self.detect_faces(person_crop, min_size=(25, 25))
                if faces:
                    face_detected = True

        # Temporal Stabilization & Grace Periods
        if instant_match is not None:
            matched_person, sim = instant_match
            track.missed_frames = 0
            person_info = {
                "id": matched_person.id,
                "person_code": matched_person.person_code,
                "name": matched_person.name,
                "status": matched_person.status,
            }

            if matched_person.status == "KNOWN":
                track.known_streak += 1
                track.unknown_streak = 0
                track.flagged_streak = 0
                if track.known_streak >= self.known_confirmation_frames or sim >= 0.78:
                    track.confirmed_status = "KNOWN"
                    track.confirmed_person = person_info
                    track.confirmed_similarity = sim
            elif matched_person.status == "FLAGGED":
                track.flagged_streak += 1
                track.unknown_streak = 0
                track.known_streak = 0
                if track.flagged_streak >= 1 or sim >= 0.72:
                    track.confirmed_status = "FLAGGED"
                    track.confirmed_person = person_info
                    track.confirmed_similarity = sim

        elif should_run_recognition:
            # Face was evaluated but did not match registered persons
            track.unknown_streak += 1
            if not face_detected:
                track.missed_frames += 1

            # Grace period for confirmed KNOWN / FLAGGED tracks during head turns / movement
            if track.confirmed_status in ("KNOWN", "FLAGGED"):
                if track.missed_frames <= self.grace_period_frames and track.unknown_streak <= self.grace_period_frames:
                    # Retain stable identity through temporary movement / turn
                    pass
                else:
                    track.confirmed_status = "UNKNOWN"
                    track.confirmed_person = None
                    track.confirmed_similarity = 0.0
            else:
                # Unconfirmed track requires 3 frames to confirm UNKNOWN
                if track.unknown_streak >= self.unknown_confirmation_frames:
                    track.confirmed_status = "UNKNOWN"
                    track.confirmed_person = None
                    track.confirmed_similarity = 0.0

        # Determine alerts and evidence capture
        should_emit_alert = False
        should_capture_evidence = False

        final_status = track.confirmed_status if track.confirmed_status in ("KNOWN", "FLAGGED", "UNKNOWN") else "UNKNOWN"
        match_name = track.confirmed_person["name"] if track.confirmed_person else "None"
        sim_val = track.confirmed_similarity

        # Structured Telemetry Logging
        logger.info(
            "FACE RECOGNITION | Cam: %s | Track: %s | Face: %s | Match: %s | Sim: %.4f | Result: %s",
            camera_id,
            track.track_id,
            "YES" if face_detected else "NO",
            match_name,
            sim_val,
            final_status,
        )

        if track.confirmed_status == "KNOWN":
            p_name = track.confirmed_person["name"] if track.confirmed_person else "Known Person"
            p_code = track.confirmed_person["person_code"] if track.confirmed_person else None
            return {
                "status": "KNOWN",
                "is_known": True,
                "is_flagged": False,
                "person_name": p_name,
                "person_id": p_code,
                "face_similarity": sim_val,
                "should_emit_alert": False,  # KNOWN NEVER emits alert
                "should_capture_evidence": False,  # KNOWN NEVER captures photo
            }

        elif track.confirmed_status == "FLAGGED":
            p_name = track.confirmed_person["name"] if track.confirmed_person else "Flagged Person"
            p_code = track.confirmed_person["person_code"] if track.confirmed_person else None

            # Cooldown for alert and evidence (10s)
            if (now - track.last_alert_time) > 10.0:
                should_emit_alert = True
                track.last_alert_time = now
            if (now - track.last_evidence_time) > 12.0:
                should_capture_evidence = True
                track.last_evidence_time = now

            return {
                "status": "FLAGGED",
                "is_known": False,
                "is_flagged": True,
                "person_name": p_name,
                "person_id": p_code,
                "face_similarity": sim_val,
                "should_emit_alert": should_emit_alert,
                "should_capture_evidence": should_capture_evidence,
            }

        else:
            # UNKNOWN or PENDING
            is_confirmed_unknown = (track.confirmed_status == "UNKNOWN")

            # Only emit alert & evidence AFTER stable confirmation (3 frames) and respecting cooldown
            if is_confirmed_unknown:
                if (now - track.last_alert_time) > 10.0:
                    should_emit_alert = True
                    track.last_alert_time = now
                if (now - track.last_evidence_time) > 12.0:
                    should_capture_evidence = True
                    track.last_evidence_time = now

            return {
                "status": "UNKNOWN",
                "is_known": False,
                "is_flagged": False,
                "person_name": "Unknown",
                "person_id": None,
                "face_similarity": 0.0,
                "should_emit_alert": should_emit_alert,
                "should_capture_evidence": should_capture_evidence,
            }
