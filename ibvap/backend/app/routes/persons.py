"""
persons.py — REST API endpoints for Face Registration and Person Management.
"""

from __future__ import annotations

import logging
import uuid
from typing import List, Optional
import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import MAX_FRAME_SIZE_BYTES
from app.database import get_db
from app.models import Person
from app.schemas import PersonRegisterResponse, PersonResponse
from app.services.face_recognition_service import FaceRecognitionService

logger = logging.getLogger("ibvap.persons_route")

router = APIRouter(
    prefix="/api/v1/persons",
    tags=["Person & Face Registration"],
)


@router.post(
    "/validate-face",
    summary="Validate face in a single video frame for real-time registration guidance",
)
async def validate_face(
    file: UploadFile = File(..., description="Captured face image binary"),
    angle: Optional[str] = Form("FRONT", description="Expected angle during guided enrollment"),
) -> dict:
    """
    Validate that exactly one face is present in the frame and quality is acceptable.
    Returns validation status, guidance message, and face bounding box.
    """
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded frame is empty.",
        )

    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to decode image binary.",
        )

    service = FaceRecognitionService.get_instance()
    valid, message, face_bbox, meta = service.validate_registration_face(image_bgr, angle=angle or "FRONT")

    return {
        "valid": valid,
        "message": message,
        "angle": angle,
        "faces_count": meta.get("faces_count", 1 if valid else 0),
        "guidance": meta.get("guidance", "PERFECT" if valid else "NO_FACE"),
        "detected_pose": meta.get("detected_pose", "STRAIGHT"),
        "quality_score": meta.get("quality_score", 95 if valid else 0),
        "face_bbox": (
            {"x": face_bbox[0], "y": face_bbox[1], "w": face_bbox[2], "h": face_bbox[3]}
            if face_bbox
            else None
        ),
    }


@router.post(
    "/register",
    response_model=PersonRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a known or flagged person with single or multi-angle face embeddings",
)
async def register_person(
    name: str = Form(..., min_length=1, max_length=128, description="Full name of individual"),
    person_status: str = Form("KNOWN", alias="status", description="Status: KNOWN or FLAGGED"),
    notes: Optional[str] = Form(None, description="Optional notes or security remarks"),
    file: Optional[UploadFile] = File(None, description="Primary face photo binary"),
    files: Optional[List[UploadFile]] = File(None, description="Multiple angle sample photos"),
    angles: Optional[List[str]] = Form(None, description="Angles corresponding to files"),
    allow_duplicate: Optional[str] = Form("false", description="Bypass duplicate face detection warning"),
    db: Session = Depends(get_db),
) -> PersonRegisterResponse:
    """
    Register person into SQLite database with multi-angle face embeddings:
    1. Validates faces and extracts normalized 128D embeddings for all provided angle samples.
    2. Saves photos to backend/data/faces/ directory.
    3. Persists record into persons and face_embeddings tables.
    """
    from app.models import FaceEmbedding

    clean_name = name.strip()
    clean_status = person_status.strip().upper()
    if clean_status not in ("KNOWN", "FLAGGED"):
        clean_status = "KNOWN"

    logger.info("[REGISTRATION] request received for name='%s' (status=%s)", clean_name, clean_status)

    upload_list: List[UploadFile] = []
    if files and len(files) > 0:
        upload_list = list(files)
    elif file is not None:
        upload_list = [file]

    if not upload_list:
        logger.warning("[REGISTRATION ERROR] No face photo uploaded.")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one face photo is required for registration.",
        )

    logger.info("[REGISTRATION] image received: %d file(s)", len(upload_list))

    service = FaceRecognitionService.get_instance()
    person_code = f"P-{uuid.uuid4().hex[:8].upper()}"

    valid_embeddings: List[dict] = []
    default_angles = ["FRONT", "LEFT", "RIGHT", "LOOK_UP", "LOOK_DOWN"]

    for idx, upload_f in enumerate(upload_list):
        contents = await upload_f.read()
        if len(contents) == 0:
            logger.warning("[REGISTRATION ERROR] Sample %d: Received empty binary payload.", idx + 1)
            continue
        if len(contents) > MAX_FRAME_SIZE_BYTES:
            logger.warning("[REGISTRATION ERROR] Sample %d: Payload exceeds MAX_FRAME_SIZE_BYTES (%d bytes).", idx + 1, len(contents))
            continue

        nparr = np.frombuffer(contents, np.uint8)
        image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            logger.warning("[REGISTRATION ERROR] Sample %d: Failed to decode image binary.", idx + 1)
            continue

        h_img, w_img = image_bgr.shape[:2]
        logger.info("[REGISTRATION] image decoded: sample %d (%dx%d, %d bytes)", idx + 1, w_img, h_img, len(contents))

        # Check face presence
        faces = service.detect_faces(image_bgr, min_size=(25, 25))
        logger.info("[REGISTRATION] faces detected: %d (sample %d)", len(faces), idx + 1)

        if len(faces) > 1:
            logger.warning("[REGISTRATION ERROR] Sample %d: Rejected - %d faces detected.", idx + 1, len(faces))
            if len(upload_list) == 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Multiple faces detected. Only one person should be visible in camera.",
                )
            continue

        face_bbox = faces[0] if len(faces) == 1 else None

        # Extract normalized embedding vector
        emb = service.extract_embedding(image_bgr, face_bbox)
        if not emb or len(emb) == 0:
            logger.warning("[REGISTRATION ERROR] Sample %d: Embedding generation failed.", idx + 1)
            if len(upload_list) == 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Face processing failed. Could not extract biometric embedding from face.",
                )
            continue

        logger.info("[REGISTRATION] embedding generated: sample %d (dimension=%d)", idx + 1, len(emb))

        img_url = service.save_face_image(image_bgr, person_code)
        sample_angle = angles[idx] if (angles and idx < len(angles)) else (
            default_angles[idx] if idx < len(default_angles) else "FRONT"
        )
        valid_embeddings.append({
            "embedding": emb,
            "angle": sample_angle,
            "image_url": img_url,
        })

    if not valid_embeddings:
        logger.error("[REGISTRATION ERROR] No valid face embeddings generated from %d sample(s).", len(upload_list))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Face processing failed. No valid face detected in uploaded photo(s).",
        )

    primary_item = valid_embeddings[0]

    # Duplicate check against existing registered persons
    is_allow_dup = allow_duplicate if isinstance(allow_duplicate, bool) else (str(allow_duplicate).strip().lower() in ("true", "1", "yes"))
    if not is_allow_dup:
        dup = service.check_duplicate_registration(primary_item["embedding"], db=db)
        if dup:
            logger.warning(
                "[REGISTRATION ERROR] Duplicate detected: matches existing person '%s' (#%s, similarity=%.2f)",
                dup["person_name"],
                dup["person_id"],
                dup["similarity"],
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Duplicate Face Detected: This face matches already registered person '{dup['person_name']}' "
                    f"({int(dup['similarity'] * 100)}% match). Please confirm or use a different face."
                ),
            )

    logger.info("[REGISTRATION] saving person: '%s' (%s) with %d embedding(s)", clean_name, person_code, len(valid_embeddings))

    try:
        person = Person(
            person_code=person_code,
            name=clean_name,
            status=clean_status,
            face_image_path=primary_item["image_url"],
            face_embedding=primary_item["embedding"],
            notes=notes,
        )
        db.add(person)
        db.flush()

        for item in valid_embeddings:
            face_emb_record = FaceEmbedding(
                person_id=person.id,
                embedding=item["embedding"],
                angle=item["angle"],
                quality_score=1.0,
                image_path=item["image_url"],
            )
            db.add(face_emb_record)

        db.commit()
        db.refresh(person)
        logger.info("[REGISTRATION] database commit successful (person ID=%s, code=%s)", person.id, person_code)
    except Exception as exc:
        db.rollback()
        logger.error("[REGISTRATION ERROR] %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during person registration: {str(exc)}",
        )

    # Invalidate and reload in-memory vectorized cache immediately
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    logger.info(
        "[REGISTRATION] database commit successful: Person '%s' (#%s, status=%s) registered.",
        clean_name,
        person.id,
        clean_status,
    )

    return PersonRegisterResponse(
        status="success",
        person_id=person_code,
        name=clean_name,
        person_status=clean_status,
        face_image_url=primary_item["image_url"],
        message=f"Person '{clean_name}' registered successfully with {len(valid_embeddings)} angle samples.",
    )


@router.get(
    "",
    response_model=List[PersonResponse],
    summary="Get list of all registered people",
)
def list_persons(
    db: Session = Depends(get_db),
) -> List[PersonResponse]:
    """Retrieve all registered persons from SQLite database."""
    people = db.query(Person).order_by(Person.id.desc()).all()
    return [PersonResponse.model_validate(p) for p in people]


@router.get(
    "/{person_id}",
    response_model=PersonResponse,
    summary="Get single person by ID or code",
)
def get_person(
    person_id: str,
    db: Session = Depends(get_db),
) -> PersonResponse:
    """Retrieve details for a registered person by ID integer or person_id string."""
    query = db.query(Person)
    if person_id.isdigit():
        person = query.filter((Person.id == int(person_id)) | (Person.person_code == person_id)).first()
    else:
        person = query.filter(Person.person_code == person_id).first()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person '{person_id}' not found.",
        )
    return PersonResponse.model_validate(person)


@router.delete(
    "/{person_id}",
    summary="Delete registered person record",
)
def delete_person(
    person_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Delete person from database and clear associated face photo."""
    query = db.query(Person)
    if person_id.isdigit():
        person = query.filter((Person.id == int(person_id)) | (Person.person_code == person_id)).first()
    else:
        person = query.filter(Person.person_code == person_id).first()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person '{person_id}' not found.",
        )

    # Delete local face image if exists
    try:
        if person.face_image_path:
            from app.config import BACKEND_DIR
            relative = person.face_image_path.lstrip("/media/")
            file_p = BACKEND_DIR / "data" / relative
            if file_p.exists():
                file_p.unlink()
    except Exception as exc:
        logger.warning("Error deleting face photo: %s", exc)

    db.delete(person)
    db.commit()

    service = FaceRecognitionService.get_instance()
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    return {"status": "success", "message": f"Person '{person_id}' deleted successfully."}


@router.put(
    "/{person_id}",
    response_model=PersonResponse,
    summary="Update registered person details (name, status, notes)",
)
def update_person(
    person_id: str,
    payload: PersonUpdateRequest,
    db: Session = Depends(get_db),
) -> PersonResponse:
    """Update person fields without modifying biometric face embeddings."""
    from app.schemas import PersonUpdateRequest

    query = db.query(Person)
    if person_id.isdigit():
        person = query.filter((Person.id == int(person_id)) | (Person.person_code == person_id)).first()
    else:
        person = query.filter(Person.person_code == person_id).first()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person '{person_id}' not found.",
        )

    if payload.name is not None:
        person.name = payload.name.strip()
    if payload.status is not None:
        person.status = payload.status.value
    if payload.notes is not None:
        person.notes = payload.notes.strip()

    db.commit()
    db.refresh(person)

    # Invalidate and refresh cache so updated name/status is immediately live
    service = FaceRecognitionService.get_instance()
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    logger.info("[PERSON UPDATE] Person #%s ('%s') updated (status=%s)", person.id, person.name, person.status)
    return PersonResponse.model_validate(person)


@router.post(
    "/bulk-delete",
    summary="Bulk delete multiple person profiles",
)
def bulk_delete_persons(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Delete multiple registered persons in a single transaction."""
    from app.schemas import BulkDeleteRequest

    if not payload.ids:
        return {"status": "success", "deleted_count": 0}

    persons = db.query(Person).filter(Person.id.in_(payload.ids)).all()
    count = len(persons)

    for person in persons:
        try:
            if person.face_image_path:
                from app.config import BACKEND_DIR
                relative = person.face_image_path.lstrip("/media/")
                file_p = BACKEND_DIR / "data" / relative
                if file_p.exists():
                    file_p.unlink()
        except Exception as exc:
            logger.warning("Error deleting face photo: %s", exc)
        db.delete(person)

    db.commit()

    service = FaceRecognitionService.get_instance()
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    logger.info("[PERSON BULK DELETE] Deleted %d person profile(s)", count)
    return {"status": "success", "deleted_count": count, "message": f"Successfully deleted {count} profiles."}


@router.post(
    "/bulk-status",
    summary="Bulk update status of multiple person profiles",
)
def bulk_status_persons(
    payload: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Update status (KNOWN / FLAGGED) for multiple registered persons."""
    from app.schemas import BulkStatusUpdateRequest

    new_status = payload.status.strip().upper()
    if new_status not in ("KNOWN", "FLAGGED"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid status. Must be KNOWN or FLAGGED.",
        )

    persons = db.query(Person).filter(Person.id.in_(payload.ids)).all()
    for person in persons:
        person.status = new_status

    db.commit()

    service = FaceRecognitionService.get_instance()
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    logger.info("[PERSON BULK STATUS] Updated %d person profile(s) to status=%s", len(persons), new_status)
    return {"status": "success", "updated_count": len(persons), "message": f"Updated {len(persons)} profiles to {new_status}."}

