"""
Tests for YOLOPlateDetector.

Uses mocked ultralytics YOLO instances so no model weights or GPU are needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock
import numpy as np
import pytest

from ai.member2_anpr.detector import YOLOPlateDetector
from ai.member2_anpr.schemas import PlateRegion


class DummyBox:
    def __init__(self, xyxy, conf):
        self.xyxy = [xyxy]
        self.conf = [conf]


class DummyResult:
    def __init__(self, boxes):
        self.boxes = boxes


class DummyYOLOModel:
    def __init__(self, detections=None):
        self.detections = detections or []

    def predict(self, source, conf=0.4, device="cpu", verbose=False):
        return [DummyResult(boxes=self.detections)]


class TestYOLOPlateDetector:

    def test_init_missing_model_raises_file_not_found(self):
        with pytest.raises(FileNotFoundError, match="not found"):
            YOLOPlateDetector(model_path="non_existent_weights_12345.pt")

    def test_init_with_injected_model(self, valid_frame):
        mock_model = DummyYOLOModel(
            detections=[DummyBox([100.0, 200.0, 300.0, 260.0], 0.92)]
        )
        detector = YOLOPlateDetector(model_instance=mock_model, confidence_threshold=0.40)
        regions = detector.detect(valid_frame)

        assert len(regions) == 1
        assert isinstance(regions[0], PlateRegion)
        assert regions[0].x1 == 100
        assert regions[0].y1 == 200
        assert regions[0].x2 == 300
        assert regions[0].y2 == 260
        assert regions[0].confidence == pytest.approx(0.92, abs=1e-3)

    def test_confidence_threshold_filtering(self, valid_frame):
        mock_model = DummyYOLOModel(
            detections=[
                DummyBox([50, 50, 150, 100], 0.85),
                DummyBox([200, 200, 300, 250], 0.30),  # below threshold 0.50
            ]
        )
        detector = YOLOPlateDetector(model_instance=mock_model, confidence_threshold=0.50)
        regions = detector.detect(valid_frame)

        assert len(regions) == 1
        assert regions[0].confidence == 0.85

    def test_empty_prediction_returns_empty_list(self, valid_frame):
        mock_model = DummyYOLOModel(detections=[])
        detector = YOLOPlateDetector(model_instance=mock_model)
        regions = detector.detect(valid_frame)

        assert regions == []

    def test_invalid_frame_validation(self):
        mock_model = DummyYOLOModel()
        detector = YOLOPlateDetector(model_instance=mock_model)

        with pytest.raises(ValueError):
            detector.detect(None)
        with pytest.raises(ValueError):
            detector.detect(np.zeros((0, 0, 3), dtype=np.uint8))
