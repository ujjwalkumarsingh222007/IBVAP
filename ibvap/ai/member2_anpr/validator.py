"""
IBVAP - Member 2 ANPR Module - validator.py

Real-Model validation runner, performance benchmarking, and accuracy assessment subsystem.
Evaluates ANPR pipeline on individual images, image directories, video files, and datasets.
"""

from __future__ import annotations

import json
import logging
import os
import statistics
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Union

import cv2
import numpy as np

from .pipeline import ANPRPipeline
from .preprocessing import PlatePreprocessor
from .schemas import ANPRResult
from .stream import RTSPStreamReader, mask_rtsp_url

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Evaluation result for a single image or video frame."""
    source_name: str
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    ocr_confidence: Optional[float] = None
    validation_passed: bool = False
    validation_reason: Optional[str] = None
    ground_truth: Optional[str] = None
    is_correct: Optional[bool] = None
    detector_ms: float = 0.0
    preprocessor_ms: float = 0.0
    ocr_ms: float = 0.0
    recognizer_ms: float = 0.0
    total_ms: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ValidationReport:
    """Aggregated validation statistics and component latency metrics."""
    total_samples: int = 0
    successful_detections: int = 0
    failed_detections: int = 0
    validation_passed_count: int = 0
    ground_truth_evaluated: int = 0
    ground_truth_matches: int = 0
    accuracy_percentage: float = 0.0
    detection_rate_percentage: float = 0.0
    total_elapsed_sec: float = 0.0
    throughput_fps: float = 0.0
    mean_detector_ms: float = 0.0
    mean_preprocessor_ms: float = 0.0
    mean_ocr_ms: float = 0.0
    mean_recognizer_ms: float = 0.0
    mean_total_ms: float = 0.0
    median_total_ms: float = 0.0
    min_total_ms: float = 0.0
    max_total_ms: float = 0.0
    results: List[ValidationResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def summary_table(self) -> str:
        """Format a human-readable validation summary table."""
        lines = [
            "=" * 65,
            "IBVAP ANPR Real-Model Validation & Performance Report",
            "=" * 65,
            f"Total Samples Evaluated    : {self.total_samples}",
            f"Successful Detections      : {self.successful_detections} ({self.detection_rate_percentage:.1f}%)",
            f"Failed / Empty Detections  : {self.failed_detections}",
            f"Validation Passed (Indian) : {self.validation_passed_count}",
        ]

        if self.ground_truth_evaluated > 0:
            lines.extend([
                f"Ground Truth Evaluated     : {self.ground_truth_evaluated}",
                f"Ground Truth Matches       : {self.ground_truth_matches}",
                f"Recognition Accuracy       : {self.accuracy_percentage:.1f}%",
            ])

        lines.extend([
            "-" * 65,
            f"Total Elapsed Time         : {self.total_elapsed_sec:.3f} s",
            f"Overall Throughput         : {self.throughput_fps:.2f} FPS",
            f"Mean Pipeline Latency      : {self.mean_total_ms:.2f} ms (median: {self.median_total_ms:.2f} ms)",
            f"Latency Range              : [{self.min_total_ms:.2f} ms - {self.max_total_ms:.2f} ms]",
            "-" * 65,
            "Component Mean Latency Breakdown:",
            f"  - Detector               : {self.mean_detector_ms:.2f} ms",
            f"  - Preprocessor           : {self.mean_preprocessor_ms:.2f} ms",
            f"  - OCR Engine             : {self.mean_ocr_ms:.2f} ms",
            f"  - Plate Recognizer       : {self.mean_recognizer_ms:.2f} ms",
            "=" * 65,
        ])
        return "\n".join(lines)


class ANPRValidator:
    """
    Validation engine evaluating ANPR pipeline accuracy and latency metrics.

    Parameters
    ----------
    pipeline:
        Configured ANPRPipeline instance (defaults to mock/default pipeline).
    preprocessor:
        Optional PlatePreprocessor instance for granular timing.
    """

    def __init__(
        self,
        pipeline: Optional[ANPRPipeline] = None,
        preprocessor: Optional[PlatePreprocessor] = None,
    ) -> None:
        self.pipeline = pipeline if pipeline is not None else ANPRPipeline()
        self.preprocessor = preprocessor if preprocessor is not None else PlatePreprocessor()

    def validate_image(
        self,
        image_input: Union[str, np.ndarray],
        ground_truth: Optional[str] = None,
        source_name: Optional[str] = None,
    ) -> ValidationResult:
        """
        Evaluate ANPR on a single image file or NumPy BGR frame.

        Parameters
        ----------
        image_input:
            File path (str) or OpenCV image array (np.ndarray).
        ground_truth:
            Optional expected plate number string (e.g. 'TN09AB1234').
        source_name:
            Identifier or filename for reporting.

        Returns
        -------
        ValidationResult
        """
        name = source_name or (image_input if isinstance(image_input, str) else "numpy_frame")

        # Load frame if path given
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                return ValidationResult(
                    source_name=name,
                    error=f"Image file not found: {image_input}",
                    ground_truth=ground_truth,
                )
            frame = cv2.imread(image_input)
            if frame is None:
                return ValidationResult(
                    source_name=name,
                    error=f"Failed to decode image file: {image_input}",
                    ground_truth=ground_truth,
                )
        else:
            frame = image_input

        # Measure component timings
        det_ms = 0.0
        prep_ms = 0.0
        ocr_ms = 0.0
        rec_ms = 0.0

        t_start = time.perf_counter()

        # Step 1: Detect
        t0 = time.perf_counter()
        try:
            regions = self.pipeline._detector.detect(frame)
        except Exception as exc:
            return ValidationResult(
                source_name=name,
                error=f"Detector exception: {exc}",
                ground_truth=ground_truth,
            )
        det_ms = (time.perf_counter() - t0) * 1000.0

        if not regions:
            total_ms = (time.perf_counter() - t_start) * 1000.0
            return ValidationResult(
                source_name=name,
                detector_ms=round(det_ms, 2),
                total_ms=round(total_ms, 2),
                ground_truth=ground_truth,
                is_correct=False if ground_truth else None,
            )

        # Evaluate first detected region
        region = regions[0]
        try:
            crop = self.pipeline._crop_plate(frame, region)
        except Exception as exc:
            return ValidationResult(
                source_name=name,
                detector_ms=round(det_ms, 2),
                error=f"Crop exception: {exc}",
                ground_truth=ground_truth,
            )

        # Step 2: Preprocess
        t0 = time.perf_counter()
        try:
            enhanced = self.preprocessor.enhance(crop)
        except Exception:
            enhanced = crop
        prep_ms = (time.perf_counter() - t0) * 1000.0

        # Step 3: OCR
        t0 = time.perf_counter()
        try:
            ocr_res = self.pipeline._ocr.read(enhanced)
        except Exception as exc:
            return ValidationResult(
                source_name=name,
                detector_ms=round(det_ms, 2),
                preprocessor_ms=round(prep_ms, 2),
                error=f"OCR exception: {exc}",
                ground_truth=ground_truth,
            )
        ocr_ms = (time.perf_counter() - t0) * 1000.0

        # Step 4: Recognise
        t0 = time.perf_counter()
        rec_res = self.pipeline._recognizer.recognise(ocr_res)
        rec_ms = (time.perf_counter() - t0) * 1000.0

        total_ms = (time.perf_counter() - t_start) * 1000.0

        plate_num = rec_res.plate_number if rec_res else None
        val_passed = rec_res.validation_passed if rec_res else False
        val_reason = rec_res.validation_reason if rec_res else None

        is_correct = None
        if ground_truth and plate_num:
            gt_norm = ground_truth.strip().upper().replace(" ", "").replace("-", "")
            is_correct = (plate_num == gt_norm)

        return ValidationResult(
            source_name=name,
            plate_number=plate_num,
            plate_confidence=region.confidence,
            ocr_confidence=rec_res.confidence if rec_res else None,
            validation_passed=val_passed,
            validation_reason=val_reason,
            ground_truth=ground_truth,
            is_correct=is_correct,
            detector_ms=round(det_ms, 2),
            preprocessor_ms=round(prep_ms, 2),
            ocr_ms=round(ocr_ms, 2),
            recognizer_ms=round(rec_ms, 2),
            total_ms=round(total_ms, 2),
        )

    def validate_directory(
        self,
        dir_path: str,
        ground_truth_map: Optional[Dict[str, str]] = None,
    ) -> ValidationReport:
        """
        Evaluate all images within a directory.

        Parameters
        ----------
        dir_path:
            Directory containing test images (.jpg, .jpeg, .png, .bmp).
        ground_truth_map:
            Optional mapping of filename -> expected plate string.

        Returns
        -------
        ValidationReport
        """
        if not os.path.isdir(dir_path):
            raise FileNotFoundError(f"Directory not found: {dir_path}")

        valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        image_files = [
            os.path.join(dir_path, f)
            for f in sorted(os.listdir(dir_path))
            if os.path.splitext(f.lower())[1] in valid_exts
        ]

        if not image_files:
            logger.warning("No image files found in directory: %s", dir_path)
            return ValidationReport()

        gt_map = ground_truth_map or {}
        results: List[ValidationResult] = []
        t_start = time.perf_counter()

        for img_path in image_files:
            fname = os.path.basename(img_path)
            gt = gt_map.get(fname)
            res = self.validate_image(image_input=img_path, ground_truth=gt, source_name=fname)
            results.append(res)

        total_elapsed = time.perf_counter() - t_start
        return self._build_report(results, total_elapsed)

    def validate_video(
        self,
        video_path: str,
        max_frames: Optional[int] = None,
    ) -> ValidationReport:
        """
        Evaluate ANPR performance across frames of a video file or stream.
        """
        reader = RTSPStreamReader(source=video_path)
        if not reader.open():
            raise RuntimeError(f"Cannot open video source: {mask_rtsp_url(video_path)}")

        results: List[ValidationResult] = []
        t_start = time.perf_counter()
        frame_idx = 0

        try:
            while True:
                if max_frames is not None and frame_idx >= max_frames:
                    break
                ret, frame = reader.read()
                if not ret or frame is None:
                    break
                frame_idx += 1
                res = self.validate_image(
                    image_input=frame,
                    source_name=f"frame_{frame_idx:05d}",
                )
                results.append(res)
        finally:
            reader.release()

        total_elapsed = time.perf_counter() - t_start
        return self._build_report(results, total_elapsed)

    @staticmethod
    def _build_report(results: List[ValidationResult], total_elapsed: float) -> ValidationReport:
        """Compute aggregated metrics from validation results list."""
        if not results:
            return ValidationReport()

        total_samples = len(results)
        successful = sum(1 for r in results if r.plate_number is not None and r.error is None)
        failed = total_samples - successful
        val_passed = sum(1 for r in results if r.validation_passed)

        gt_results = [r for r in results if r.ground_truth is not None]
        gt_count = len(gt_results)
        gt_matches = sum(1 for r in gt_results if r.is_correct is True)

        accuracy = (gt_matches / gt_count * 100.0) if gt_count > 0 else 0.0
        det_rate = (successful / total_samples * 100.0) if total_samples > 0 else 0.0
        fps = (total_samples / max(total_elapsed, 0.001))

        tot_latencies = [r.total_ms for r in results]
        det_latencies = [r.detector_ms for r in results]
        prep_latencies = [r.preprocessor_ms for r in results]
        ocr_latencies = [r.ocr_ms for r in results]
        rec_latencies = [r.recognizer_ms for r in results]

        return ValidationReport(
            total_samples=total_samples,
            successful_detections=successful,
            failed_detections=failed,
            validation_passed_count=val_passed,
            ground_truth_evaluated=gt_count,
            ground_truth_matches=gt_matches,
            accuracy_percentage=round(accuracy, 2),
            detection_rate_percentage=round(det_rate, 2),
            total_elapsed_sec=round(total_elapsed, 4),
            throughput_fps=round(fps, 2),
            mean_detector_ms=round(statistics.mean(det_latencies), 2),
            mean_preprocessor_ms=round(statistics.mean(prep_latencies), 2),
            mean_ocr_ms=round(statistics.mean(ocr_latencies), 2),
            mean_recognizer_ms=round(statistics.mean(rec_latencies), 2),
            mean_total_ms=round(statistics.mean(tot_latencies), 2),
            median_total_ms=round(statistics.median(tot_latencies), 2),
            min_total_ms=round(min(tot_latencies), 2),
            max_total_ms=round(max(tot_latencies), 2),
            results=results,
        )
