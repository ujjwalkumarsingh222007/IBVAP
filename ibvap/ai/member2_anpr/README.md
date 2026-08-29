# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**  
Module: `ai/member2_anpr/`  
Phase: 7 — Final ANPR Integration, Regression Testing & SIH Demo Readiness  
Version: `0.7.0`  

---

## 1. Overview

The **ANPR (Automatic Number Plate Recognition)** subsystem processes live IP-camera/RTSP video streams, recorded video files, and vehicle image crops to detect license plates, enhance plate images, perform OCR, normalize and validate Indian registration numbers, match against active watchlists, suppress duplicate detections on continuous streams, and generate standardized `IBVAPEvent` payloads for Member 3's backend.

Phase 7 completes end-to-end integration and regression testing, providing a dedicated **SIH 2026 Interactive Demonstration Mode** (`python -m ai.member2_anpr.main --demo`) with 229 passing unit tests (88% code coverage).

---

## 2. SIH Demo Guide

This guide is designed for evaluating and presenting the ANPR subsystem to SIH judges.

### Recommended SIH Demonstration Command

Run the official interactive multi-scenario demonstration:

```bash
python -m ai.member2_anpr.main --demo
```

### What the SIH Demo Demonstrates:

1. **Scenario 1: Standard Indian Registration Detection**
   - Ingests checkpoint frame (`CAM-BORDER-01`) with associated vehicle ID (`VEH-BORDER-101`).
   - Normalises registration text (`DL01AB1234`), applies position-aware confusion correction (`O↔0`, `I↔1`, `Z↔2`), and validates against official Indian State/UT codes.
   - Emits `ANPR_DETECTED` event.

2. **Scenario 2: High-Priority Stolen Vehicle Watchlist Alert**
   - Matches detected plate against active watchlist (`MH12DE1433` - Reported Stolen).
   - Generates high-priority `WATCHLIST_MATCH` event with reason and status in metadata.

3. **Scenario 3: Live Video Stream Duplicate Suppression**
   - Simulates consecutive CCTV stream frames at 25 FPS.
   - Frame 1 (t=0.0s) emits an alert; Frame 2 (t=1.0s) is automatically suppressed by `DuplicateSuppressor` (10s window) to prevent downstream API flooding.

4. **Scenario 4: Multi-Checkpoint Camera Independence**
   - Shows that when the same vehicle passes a second checkpoint (`CAM-BORDER-02`), it is immediately alerted without false suppression.

5. **Scenario 5: Standardized Backend JSON Event Contract**
   - Displays the exact JSON contract consumed by Member 3 (FastAPI Backend).

---

### Additional Demonstration Commands

```bash
# 1. Run single-frame simulation demo
python -m ai.member2_anpr.main --mock

# 2. Run high-throughput performance benchmark
python -m ai.member2_anpr.main --benchmark --num-frames 30 --mock

# 3. Run validation runner on synthetic frame
python -m ai.member2_anpr.main --validate --mock

# 4. Run on a local vehicle image (mock or real YOLO weights)
python -m ai.member2_anpr.main --image test_vehicle.jpg --camera-id CAM-01 --mock

# 5. Run live RTSP video stream with frame skipping (4-frame skip)
python -m ai.member2_anpr.main --source rtsp://admin:pass@192.168.1.100:554/stream --frame-skip 4 --camera-id CAM-GATE-01
```

---

## 3. Responsibilities

Member 2 exclusively owns all code under `ai/member2_anpr/`.

| Responsibility | Module | Class / Helper |
|---|---|---|
| Public integration interface | `__init__.py` | `process_frame_to_events()` |
| SIH interactive demo & CLI | `main.py` | `run_sih_demo()`, CLI runner |
| Real-model validation runner | `validator.py` | `ANPRValidator`, `ValidationReport`, `ValidationResult` |
| RTSP stream capture | `stream.py` | `RTSPStreamReader`, `mask_rtsp_url()` |
| Real-time stream processing | `stream_processor.py` | `ANPRStreamProcessor`, `StreamStatistics` |
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

---

## 4. Architecture

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

## 5. Backend Integration Contract (Member 3)

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

## 6. Configuration Reference

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

## 7. Testing & Coverage

The entire test suite executes in ~1.5s on CPU without requiring GPU, network, camera hardware, or downloaded model weights:

```bash
# Run all tests
python -m pytest ai/member2_anpr/tests/ -v

# Run with coverage report
python -m pytest ai/member2_anpr/tests/ -v --cov=ai.member2_anpr --cov-report=term-missing
```

---

## 8. Known Limitations

- **Extreme Angles (> 45°):** Highly skewed plates may experience lower OCR accuracy without 4-point perspective rectification.
- **Heavy Motion Blur:** Bilateral and CLAHE filtering improves contrast, but severely smeared characters cannot be reconstructed without deep deblurring neural networks.
- **Hardware Latency:** On CPU, EasyOCR inference averages ~150–300 ms/crop; CUDA GPU inference reduces latency to ~15–35 ms/crop.
- **Decorative Fonts:** Non-standard or embossed typography on non-HSRP plates may require OCR fine-tuning.
