"""
IBVAP - Member 2 ANPR Module - benchmark.py

Performance benchmarking and latency profiling subsystem for the ANPR pipeline.
Measures component-level execution times and overall FPS.
"""

from __future__ import annotations

import json
import logging
import statistics
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from .detector import BasePlateDetector, MockPlateDetector
from .ocr import BaseOCREngine, MockOCREngine
from .pipeline import ANPRPipeline
from .preprocessing import PlatePreprocessor
from .recognizer import PlateRecognizer
from .schemas import PlateRegion

logger = logging.getLogger(__name__)


@dataclass
class ComponentTiming:
    """Latency metrics for an individual ANPR component in milliseconds."""
    name: str
    count: int = 0
    mean_ms: float = 0.0
    median_ms: float = 0.0
    std_dev_ms: float = 0.0
    min_ms: float = 0.0
    max_ms: float = 0.0


@dataclass
class BenchmarkReport:
    """Consolidated ANPR performance benchmark results."""
    mode: str  # "mock" or "real"
    total_frames: int
    total_time_seconds: float
    fps: float
    pipeline_latency: ComponentTiming
    components: Dict[str, ComponentTiming] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary."""
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        """Serialize report to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def summary_table(self) -> str:
        """Format report into human-readable summary table."""
        lines = [
            "=" * 65,
            f"IBVAP ANPR Performance Benchmark Report (Mode: {self.mode.upper()})",
            "=" * 65,
            f"Total Frames Processed : {self.total_frames}",
            f"Total Elapsed Time     : {self.total_time_seconds:.3f} s",
            f"Overall Throughput     : {self.fps:.2f} FPS",
            f"Pipeline Mean Latency  : {self.pipeline_latency.mean_ms:.2f} ms (+/- {self.pipeline_latency.std_dev_ms:.2f} ms)",
            f"Pipeline Latency Range : [{self.pipeline_latency.min_ms:.2f} ms - {self.pipeline_latency.max_ms:.2f} ms]",
            "-" * 65,
            f"{'Component':<22} | {'Mean (ms)':<10} | {'Median':<8} | {'Min':<8} | {'Max':<8}",
            "-" * 65,
        ]
        for name, timing in self.components.items():
            lines.append(
                f"{name:<22} | {timing.mean_ms:<10.2f} | {timing.median_ms:<8.2f} | {timing.min_ms:<8.2f} | {timing.max_ms:<8.2f}"
            )
        lines.append("=" * 65)
        return "\n".join(lines)


class ANPRBenchmark:
    """
    Measures processing latencies across components and end-to-end pipeline.
    """

    def __init__(self, mode: str = "mock") -> None:
        self.mode = mode

    @staticmethod
    def _compute_stats(name: str, durations_sec: List[float]) -> ComponentTiming:
        if not durations_sec:
            return ComponentTiming(name=name)

        ms_list = [d * 1000.0 for d in durations_sec]
        return ComponentTiming(
            name=name,
            count=len(ms_list),
            mean_ms=round(statistics.mean(ms_list), 3),
            median_ms=round(statistics.median(ms_list), 3),
            std_dev_ms=round(statistics.stdev(ms_list), 3) if len(ms_list) > 1 else 0.0,
            min_ms=round(min(ms_list), 3),
            max_ms=round(max(ms_list), 3),
        )

    def run_benchmark(
        self,
        pipeline: ANPRPipeline,
        frames: Optional[List[np.ndarray]] = None,
        num_frames: int = 30,
        warmup_frames: int = 3,
        camera_id: str = "BENCH-CAM",
    ) -> BenchmarkReport:
        """
        Execute end-to-end and component-level benchmark.

        Parameters
        ----------
        pipeline:
            Instantiated ANPRPipeline.
        frames:
            Optional list of numpy frames. If None, synthetic 640x480 frames are generated.
        num_frames:
            Number of iterations to benchmark.
        warmup_frames:
            Number of initial iterations to exclude from metrics.
        camera_id:
            Camera identifier string.

        Returns
        -------
        BenchmarkReport
        """
        if frames is None:
            # Generate synthetic test frames
            frames = [
                np.full((480, 640, 3), fill_value=(i * 7) % 255, dtype=np.uint8)
                for i in range(num_frames + warmup_frames)
            ]
        elif len(frames) < num_frames + warmup_frames:
            # Cycle available frames to match required count
            orig = list(frames)
            while len(frames) < num_frames + warmup_frames:
                frames.append(orig[len(frames) % len(orig)])

        logger.info(
            "Starting ANPR Benchmark: total=%d frames, warmup=%d frames, mode=%s",
            num_frames,
            warmup_frames,
            self.mode,
        )

        # 1. Warm-up runs
        for i in range(warmup_frames):
            pipeline.process_frame(frames[i], camera_id=camera_id)

        # 2. Benchmark runs
        pipeline_durations: List[float] = []
        detector_durations: List[float] = []
        ocr_durations: List[float] = []
        preproc_durations: List[float] = []
        recognizer_durations: List[float] = []

        preprocessor = PlatePreprocessor()

        total_start = time.perf_counter()

        for idx in range(warmup_frames, warmup_frames + num_frames):
            frame = frames[idx]

            # Pipeline full run
            p_start = time.perf_counter()
            results = pipeline.process_frame(frame, camera_id=camera_id)
            p_end = time.perf_counter()
            pipeline_durations.append(p_end - p_start)

            # Component: Detector
            d_start = time.perf_counter()
            regions = pipeline._detector.detect(frame)
            d_end = time.perf_counter()
            detector_durations.append(d_end - d_start)

            # Measure OCR, preprocessing, and recognizer on detected/dummy regions
            if regions:
                region = regions[0]
            else:
                region = PlateRegion(x1=100, y1=150, x2=350, y2=230, confidence=0.90)

            crop = frame[region.y1:region.y2, region.x1:region.x2]
            if crop.size > 0:
                # Component: Preprocessor
                pr_start = time.perf_counter()
                preprocessed = preprocessor.preprocess(crop)
                pr_end = time.perf_counter()
                preproc_durations.append(pr_end - pr_start)

                # Component: OCR
                o_start = time.perf_counter()
                ocr_res = pipeline._ocr.read(crop)
                o_end = time.perf_counter()
                ocr_durations.append(o_end - o_start)

                # Component: Recognizer
                r_start = time.perf_counter()
                pipeline._recognizer.recognise(ocr_res)
                r_end = time.perf_counter()
                recognizer_durations.append(r_end - r_start)

        total_elapsed = time.perf_counter() - total_start
        fps = round(num_frames / total_elapsed, 2) if total_elapsed > 0 else 0.0

        pipeline_timing = self._compute_stats("Pipeline (End-to-End)", pipeline_durations)
        components = {
            "Detector": self._compute_stats("Detector", detector_durations),
            "Preprocessor": self._compute_stats("Preprocessor", preproc_durations),
            "OCR Engine": self._compute_stats("OCR Engine", ocr_durations),
            "Plate Recognizer": self._compute_stats("Plate Recognizer", recognizer_durations),
        }

        return BenchmarkReport(
            mode=self.mode,
            total_frames=num_frames,
            total_time_seconds=round(total_elapsed, 4),
            fps=fps,
            pipeline_latency=pipeline_timing,
            components=components,
        )
