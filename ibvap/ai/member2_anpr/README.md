# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**  
Module: `ai/member2_anpr/`  
Phase: 3 — Real-World ANPR Validation, Robustness Testing & Performance  

---

## 1. Overview

The **ANPR (Automatic Number Plate Recognition)** subsystem processes video frames and cropped vehicle regions to detect license plates, enhance plate images, perform OCR, normalize and validate Indian registration numbers, match against active watchlists, and generate standardized `IBVAPEvent` payloads for Member 3's backend.

Phase 3 introduces real-world robustness testing across 10 distinct surveillance conditions (blurry plates, low-light/night, perspective warp, multi-plate, invalid OCR rejection, character confusion), a component-level latency & throughput benchmarking tool (`ANPRBenchmark`), and expanded test coverage (166 passing tests).

---

## 2. Responsibilities

Member 2 exclusively owns all code under `ai/member2_anpr/`.

| Responsibility | Module | Class / Helper |
|---|---|---|
| License plate detection | `detector.py` | `BasePlateDetector`, `MockPlateDetector`, `YOLOPlateDetector` |
| Image preprocessing | `preprocessing.py` | `PlatePreprocessor` (resize, CLAHE, bilateral filter, binarization) |
| Optical Character Recognition (OCR) | `ocr.py` | `BaseOCREngine`, `MockOCREngine`, `EasyOCREngine` |
| Plate normalisation & validation | `recognizer.py` | `PlateRecognizer`, `normalise_plate()`, `validate_indian_plate()` |
| In-memory watchlist matching | `watchlist.py` | `BaseWatchlistMatcher`, `InMemoryWatchlistMatcher` |
| Standardised event generation | `event_generator.py` | `ANPREventGenerator` |
| End-to-end orchestration | `pipeline.py` | `ANPRPipeline` |
| Benchmarking & profiling | `benchmark.py` | `ANPRBenchmark`, `BenchmarkReport`, `ComponentTiming` |
| Data contracts / schemas | `schemas.py` | `PlateRegion`, `OCRResult`, `RecognitionResult`, `IBVAPEvent`, `ANPRResult` |
| Configuration | `config.py` | `ANPRConfig`, `default_config` |
| CLI / Demo Entrypoint | `main.py` | Command line runner |

---

## 3. Architecture

```text
Input Frame (NumPy BGR array)
      │
      ▼
YOLOPlateDetector / BasePlateDetector
      │   → List[PlateRegion] (x1, y1, x2, y2, confidence)
      │
      ▼   (crop plate bounding box)
PlatePreprocessor
      │   → Enhanced Grayscale / Binarized variants
      │
      ▼
EasyOCREngine / BaseOCREngine
      │   → OCRResult (raw_text, confidence, engine)
      │
      ▼
PlateRecognizer (normalise_plate + validate_indian_plate)
      │   → RecognitionResult (plate_number, validation_passed, confidence)
      │
      ▼
InMemoryWatchlistMatcher / BaseWatchlistMatcher
      │   → WatchlistResult (is_match, status, reason)
      │
      ▼
ANPREventGenerator
      │   → IBVAPEvent (camera_id, event_type, confidence, metadata)
      │
      ▼
List[ANPRResult]
```

---

## 4. Installation

```bash
# Navigate to repository root
cd ibvap/ai/member2_anpr

# Install dependencies
pip install -r requirements.txt
```

---

## 5. Model Setup & Weights

### License Plate Detection (YOLO)
Place your trained YOLO license plate detection weights (`.pt` file) in `ai/member2_anpr/models/`:

```text
ai/member2_anpr/
└── models/
    └── license_plate.pt
```

Set the model path via environment variable or pass it to `YOLOPlateDetector`:
```bash
export PLATE_MODEL_PATH="models/license_plate.pt"
export PLATE_DEVICE="cpu" # or "cuda"
```

> **Note:** Model weights are not committed to Git. If the model file is not present, `YOLOPlateDetector` raises an informative `FileNotFoundError`. The automated unit test suite uses mocks and does not require weights.

### OCR (EasyOCR)
EasyOCR automatically downloads lightweight character recognition models to `~/.EasyOCR/` upon first invocation. To disable GPU on CPU-only machines:
```bash
export ANPR_OCR_GPU="false"
```

---

## 6. Usage & CLI

### CLI Demo Runner

```bash
# Run simulation using mock components (no weights required)
python -m ai.member2_anpr.main --mock

# Run on a local vehicle image with mock pipeline
python -m ai.member2_anpr.main --mock --image test_vehicle.jpg --camera CAM-01 --vehicle-id VEH-101

# Run with real YOLO + EasyOCR pipeline on a local image
python -m ai.member2_anpr.main --image test_vehicle.jpg --model-path models/license_plate.pt

# Run performance benchmark
python -m ai.member2_anpr.main --benchmark --num-frames 30 --mock
```

### Python API Example

```python
import cv2
from ai.member2_anpr import (
    ANPRPipeline,
    YOLOPlateDetector,
    EasyOCREngine,
    PlateRecognizer,
    InMemoryWatchlistMatcher,
    ANPREventGenerator,
)

# Initialize components once
detector = YOLOPlateDetector(model_path="models/license_plate.pt", device="cpu")
ocr = EasyOCREngine(languages=["en"], gpu=False)
recognizer = PlateRecognizer()
watchlist = InMemoryWatchlistMatcher()
event_gen = ANPREventGenerator()

# Build pipeline via dependency injection
pipeline = ANPRPipeline(
    detector=detector,
    ocr_engine=ocr,
    recognizer=recognizer,
    watchlist=watchlist,
    event_generator=event_gen,
)

# Process a frame
frame = cv2.imread("traffic_snapshot.jpg")
results = pipeline.process_frame(
    frame=frame,
    camera_id="CAM-BORDER-01",
    vehicle_id="VEH-4092",
)

for result in results:
    if result.success:
        print(f"Plate: {result.plate_number}")
        print(f"Plate Conf: {result.plate_confidence}, OCR Conf: {result.ocr_confidence}")
        print(f"Watchlist Hit: {result.watchlist_match}")
        print(f"Event: {result.event.model_dump()}")
```

---

## 7. Performance Benchmarking

The `benchmark.py` module provides latency measurement across all pipeline stages:

```python
from ai.member2_anpr import ANPRPipeline, ANPRBenchmark

pipeline = ANPRPipeline()
benchmark = ANPRBenchmark(mode="mock")
report = benchmark.run_benchmark(pipeline=pipeline, num_frames=50)

print(report.summary_table())
```

Sample Benchmark Output:
```text
=================================================================
IBVAP ANPR Performance Benchmark Report (Mode: MOCK)
=================================================================
Total Frames Processed : 50
Total Elapsed Time     : 0.075 s
Overall Throughput     : 668.42 FPS
Pipeline Mean Latency  : 0.25 ms (+/- 0.04 ms)
Pipeline Latency Range : [0.18 ms - 0.38 ms]
-----------------------------------------------------------------
Component              | Mean (ms)  | Median   | Min      | Max     
-----------------------------------------------------------------
Detector               | 0.01       | 0.01     | 0.01     | 0.08    
Preprocessor           | 1.15       | 1.04     | 0.92     | 2.80    
OCR Engine             | 0.02       | 0.02     | 0.01     | 0.05    
Plate Recognizer       | 0.04       | 0.04     | 0.03     | 0.06    
=================================================================
```

---

## 8. Real-World Robustness Validation

The module is verified against 10 critical surveillance conditions:

1. **Clear Plates:** Standard high-contrast Indian registration plates.
2. **Blurry Plates:** Defocus (Gaussian blur) and vehicle motion blur simulated via kernel convolution; verified preprocessing stability.
3. **Low-Light / Night:** High-noise, dark images enhanced via bilateral filter and CLAHE contrast equalization.
4. **Angled / Perspective Distortion:** Plates with perspective warp and non-standard aspect ratios.
5. **Multiple Plates:** Multi-vehicle frames returning independent `ANPRResult` instances.
6. **No Plate Detected:** Clean empty returns with zero crashes or false alarms.
7. **Invalid OCR:** Random noise and impossible plate structures safely rejected by `validate_indian_plate()`.
8. **OCR Character Confusion:** Conservative position-aware correction (`O↔0`, `I↔1`, `Z↔2`, `S↔5`, `B↔8`, `G↔6`).
9. **Watchlist Edge Cases:** Leading/trailing whitespace, case insensitivity, duplicate entries, and empty watchlist.
10. **Vehicle ID Integrity:** Consistent propagation of `vehicle_id` into event metadata.

---

## 9. Limitations & Practical Considerations

- **Extreme Angles (> 45°):** Highly skewed plates may suffer OCR degradation without 4-point perspective rectification.
- **Heavy Motion Blur:** Preprocessing enhances contrast but cannot reconstruct severely smudged characters without deblurring networks.
- **CPU vs GPU:** On CPU, EasyOCR inference averages ~150–300 ms/crop; on CUDA GPU, latency drops to ~15–35 ms/crop.
- **Non-Standard Font Stylings:** Decorative or embossed font variations may require custom OCR fine-tuning.

---

## 10. Testing

The entire test suite executes in ~0.5s on CPU without requiring GPU or downloaded model weights:

```bash
# Run all tests
python -m pytest ai/member2_anpr/tests/ -v

# Run with coverage report
python -m pytest ai/member2_anpr/tests/ -v --cov=ai.member2_anpr --cov-report=term-missing
```

Test modules:
- `test_detector.py`: Base detector & mock detector contract tests
- `test_yolo_detector.py`: YOLO detector tests with mocked Ultralytics inference
- `test_preprocessing.py`: Plate preprocessor tests (rescaling, CLAHE, binarization, edge cases)
- `test_ocr.py`: Base OCR engine & mock OCR tests
- `test_easyocr_engine.py`: EasyOCR tests with mocked reader instances
- `test_recognizer.py`: Normalisation, confusion map correction, and Indian registration validation
- `test_watchlist.py`: Watchlist matching, case insensitivity, and dynamic additions
- `test_event_generator.py`: `ANPR_DETECTED` / `WATCHLIST_MATCH` event construction & `vehicle_id` support
- `test_pipeline.py`: End-to-end pipeline orchestration, multi-plate processing, error isolation
- `test_robustness.py`: 10-area robustness validation (blurry, dark, angled, noisy, multi-plate, etc.)
- `test_benchmark.py`: Benchmarking latency, FPS computation, and report serialization

---

## 11. Backend Integration

Member 2 produces standardized `IBVAPEvent` payloads that Member 3 (Backend) will ingest via its REST API:

```json
{
  "camera_id": "CAM-01",
  "event_type": "ANPR_DETECTED",
  "timestamp": "2026-08-28T15:30:00+00:00",
  "confidence": 0.92,
  "metadata": {
    "plate_number": "TN09AB1234",
    "raw_ocr_text": "TN 09 AB 1234",
    "plate_confidence": 0.94,
    "ocr_confidence": 0.91,
    "vehicle_id": "VEH-101",
    "watchlist_match": false,
    "validation_passed": true,
    "validation_reason": "Standard Indian Plate (TN)"
  }
}
```

The backend needs only to consume `IBVAPEvent` without any coupling to detector, OCR, or preprocessing internals.
