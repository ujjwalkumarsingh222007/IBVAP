"""
ai.py — API endpoints for AI video analytics and real-time webcam frame processing.
"""

from __future__ import annotations

import anyio.to_thread
import re
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import MAX_FRAME_SIZE_BYTES
from app.database import get_db
from app.schemas import AIFrameProcessResponse
from app.services.ai_service import AIService

router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI Analytics"],
)

# Constraints
ALLOWED_MIME_PREFIXES = ("image/", "application/octet-stream")
CAMERA_ID_REGEX = re.compile(r"^[A-Za-z0-9_\-\.:]{1,64}$")


@router.post(
    "/process-frame",
    response_model=AIFrameProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process a single video/webcam frame with Member 1 CV pipeline",
    description=(
        "Receives a single image frame (JPEG/PNG), decodes it safely, runs YOLOv8 detection "
        "and ByteTrack tracking, processes analytics and virtual-fence intrusion events, "
        "persists emitted Common Events into SQLite, and returns detections and generated events."
    ),
)
async def process_frame(
    file: UploadFile = File(..., description="JPEG or PNG image frame binary"),
    camera_id: str = Form(..., description="Camera identifier associated with this frame"),
    db: Session = Depends(get_db),
) -> AIFrameProcessResponse:
    """
    Process incoming camera frame through Member 1 Computer Vision pipeline.
    Uses worker thread pool so the main FastAPI asyncio event loop is NEVER blocked.
    """
    # 1. Validate camera_id
    if not camera_id or not camera_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="camera_id cannot be empty",
        )

    clean_camera_id = camera_id.strip()
    if not CAMERA_ID_REGEX.match(clean_camera_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid camera_id format. Must be 1-64 alphanumeric, dash, colon, or underscore characters.",
        )

    # 2. Validate Content-Type
    content_type = file.content_type or ""
    if content_type and not any(content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Must be an image (e.g. image/jpeg, image/png).",
        )

    # 3. Read and validate frame size
    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image stream: {exc}",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded frame is empty (0 bytes).",
        )

    if len(contents) > MAX_FRAME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Frame size exceeds maximum permitted limit of {MAX_FRAME_SIZE_BYTES // (1024*1024)}MB.",
        )

    # 4. Process frame via Member 1 CV pipeline on worker thread
    try:
        service = AIService.get_instance()
        result = await anyio.to_thread.run_sync(
            service.process_frame,
            contents,
            clean_camera_id,
            db,
        )
        return AIFrameProcessResponse(**result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI pipeline processing error: {exc}",
        )
