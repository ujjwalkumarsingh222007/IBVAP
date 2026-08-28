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
from typing import List, Optional


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
    """Which plate-detector backend to use ('mock', 'yolo', etc.)."""

    detector_model_path: Optional[str] = field(
        default_factory=lambda: os.getenv(
            "PLATE_MODEL_PATH", os.getenv("ANPR_DETECTOR_MODEL_PATH", "models/license_plate.pt")
        )
    )
    """Path to the detector model weights (e.g. YOLO .pt file)."""

    detector_confidence_threshold: float = field(
        default_factory=lambda: float(
            os.getenv("PLATE_CONFIDENCE_THRESHOLD", os.getenv("ANPR_DETECTOR_CONF", "0.40"))
        )
    )
    """Minimum detection confidence; boxes below this are discarded."""

    detector_device: str = field(
        default_factory=lambda: os.getenv("PLATE_DEVICE", os.getenv("ANPR_DEVICE", "cpu"))
    )
    """Inference device: 'cpu' or 'cuda'."""

    # --- OCR ---
    ocr_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_OCR_BACKEND", "mock")
    )
    """Which OCR engine to use ('mock', 'easyocr', 'tesseract', etc.)."""

    ocr_confidence_threshold: float = field(
        default_factory=lambda: float(os.getenv("ANPR_OCR_CONF", "0.40"))
    )
    """Minimum OCR confidence; results below this are discarded."""

    ocr_languages: List[str] = field(
        default_factory=lambda: os.getenv("ANPR_OCR_LANGUAGES", "en").split(",")
    )
    """Languages for OCR engine (default ['en'])."""

    ocr_gpu: bool = field(
        default_factory=lambda: os.getenv("ANPR_OCR_GPU", "false").lower() in ("true", "1", "yes")
    )
    """Whether to use GPU for OCR."""

    # --- Preprocessing ---
    preprocess_enabled: bool = field(
        default_factory=lambda: os.getenv("ANPR_PREPROCESS_ENABLED", "true").lower() in ("true", "1", "yes")
    )
    """Whether to apply image enhancement before OCR."""

    preprocess_target_width: int = field(
        default_factory=lambda: int(os.getenv("ANPR_PREPROCESS_WIDTH", "320"))
    )
    """Target width to upscale/normalize plate crops for OCR."""

    # --- Recognition / normalisation ---
    plate_country: str = field(
        default_factory=lambda: os.getenv("ANPR_PLATE_COUNTRY", "IN")
    )
    """Country code used to select normalisation rules ('IN' = India)."""

    # --- Watchlist ---
    watchlist_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_WATCHLIST_BACKEND", "memory")
    )
    """Watchlist storage backend ('memory', 'postgres', etc.)."""

    # --- General ---
    log_level: str = field(
        default_factory=lambda: os.getenv("ANPR_LOG_LEVEL", "INFO")
    )

    default_camera_id: str = field(
        default_factory=lambda: os.getenv("ANPR_DEFAULT_CAMERA_ID", "CAM-01")
    )


# Module-level default instance -- importable directly.
default_config = ANPRConfig()
