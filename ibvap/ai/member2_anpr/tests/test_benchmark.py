"""
Tests for ANPR performance benchmarking subsystem.
"""

from __future__ import annotations

import numpy as np
import pytest

from ai.member2_anpr.benchmark import ANPRBenchmark, BenchmarkReport, ComponentTiming
from ai.member2_anpr.pipeline import ANPRPipeline


class TestANPRBenchmark:

    def test_run_benchmark_mock_pipeline(self, valid_frame):
        pipeline = ANPRPipeline()
        benchmark = ANPRBenchmark(mode="mock")

        report = benchmark.run_benchmark(
            pipeline=pipeline,
            frames=[valid_frame],
            num_frames=10,
            warmup_frames=2,
            camera_id="TEST-CAM",
        )

        assert isinstance(report, BenchmarkReport)
        assert report.mode == "mock"
        assert report.total_frames == 10
        assert report.total_time_seconds > 0
        assert report.fps > 0
        assert report.pipeline_latency.count == 10
        assert report.pipeline_latency.mean_ms >= 0

    def test_component_metrics_collected(self):
        pipeline = ANPRPipeline()
        benchmark = ANPRBenchmark(mode="mock")

        report = benchmark.run_benchmark(
            pipeline=pipeline,
            num_frames=5,
            warmup_frames=1,
        )

        assert "Detector" in report.components
        assert "Preprocessor" in report.components
        assert "OCR Engine" in report.components
        assert "Plate Recognizer" in report.components

        detector_timing = report.components["Detector"]
        assert isinstance(detector_timing, ComponentTiming)
        assert detector_timing.count == 5

    def test_summary_table_formatting(self):
        pipeline = ANPRPipeline()
        benchmark = ANPRBenchmark(mode="mock")
        report = benchmark.run_benchmark(pipeline=pipeline, num_frames=5, warmup_frames=1)

        table = report.summary_table()
        assert isinstance(table, str)
        assert "IBVAP ANPR Performance Benchmark Report" in table
        assert "Overall Throughput" in table
        assert "Detector" in table

    def test_report_json_serialization(self):
        pipeline = ANPRPipeline()
        benchmark = ANPRBenchmark(mode="mock")
        report = benchmark.run_benchmark(pipeline=pipeline, num_frames=5, warmup_frames=1)

        json_str = report.to_json()
        assert isinstance(json_str, str)
        assert '"mode": "mock"' in json_str
        assert '"fps":' in json_str
