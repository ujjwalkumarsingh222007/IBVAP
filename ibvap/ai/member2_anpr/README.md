# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**  
Module: `ai/member2_anpr/`  
Phase: 2 — Real ANPR Implementation  

---

## 1. Overview

The **ANPR (Automatic Number Plate Recognition)** subsystem processes video frames and cropped vehicle regions to detect license plates, enhance plate images, perform OCR, normalize and validate Indian registration numbers, match against active watchlists, and generate standardized `IBVAPEvent` payloads for Member 3's backend.

Phase 2 introduces real model integrations (`YOLOPlateDetector`, `EasyOCREngine`), an image preprocessing pipeline (`PlatePreprocessor`), position-aware Indian plate normalisation, and Indian vehicle registration format validation.

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
Place your trained YOLO license plate detection weights (`.pt` file) in a directory such as `ai/member2_anpr/models/`:

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

## 7. Configuration Reference

Environment variables supported by `config.py`:

| Environment Variable | Default | Description |
|---|---|---|
| `PLATE_MODEL_PATH` | `models/license_plate.pt` | Path to YOLO detector model weights |
| `PLATE_CONFIDENCE_THRESHOLD` | `0.40` | Detection score threshold for plate bounding boxes |
| `PLATE_DEVICE` | `cpu` | Device for detector inference (`cpu` / `cuda`) |
| `ANPR_OCR_BACKEND` | `mock` | Default OCR engine (`mock` / `easyocr`) |
| `ANPR_OCR_CONF` | `0.40` | Minimum acceptable OCR confidence |
| `ANPR_OCR_LANGUAGES` | `en` | Comma-separated OCR languages (e.g. `en`) |
| `ANPR_OCR_GPU` | `false` | Enable/disable GPU for EasyOCR |
| `ANPR_PREPROCESS_ENABLED` | `true` | Enable bilateral filtering, CLAHE, and thresholding |
| `ANPR_PREPROCESS_WIDTH` | `320` | Standard target width for cropped plate images |
| `ANPR_DEFAULT_CAMERA_ID` | `CAM-01` | Default camera ID identifier |
| `ANPR_LOG_LEVEL` | `INFO` | Python logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## 8. Indian Registration Number Validation

The `recognizer.py` module includes position-aware character confusion correction (e.g., correcting digit `0` to letter `O` in state prefix positions, or `O` to `0` in numeric positions) and validates formats:
- **Standard State Registration:** `XX 00 XX 0000` / `XX 00 X 0000` (e.g., `TN09AB1234`, `MH12DE1433`)
- **Bharat Series (BH):** `YY BH 0000 XX` (e.g., `22BH1234AA`)
- **Legacy / Short Formats:** `XX 00 0000` (e.g., `DL3C1234`)

---

## 9. Testing

The entire test suite executes in ~0.2s on CPU without requiring GPU or downloaded model weights:

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

---

## 10. Future Integration

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
