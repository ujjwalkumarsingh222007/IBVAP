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
) -> dict:
    """
    Validate that exactly one face is present in the frame.
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
    summary="Register a known or flagged person with face photo and embedding",
)
async def register_person(
    name: str = Form(..., min_length=1, max_length=128, description="Full name of individual"),
    person_status: str = Form("KNOWN", alias="status", description="Status: KNOWN or FLAGGED"),
    notes: Optional[str] = Form(None, description="Optional notes or security remarks"),
    file: UploadFile = File(..., description="Face photo image binary"),
    db: Session = Depends(get_db),
) -> PersonRegisterResponse:
    """
    Register person into SQLite database:
    1. Validates single face presence server-side.
    2. Extracts normalized 128D feature embedding.
    3. Saves photo to backend/data/faces/ directory.
    4. Persists record into persons table.
    """
    clean_name = name.strip()
    clean_status = person_status.strip().upper()
    if clean_status not in ("KNOWN", "FLAGGED"):
        clean_status = "KNOWN"

    # Read and decode image
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded face image is empty.",
        )

    if len(contents) > MAX_FRAME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds {MAX_FRAME_SIZE_BYTES // (1024*1024)}MB limit.",
        )

    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to decode uploaded image.",
        )

    service = FaceRecognitionService.get_instance()
    valid, message, face_bbox = service.validate_registration_face(image_bgr)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face validation failed: {message}",
        )

    # Extract normalized embedding
    embedding = service.extract_embedding(image_bgr, face_bbox)
    if not embedding:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract reliable face embedding from provided image.",
        )

    person_code = f"P-{uuid.uuid4().hex[:8].upper()}"
    face_image_url = service.save_face_image(image_bgr, person_code)

    person = Person(
        person_code=person_code,
        name=clean_name,
        status=clean_status,
        face_image_path=face_image_url,
        face_embedding=embedding,
        notes=notes,
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    logger.info("Successfully registered person %s (#%s, status=%s)", clean_name, person.id, clean_status)

    return PersonRegisterResponse(
        status="success",
        person_id=person_code,
        name=clean_name,
        person_status=clean_status,
        face_image_url=face_image_url,
        message=f"Person '{clean_name}' registered successfully as {clean_status}.",
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
    summary="Get single person by ID",
)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
) -> PersonResponse:
    """Retrieve details for a registered person."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person with ID #{person_id} not found.",
        )
    return PersonResponse.model_validate(person)


@router.delete(
    "/{person_id}",
    summary="Delete registered person record",
)
def delete_person(
    person_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete person from database and clear associated face photo."""
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person with ID #{person_id} not found.",
        )

    # Delete local face image if exists
    try:
        if person.face_image_path:
            import os
            from app.config import BACKEND_DIR
            relative = person.face_image_path.lstrip("/media/")
            file_p = BACKEND_DIR / "data" / relative
            if file_p.exists():
                file_p.unlink()
    except Exception as exc:
        logger.warning("Error deleting face photo: %s", exc)

    db.delete(person)
    db.commit()
    return {"status": "success", "message": f"Person #{person_id} deleted successfully."}
