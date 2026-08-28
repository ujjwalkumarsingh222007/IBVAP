# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**  
Module: `ai/member2_anpr/`  
Phase: 6 — Real-Model Validation & Production Hardening  

---

## 1. Overview

The **ANPR (Automatic Number Plate Recognition)** subsystem processes live IP-camera/RTSP video streams, recorded video files, and vehicle image crops to detect license plates, enhance plate images, perform OCR, normalize and validate Indian registration numbers, match against active watchlists, suppress duplicate detections on continuous streams, and generate standardized `IBVAPEvent` payloads for Member 3's backend.

Phase 6 introduces **Real-Model Validation Runner** (`ANPRValidator`), **Indian State Code & Structural False-Positive Filtering**, **Strict Validation Modes**, **Production Error Resilience**, and **Component-Level Latency Profiling** across 223 automated unit tests (89% code coverage).

---

## 2. Responsibilities

Member 2 exclusively owns all code under `ai/member2_anpr/`.

| Responsibility | Module | Class / Helper |
|---|---|---|
| Real-model validation runner | `validator.py` | `ANPRValidator`, `ValidationReport`, `ValidationResult` |
| RTSP stream capture | `stream.py` | `RTSPStreamReader`, `mask_rtsp_url()` |
| Real-time stream processing | `stream_processor.py` | `ANPRStreamProcessor`, `StreamStatistics` |
| Public integration interface | `__init__.py` | `process_frame_to_events()` |
| License plate detection | `detector.py` | `BasePlateDetector`, `MockPlateDetector`, `YOLOPlateDetector` |
| Image preprocessing | `preprocessing.py` | `PlatePreprocessor` (resize, CLAHE, bilateral filter, binarization) |
| Optical Character Recognition (OCR) | `ocr.py` | `BaseOCREngine`, `MockOCREngine`, `EasyOCREngine` |
| Plate normalisation & validation | `recognizer.py` | `PlateRecognizer`, `normalise_plate()`, `validate_indian_plate()`, `INDIAN_STATE_CODES` |
| Duplicate event suppression | `suppressor.py` | `DuplicateSuppressor` (thread-safe, in-memory) |
| Watchlist matching | `watchlist.py` | `BaseWatchlistMatcher`, `InMemoryWatchlistMatcher` |
| Standardised event generation | `event_generator.py` | `ANPREventGenerator` |
| End-to-end orchestration | `pipeline.py` | `ANPRPipeline` |
| Benchmarking & profiling | `benchmark.py` | `ANPRBenchmark`, `BenchmarkReport`, `ComponentTiming` |
| Data contracts / schemas | `schemas.py` | `PlateRegion`, `OCRResult`, `RecognitionResult`, `IBVAPEvent`, `ANPRResult` |
| Configuration | `config.py` | `ANPRConfig`, `default_config` |
| CLI / Demo Entrypoint | `main.py` | Command line runner |

---

## 3. Architecture

```text
IP CCTV / RTSP Stream / Image Dataset
      │
      ▼
RTSPStreamReader / Image Loader (with credential masking)
      │
      ▼
ANPRStreamProcessor / ANPRValidator
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
PlateRecognizer (normalise_plate + validate_indian_plate + State/UT codes)
      │   → RecognitionResult (plate_number, validation_passed, confidence)
      │
      ▼
InMemoryWatchlistMatcher / BaseWatchlistMatcher
      │   → WatchlistResult (is_match, status, reason)
      │
      ▼
DuplicateSuppressor (In-Memory Stream Filter)
      │   → Filter duplicate detections within time window
      │
      ▼
ANPREventGenerator
      │   → IBVAPEvent (camera_id, event_type, confidence, metadata)
      │
      ▼
List[IBVAPEvent] ───► Member 3 Backend (FastAPI Ingestion)
```

---

## 4. Real-Model Validation & Benchmarking (Phase 6)

The `ANPRValidator` evaluates plate detection and character recognition accuracy against ground truth datasets, while recording component-level latency breakdowns:

### Running Validation

```bash
# Validate on single image with expected ground truth
python -m ai.member2_anpr.main --validate --image path/to/plate.jpg --ground-truth "DL01AB1234"

# Validate directory of test images
python -m ai.member2_anpr.main --validate --validation-dir path/to/test_dataset/

# Validate directory with ground truth mapping JSON
python -m ai.member2_anpr.main --validate --validation-dir path/to/images/ --ground-truth gt_map.json
```

### Sample Validation Report Output

```text
=================================================================
IBVAP ANPR Real-Model Validation & Performance Report
=================================================================
Total Samples Evaluated    : 50
Successful Detections      : 48 (96.0%)
Failed / Empty Detections  : 2
Validation Passed (Indian) : 48
Ground Truth Evaluated     : 50
Ground Truth Matches       : 47
Recognition Accuracy       : 94.0%
-----------------------------------------------------------------
Total Elapsed Time         : 1.250 s
Overall Throughput         : 40.00 FPS
Mean Pipeline Latency      : 24.50 ms (median: 23.80 ms)
Latency Range              : [18.20 ms - 34.10 ms]
-----------------------------------------------------------------
Component Mean Latency Breakdown:
  - Detector               : 8.20 ms
  - Preprocessor           : 1.10 ms
  - OCR Engine             : 14.80 ms
  - Plate Recognizer       : 0.40 ms
=================================================================
```

---

## 5. False-Positive Filtering & Indian State Codes

To eliminate OCR hallucinations and noisy background detections, `recognizer.py` validates plates against:

1. **State & UT Codes (`INDIAN_STATE_CODES`):** Verifies the 2-letter prefix against official codes (`DL`, `MH`, `TN`, `KA`, `UP`, `HR`, `GJ`, `WB`, `KL`, `RJ`, `TS`, `AP`, `PB`, `BR`, `JH`, `CH`, etc.).
2. **Bharat (BH) Series:** Formats like `22BH1234AA` (Year + BH + 4 Digits + Series).
3. **Position-Aware Character Confusion:** Automatically disambiguates `O↔0`, `I↔1`, `Z↔2`, `S↔5`, `B↔8`, `G↔6` based on character index position in Indian registration formats.
4. **Strict Validation Mode:** Setting `strict_plate_validation = True` (or `ANPR_STRICT_VALIDATION="true"`) strictly discards any plate that does not match standard registration structure.

---

## 6. Backend Integration Contract (Member 3)

Member 3 (FastAPI Backend) consumes standardized `IBVAPEvent` objects without depending on internal YOLO, EasyOCR, or preprocessing classes.

### How Member 3 Consumes ANPR Events

```python
from ai.member2_anpr import process_frame_to_events, IBVAPEvent

# When video processing receives a frame:
events: list[IBVAPEvent] = process_frame_to_events(
    frame=opencv_bgr_frame,
    camera_id="CAM-BORDER-01",
    vehicle_id="VEH-8821",          # Optional: supplied by Member 1's tracker
    suppress_duplicates=True,       # Default: suppresses stream duplicate events
)

# Ingest events into backend database / API emission
for event in events:
    await event_repository.save(event.model_dump())
```

### Event Payload Formats

#### Standard ANPR Detection (`ANPR_DETECTED`):
```json
{
  "camera_id": "CAM-BORDER-01",
  "event_type": "ANPR_DETECTED",
  "timestamp": "2026-08-28T15:30:00+00:00",
  "confidence": 0.92,
  "metadata": {
    "plate_number": "TN09AB1234",
    "raw_ocr_text": "TN 09 AB 1234",
    "plate_confidence": 0.94,
    "ocr_confidence": 0.91,
    "vehicle_id": "VEH-8821",
    "watchlist_match": false,
    "validation_passed": true,
    "validation_reason": "Standard Indian Plate (TN)"
  }
}
```

#### Watchlist Hit (`WATCHLIST_MATCH`):
```json
{
  "camera_id": "CAM-BORDER-01",
  "event_type": "WATCHLIST_MATCH",
  "timestamp": "2026-08-28T15:30:00+00:00",
  "confidence": 0.93,
  "metadata": {
    "plate_number": "MH12DE1433",
    "raw_ocr_text": "MH12DE1433",
    "plate_confidence": 0.95,
    "ocr_confidence": 0.92,
    "vehicle_id": "VEH-9012",
    "watchlist_match": true,
    "watchlist_status": "STOLEN",
    "watchlist_reason": "Reported stolen - 2026-01-15",
    "validation_passed": true,
    "validation_reason": "Standard Indian Plate (MH)"
  }
}
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
| `ANPR_MIN_PLATE_CONF` | `0.40` | Overall minimum confidence for plate emission |
| `ANPR_STRICT_VALIDATION` | `false` | Enable strict Indian state code & structure check |
| `ANPR_OCR_LANGUAGES` | `en` | Comma-separated OCR languages (e.g. `en`) |
| `ANPR_OCR_GPU` | `false` | Enable/disable GPU for EasyOCR |
| `ANPR_PREPROCESS_ENABLED` | `true` | Enable bilateral filtering, CLAHE, and thresholding |
| `ANPR_PREPROCESS_WIDTH` | `320` | Standard target width for cropped plate images |
| `ANPR_DUPLICATE_SUPPRESSION_ENABLED` | `true` | Enable duplicate event suppression for live streams |
| `ANPR_DUPLICATE_WINDOW_SEC` | `10.0` | Duplicate suppression time window (seconds) |
| `ANPR_RTSP_URL` | `None` | Default RTSP stream URL or video source path |
| `ANPR_FRAME_SKIP` | `0` | Frames to skip between ANPR evaluations (default 0) |
| `ANPR_RECONNECT_ATTEMPTS` | `3` | Maximum consecutive stream reconnect attempts |
| `ANPR_RECONNECT_DELAY_SEC` | `2.0` | Delay between stream reconnection attempts |
| `ANPR_STREAM_TIMEOUT_SEC` | `10.0` | Stream connection timeout in seconds |
| `ANPR_DEFAULT_CAMERA_ID` | `CAM-01` | Default camera ID identifier |
| `ANPR_LOG_LEVEL` | `INFO` | Python logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## 8. Testing & Coverage

The entire test suite executes in ~1.5s on CPU without requiring GPU, network, camera hardware, or downloaded model weights:

```bash
# Run all tests
python -m pytest ai/member2_anpr/tests/ -v

# Run with coverage report
python -m pytest ai/member2_anpr/tests/ -v --cov=ai.member2_anpr --cov-report=term-missing
```

---

## 9. Known Limitations

- **Extreme Angles (> 45°):** Highly skewed plates may experience lower OCR accuracy without 4-point perspective rectification.
- **Heavy Motion Blur:** Bilateral and CLAHE filtering improves contrast, but severely smeared characters cannot be reconstructed without deep deblurring neural networks.
- **Hardware Latency:** On CPU, EasyOCR inference averages ~150–300 ms/crop; CUDA GPU inference reduces latency to ~15–35 ms/crop.
- **Decorative Fonts:** Non-standard or embossed typography on non-HSRP plates may require OCR fine-tuning.
