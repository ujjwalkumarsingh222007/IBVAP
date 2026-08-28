"""
main.py — FastAPI Application Entrypoint for IBVAP Backend.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes.events import router as events_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler. Automatically initializes database tables
    on startup.
    """
    init_db()
    yield


app = FastAPI(
    title="IBVAP Backend API",
    version="1.0.0",
    description=(
        "Intelligent Border Video Analytics Platform (IBVAP) Core Backend API. "
        "Receives, validates, and persists common events from AI modules (CV, ANPR)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS Configuration for local frontend/analytics development
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Suitable for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(events_router)


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
