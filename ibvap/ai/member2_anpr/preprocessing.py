"""
IBVAP - Member 2 ANPR Module - preprocessing.py

Image preprocessing utilities for license plate crops prior to OCR.

Pipeline steps:
1. Dimension & aspect ratio validation
2. Rescaling / standardising width
3. Grayscale conversion
4. Noise reduction / bilateral filtering
5. Contrast enhancement (CLAHE)
6. Adaptive / Otsu binarisation
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class PlatePreprocessor:
    """
    Applies image enhancement techniques tailored for cropped vehicle number plates.
    """

    def __init__(
        self,
        target_width: int = 320,
        apply_clahe: bool = True,
        apply_threshold: bool = True,
    ) -> None:
        self.target_width = target_width
        self.apply_clahe = apply_clahe
        self.apply_threshold = apply_threshold

    def preprocess(self, crop: np.ndarray) -> np.ndarray:
        """
        Enhance a cropped license plate image for OCR.

        Parameters
        ----------
        crop:
            BGR or grayscale NumPy array of the cropped plate.

        Returns
        -------
        np.ndarray
            Enhanced image (grayscale or binary).
        """
        if crop is None or crop.size == 0:
            raise ValueError("Input crop is empty or None")

        # 1. Resize to target width preserving aspect ratio
        h, w = crop.shape[:2]
        if w < 10 or h < 5:
            raise ValueError(f"Crop dimensions ({w}x{h}) too small for preprocessing")

        scale = self.target_width / float(w)
        new_w = self.target_width
        new_h = max(int(h * scale), 20)
        resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        # 2. Grayscale conversion
        if resized.ndim == 3:
            if resized.shape[2] == 4:
                gray = cv2.cvtColor(resized, cv2.COLOR_BGRA2GRAY)
            elif resized.shape[2] == 3:
                gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            else:
                gray = resized[:, :, 0]
        else:
            gray = resized.copy()

        # 3. Bilateral filter to smooth noise while keeping edges sharp
        filtered = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

        # 4. Contrast Limiting Adaptive Histogram Equalization (CLAHE)
        if self.apply_clahe:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(filtered)
        else:
            enhanced = filtered

        # 5. Optional Adaptive Threshold / Otsu Binarization
        if self.apply_threshold:
            # Otsu thresholding
            _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return binary

        return enhanced

    def get_variants(self, crop: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate both enhanced grayscale and binarised variants of a crop.

        Returns
        -------
        (grayscale_enhanced, binarized)
        """
        if crop is None or crop.size == 0:
            raise ValueError("Input crop is empty or None")

        h, w = crop.shape[:2]
        scale = self.target_width / float(max(w, 1))
        new_w = self.target_width
        new_h = max(int(h * scale), 20)
        resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        if resized.ndim == 3:
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        else:
            gray = resized.copy()

        filtered = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(filtered)

        _, binary = cv2.threshold(enhanced_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        return enhanced_gray, binary
