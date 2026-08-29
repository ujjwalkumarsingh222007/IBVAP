"""
main.py — FastAPI Application Entrypoint for IBVAP Backend.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend directory and project root are always in sys.path
_backend_dir = Path(__file__).resolve().parent.parent
_project_root = _backend_dir.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))
if str(_project_root) not in sys.path:
    sys.path.insert(1, str(_project_root))

from fastapi import FastAPI, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import CORS_ORIGINS, DATABASE_URL, EVIDENCE_DIR, FACES_DIR
from app.database import init_db, get_db
from app.auth import auth_router
from app.routes import (
    ai_router,
    analytics_router,
    cameras_router,
    dashboard_router,
    demo_router,
    events_router,
    evidence_router,
    health_router,
    persons_router,
    threats_router,
    vehicles_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler. Automatically initializes database tables,
    records application start time, and seeds default administrative users on startup.
    """
    app.state.start_time = time.time()
    init_db()
    import logging
    logging.getLogger("ibvap.startup").info("IBVAP SQLite Database URL: %s", DATABASE_URL)
    try:
        from app.database import SessionLocal
        from app.services.face_recognition_service import FaceRecognitionService
        with SessionLocal() as db:
            FaceRecognitionService.get_instance().sync_registered_embeddings(db)
    except Exception as exc:
        logging.getLogger("ibvap.startup").warning("Face embedding sync notice: %s", exc)
    yield


app = FastAPI(
    title="IBVAP Backend API",
    version="1.0.0",
    description=(
        "Intelligent Border Video Analytics Platform (IBVAP) Core Backend API. "
        "Receives, validates, and persists common events from AI modules (CV, ANPR), "
        "manages cameras, provides real-time surveillance analytics, and enforces role-based access control."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# Static Media Files (Evidence Photos & Registered Faces)
# ---------------------------------------------------------------------------
app.mount("/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="evidence")
app.mount("/media/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="media_evidence")
app.mount("/media/faces", StaticFiles(directory=str(FACES_DIR)), name="media_faces")

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(events_router)
app.include_router(threats_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(cameras_router)
app.include_router(evidence_router)
app.include_router(persons_router)
app.include_router(vehicles_router)
app.include_router(demo_router)
app.include_router(health_router)


@app.get(
    "/",
    tags=["Health"],
    summary="Health check / Service information",
)
def root():
    """
    Root health check endpoint for basic connectivity verification.
    """
    return {
        "status": "ok",
        "service": "IBVAP Backend API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Top-level Health check alias",
    include_in_schema=False,
)
def health_alias(request: Request, response: Response, db: Session = Depends(get_db)):
    from app.routes.health import get_health
    return get_health(request=request, response=response, db=db)
