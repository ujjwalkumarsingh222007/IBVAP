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
    Runtime configuration for the ANPR pipeline, validation runner, and RTSP stream processing.

    All values have safe defaults so the module works out-of-the-box
    without any environment setup.
    """

    # --- Detector ---
    detector_backend: str = field(
        default_factory=lambda: os.getenv("ANPR_DETECTOR_BACKEND", "yolo")
    )
    """Which plate-detector backend to use ('yolo', 'mock', etc.)."""

    detector_model_path: Optional[str] = field(
        default_factory=lambda: os.getenv(
            "PLATE_MODEL_PATH", os.getenv("ANPR_DETECTOR_MODEL_PATH", "ai/member2_anpr/models/license_plate.pt")
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
        default_factory=lambda: os.getenv("ANPR_OCR_BACKEND", "easyocr")
    )
    """Which OCR engine to use ('easyocr', 'mock', 'tesseract', etc.)."""

    ocr_confidence_threshold: float = field(
        default_factory=lambda: float(os.getenv("ANPR_OCR_CONF", "0.40"))
    )
    """Minimum OCR confidence; results below this are discarded."""

    ocr_languages: List[str] = field(
        default_factory=lambda: [
            lang.strip() for lang in os.getenv("ANPR_OCR_LANGUAGES", "en").split(",") if lang.strip()
        ]
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

    # --- Duplicate Event Suppression (Phase 4) ---
    duplicate_suppression_enabled: bool = field(
        default_factory=lambda: os.getenv("ANPR_DUPLICATE_SUPPRESSION_ENABLED", "true").lower() in ("true", "1", "yes")
    )
    """Enable in-memory duplicate event suppression for continuous streams."""

    duplicate_suppression_window_seconds: float = field(
        default_factory=lambda: float(os.getenv("ANPR_DUPLICATE_WINDOW_SEC", "10.0"))
    )
    """Window duration (seconds) within which repeated plate detections are suppressed."""

    # --- RTSP / Stream Processing (Phase 5) ---
    rtsp_url: Optional[str] = field(
        default_factory=lambda: os.getenv("ANPR_RTSP_URL", None)
    )
    """Default RTSP stream URL or video source path."""

    frame_skip: int = field(
        default_factory=lambda: int(os.getenv("ANPR_FRAME_SKIP", "0"))
    )
    """Number of frames to skip between ANPR evaluations (default 0 = process every frame)."""

    reconnect_attempts: int = field(
        default_factory=lambda: int(os.getenv("ANPR_RECONNECT_ATTEMPTS", "3"))
    )
    """Maximum consecutive stream reconnect attempts."""

    reconnect_delay_sec: float = field(
        default_factory=lambda: float(os.getenv("ANPR_RECONNECT_DELAY_SEC", "2.0"))
    )
    """Delay in seconds between reconnection attempts."""

    stream_timeout_sec: float = field(
        default_factory=lambda: float(os.getenv("ANPR_STREAM_TIMEOUT_SEC", "10.0"))
    )
    """Stream connection timeout in seconds."""

    # --- Recognition / Validation (Phase 6) ---
    plate_country: str = field(
        default_factory=lambda: os.getenv("ANPR_PLATE_COUNTRY", "IN")
    )
    """Country code used to select normalisation rules ('IN' = India)."""

    strict_plate_validation: bool = field(
        default_factory=lambda: os.getenv("ANPR_STRICT_VALIDATION", "false").lower() in ("true", "1", "yes")
    )
    """Whether to enforce strict state code and structural format checks."""

    min_plate_confidence: float = field(
        default_factory=lambda: float(os.getenv("ANPR_MIN_PLATE_CONF", "0.40"))
    )
    """Overall minimum confidence threshold for plate emission."""

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

    def validate(self) -> None:
        """Validate configuration settings, raising ValueError if out of bounds."""
        if not 0.0 <= self.detector_confidence_threshold <= 1.0:
            raise ValueError(f"detector_confidence_threshold ({self.detector_confidence_threshold}) must be in [0, 1]")

        if not 0.0 <= self.ocr_confidence_threshold <= 1.0:
            raise ValueError(f"ocr_confidence_threshold ({self.ocr_confidence_threshold}) must be in [0, 1]")

        if not 0.0 <= self.min_plate_confidence <= 1.0:
            raise ValueError(f"min_plate_confidence ({self.min_plate_confidence}) must be in [0, 1]")

        if self.preprocess_target_width < 50 or self.preprocess_target_width > 2000:
            raise ValueError(f"preprocess_target_width ({self.preprocess_target_width}) must be between 50 and 2000")

        if self.duplicate_suppression_window_seconds < 0:
            raise ValueError("duplicate_suppression_window_seconds must be non-negative")

        if self.frame_skip < 0:
            raise ValueError("frame_skip must be non-negative")

        if self.reconnect_attempts < 0:
            raise ValueError("reconnect_attempts must be non-negative")

        if self.reconnect_delay_sec < 0:
            raise ValueError("reconnect_delay_sec must be non-negative")

        if not self.ocr_languages:
            raise ValueError("ocr_languages must not be empty")


# Module-level default instance -- importable directly.
default_config = ANPRConfig()
