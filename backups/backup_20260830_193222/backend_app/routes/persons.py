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
    valid, message, face_bbox = service.validate_registration_face(image_bgr)
    faces = service.detect_faces(image_bgr)

    return {
        "valid": valid,
        "message": message,
        "angle": angle,
        "faces_count": len(faces),
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
    allow_duplicate: bool = Form(False, description="Bypass duplicate face detection warning"),
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

    upload_list: List[UploadFile] = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)

    if not upload_list:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one face photo is required for registration.",
        )

    service = FaceRecognitionService.get_instance()
    person_code = f"P-{uuid.uuid4().hex[:8].upper()}"

    valid_embeddings: List[dict] = []
    default_angles = ["FRONT", "SLIGHT_LEFT", "LEFT", "SLIGHT_RIGHT", "RIGHT", "LOOK_UP", "LOOK_DOWN"]

    for idx, upload_f in enumerate(upload_list):
        contents = await upload_f.read()
        if len(contents) == 0:
            continue
        if len(contents) > MAX_FRAME_SIZE_BYTES:
            continue

        nparr = np.frombuffer(contents, np.uint8)
        image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            continue

        valid, msg, face_bbox = service.validate_registration_face(image_bgr)
        if not valid:
            # If single file fails, raise error. In multi-file, continue if we get at least 1 valid
            if len(upload_list) == 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Face validation failed: {msg}",
                )
            continue

        emb = service.extract_embedding(image_bgr, face_bbox)
        if not emb:
            if len(upload_list) == 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Could not extract reliable face embedding from provided image.",
                )
            continue

        img_url = service.save_face_image(image_bgr, person_code)
        sample_angle = angles[idx] if (angles and idx < len(angles)) else (
            default_angles[idx] if idx < len(default_angles) else "ANGLE"
        )
        valid_embeddings.append({
            "embedding": emb,
            "angle": sample_angle,
            "image_url": img_url,
        })

    if not valid_embeddings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract any valid face embeddings from uploaded samples.",
        )

    primary_item = valid_embeddings[0]

    # Duplicate check against existing registered persons
    if not allow_duplicate:
        dup = service.check_duplicate_registration(primary_item["embedding"], db=db)
        if dup:
            logger.warning(
                "Duplicate registration detected: candidate matches existing person '%s' (#%s, sim=%.2f)",
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

    # Invalidate and reload in-memory vectorized cache immediately
    service.invalidate_cache()
    service.ensure_cache_loaded(db)

    logger.info(
        "Successfully registered person %s (#%s, status=%s) with %d face angle embeddings",
        clean_name,
        person.id,
        clean_status,
        len(valid_embeddings),
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
