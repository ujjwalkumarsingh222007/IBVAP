"""
config.py — Centralized configuration management for the IBVAP Backend.
Loads configuration from environment variables with secure, hardened defaults.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

# 1. Database Configuration
DEFAULT_DB_FILE = BACKEND_DIR / "ibvap.db"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# 2. Security & JWT Configuration
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "ibvap-production-hardened-jwt-secret-key-2026-sih-border-surveillance",
)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

# Default Admin Initializer
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
OPERATOR_USERNAME = os.getenv("OPERATOR_USERNAME", "operator")
OPERATOR_PASSWORD = os.getenv("OPERATOR_PASSWORD", "operator123")
VIEWER_USERNAME = os.getenv("VIEWER_USERNAME", "viewer")
VIEWER_PASSWORD = os.getenv("VIEWER_PASSWORD", "viewer123")

# 3. CORS Configuration
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS: List[str] = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

# 4. Ingestion & Frame Size Limits
MAX_FRAME_SIZE_BYTES = int(os.getenv("MAX_FRAME_SIZE_BYTES", str(5 * 1024 * 1024)))  # 5 MB

# 5. Member 1 CV Configuration
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
CV_CONFIDENCE_THRESHOLD = float(os.getenv("CV_CONFIDENCE_THRESHOLD", "0.35"))

# 6. Member 2 ANPR Configuration
PLATE_MODEL_PATH = os.getenv(
    "PLATE_MODEL_PATH",
    str(PROJECT_ROOT / "ai" / "member2_anpr" / "models" / "license_plate.pt"),
)
PLATE_CONFIDENCE_THRESHOLD = float(os.getenv("PLATE_CONFIDENCE_THRESHOLD", "0.25"))
ANPR_OCR_CONF = float(os.getenv("ANPR_OCR_CONF", "0.30"))
ANPR_OCR_GPU = os.getenv("ANPR_OCR_GPU", "false").lower() in ("true", "1", "yes")
DUPLICATE_SUPPRESSION_WINDOW_SECONDS = float(os.getenv("DUPLICATE_SUPPRESSION_WINDOW_SECONDS", "10.0"))

# 7. Threat Intelligence & Correlation Configuration
THREAT_CORRELATION_WINDOW_SECONDS = float(os.getenv("THREAT_CORRELATION_WINDOW_SECONDS", "10.0"))
THREAT_SUPPRESSION_COOLDOWN_SECONDS = float(os.getenv("THREAT_SUPPRESSION_COOLDOWN_SECONDS", "10.0"))

# 8. Evidence & Face Storage Configuration
EVIDENCE_DIR = BACKEND_DIR / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

FACES_DIR = BACKEND_DIR / "data" / "faces"
FACES_DIR.mkdir(parents=True, exist_ok=True)

# 9. Face Recognition Configuration
FACE_RECOGNITION_THRESHOLD = float(os.getenv("FACE_RECOGNITION_THRESHOLD", "0.70"))

# 10. Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

