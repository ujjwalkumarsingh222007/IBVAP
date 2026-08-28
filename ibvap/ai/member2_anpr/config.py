"""
IBVAP - Member 2 ANPR Module - config.py

Centralised, lightweight configuration for the ANPR subsystem.
All tuneable parameters live here so that later phases can load them
from environment variables, YAML, or a database without touching
implementation code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ANPRConfig:
    """
    Runtime configuration for the ANPR pipeline.

    All values have safe defaults so the module works out-of-the-box
    without any environment setup.
    """

    # --- Detector ---
    detector_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_DETECTOR_BACKEND", "mock")
    )
    """Which plate-detector backend to use.
    Phase 1 default is 'mock'. Future values: 'yolo', 'east', 'paddleocr'.
    """

    detector_model_path: Optional[str] = field(
        default_factory=lambda: os.getenv("ANPR_DETECTOR_MODEL_PATH", None)
    )
    """Path to the detector model weights. Not required for the mock backend."""

    detector_confidence_threshold: float = field(
        default_factory=lambda: float(os.getenv("ANPR_DETECTOR_CONF", "0.50"))
    )
    """Minimum detection confidence; boxes below this are discarded."""

    # --- OCR ---
    ocr_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_OCR_BACKEND", "mock")
    )
    """Which OCR engine to use.
    Phase 1 default is 'mock'. Future values: 'easyocr', 'tesseract', 'paddleocr'.
    """

    ocr_confidence_threshold: float = field(
        default_factory=lambda: float(os.getenv("ANPR_OCR_CONF", "0.40"))
    )
    """Minimum OCR confidence; results below this are discarded."""

    # --- Recognition / normalisation ---
    plate_country: str = field(
        default_factory=lambda: os.getenv("ANPR_PLATE_COUNTRY", "IN")
    )
    """Country code used to select normalisation rules ('IN' = India)."""

    # --- Watchlist ---
    watchlist_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_WATCHLIST_BACKEND", "memory")
    )
    """Watchlist storage backend.
    Phase 1 default is 'memory'. Future values: 'postgres', 'redis'.
    """

    # --- General ---
    log_level: str = field(
        default_factory=lambda: os.getenv("ANPR_LOG_LEVEL", "INFO")
    )

    default_camera_id: str = field(
        default_factory=lambda: os.getenv("ANPR_DEFAULT_CAMERA_ID", "CAM-01")
    )


# Module-level default instance -- importable directly.
default_config = ANPRConfig()
