# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**  
Module: `ai/member2_anpr/`  
Phase: 5 — Real-Time RTSP/IP-Camera ANPR Integration  

---

## 1. Overview

The **ANPR (Automatic Number Plate Recognition)** subsystem processes live IP-camera/RTSP video streams and vehicle crops to detect license plates, enhance plate images, perform OCR, normalize and validate Indian registration numbers, match against active watchlists, suppress duplicate detections on continuous streams, and generate standardized `IBVAPEvent` payloads for Member 3's backend.

Phase 5 introduces **Real-Time RTSP / Video Stream Ingestion** (`RTSPStreamReader`), **Configurable Frame Sampling & Stream Processing** (`ANPRStreamProcessor`), **Stream Health & Reconnection Management**, and **Runtime Streaming Metrics** across 205 automated tests (90% code coverage).

---

## 2. Responsibilities

Member 2 exclusively owns all code under `ai/member2_anpr/`.

| Responsibility | Module | Class / Helper |
|---|---|---|
| RTSP stream capture | `stream.py` | `RTSPStreamReader`, `mask_rtsp_url()` |
| Real-time stream processing | `stream_processor.py` | `ANPRStreamProcessor`, `StreamStatistics` |
| Public integration interface | `__init__.py` | `process_frame_to_events()` |
| License plate detection | `detector.py` | `BasePlateDetector`, `MockPlateDetector`, `YOLOPlateDetector` |
| Image preprocessing | `preprocessing.py` | `PlatePreprocessor` (resize, CLAHE, bilateral filter, binarization) |
| Optical Character Recognition (OCR) | `ocr.py` | `BaseOCREngine`, `MockOCREngine`, `EasyOCREngine` |
| Plate normalisation & validation | `recognizer.py` | `PlateRecognizer`, `normalise_plate()`, `validate_indian_plate()` |
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
IP CCTV / RTSP Stream
      │
      ▼
RTSPStreamReader (with auto-reconnect & credential masking)
      │
      ▼
ANPRStreamProcessor (with frame sampling/skipping)
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

## 4. RTSP Stream Reading & Processing (Phase 5)

### Real-Time Stream Ingestion
The `RTSPStreamReader` manages video connections to IP cameras, RTSP streams, local video files (`.mp4`, `.avi`), and USB webcams:
- **Resilient Reconnection:** Automatically attempts reconnection on packet drops or connection resets up to `reconnect_attempts` (default: 3) with configurable backoff `reconnect_delay_sec`.
- **Credential Security:** Automatically masks RTSP credentials in all diagnostic logs (`mask_rtsp_url()`) to prevent password leaks.
- **Resource Management:** Ensures clean OpenCV `VideoCapture` release on shutdown.

### Frame Sampling / Skipping
In live 25–30 FPS video streams, evaluating heavy deep learning models on every single frame causes queue buildup.
The `ANPRStreamProcessor` implements configurable frame sampling:
- Setting `frame_skip=4` (via `--frame-skip 4` or `ANPR_FRAME_SKIP=4`) samples 1 out of every 5 frames (~5–6 FPS effective rate).
- Decouples stream reading from inference to maintain near-real-time throughput.

### Python Streaming Example

```python
from ai.member2_anpr import (
    ANPRPipeline,
    RTSPStreamReader,
    ANPRStreamProcessor,
    IBVAPEvent,
)

# 1. Initialize pipeline and stream reader
pipeline = ANPRPipeline()
stream_reader = RTSPStreamReader(
    source="rtsp://admin:pass@192.168.1.100:554/live",
    camera_id="CAM-BORDER-01",
    reconnect_attempts=3,
)

# 2. Initialize stream processor with frame sampling
processor = ANPRStreamProcessor(
    stream_reader=stream_reader,
    pipeline=pipeline,
    frame_skip=4, # Process 1 out of every 5 frames
)

# 3. Stream generator yielding events in real time
for event in processor.process_stream_events():
    print(f"[{event.event_type.value}] Camera={event.camera_id} Plate={event.metadata.get('plate_number')}")

# 4. View runtime statistics
print(processor.stats.summary_table())
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

## 6. Duplicate Event Suppression

Continuous CCTV video streams process 20–30 frames per second. Detecting the same vehicle across consecutive frames would flood downstream backend APIs.

The `DuplicateSuppressor` module provides thread-safe in-memory filtering:
- Tracks `(camera_id, normalized_plate) -> last_seen_epoch_seconds`.
- Discards / flags events occurring within `ANPR_DUPLICATE_WINDOW_SEC` (default: 10 seconds).
- Distinguishes different cameras (the same vehicle appearing at a different checkpoint is recorded).
- Automatically evicts expired timestamps to bound memory usage without requiring Redis or PostgreSQL.

---

## 7. Installation & Dependencies

```bash
# Navigate to module directory
cd ibvap/ai/member2_anpr

# Install dependencies
pip install -r requirements.txt
```

---

## 8. Model Setup & Weights

### License Plate Detection (YOLO)
Place your trained YOLO license plate detection weights (`.pt` file) in `ai/member2_anpr/models/`:

```text
ai/member2_anpr/
└── models/
    └── license_plate.pt
```

Configure the path via environment variables:
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

## 9. Usage & CLI

```bash
# Run simulation demo using mock components (no weights required)
python -m ai.member2_anpr.main --mock

# Run on a local vehicle image with mock pipeline
python -m ai.member2_anpr.main --mock --image test_vehicle.jpg --camera-id CAM-01 --vehicle-id VEH-101

# Run with real YOLO + EasyOCR pipeline on a local image
python -m ai.member2_anpr.main --image test_vehicle.jpg --model-path models/license_plate.pt

# Run live RTSP video stream with frame skipping
python -m ai.member2_anpr.main --source rtsp://admin:pass@192.168.1.100:554/stream --frame-skip 4 --camera-id CAM-GATE-01

# Run performance benchmark
python -m ai.member2_anpr.main --benchmark --num-frames 30 --mock
```

---

## 10. Configuration Reference

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

## 11. Testing & Coverage

The entire test suite executes in ~1.5s on CPU without requiring GPU, network, camera hardware, or downloaded model weights:

```bash
# Run all tests
python -m pytest ai/member2_anpr/tests/ -v

# Run with coverage report
python -m pytest ai/member2_anpr/tests/ -v --cov=ai.member2_anpr --cov-report=term-missing
```

Test modules:
- `test_stream.py`: RTSP stream reader, reconnection logic, error recovery, password masking
- `test_stream_processor.py`: Frame skipping, stream iterator, statistics tracking, graceful stop
- `test_detector.py`: Base detector & mock detector contract tests
- `test_yolo_detector.py`: YOLO detector tests with mocked Ultralytics inference
- `test_preprocessing.py`: Plate preprocessor tests (rescaling, CLAHE, binarization, edge cases)
- `test_ocr.py`: Base OCR engine & mock OCR tests
- `test_easyocr_engine.py`: EasyOCR tests with mocked reader instances
- `test_recognizer.py`: Normalisation, confusion map correction, and Indian registration validation
- `test_watchlist.py`: Watchlist matching, case insensitivity, and dynamic additions
- `test_event_generator.py`: `ANPR_DETECTED` / `WATCHLIST_MATCH` event construction & `vehicle_id` support
- `test_duplicate_suppression.py`: Thread-safe duplicate suppression, window expiry, and camera isolation
- `test_integration_interface.py`: Public backend ingestion helper (`process_frame_to_events`) and serialization
- `test_config.py`: Configuration validation rules and boundary checking
- `test_pipeline.py`: End-to-end pipeline orchestration, multi-plate processing, error isolation
- `test_robustness.py`: 10-area robustness validation (blurry, dark, angled, noisy, multi-plate, etc.)
- `test_benchmark.py`: Benchmarking latency, FPS computation, and report serialization

---

## 12. Known Limitations

- **Extreme Angles (> 45°):** Highly skewed plates may experience lower OCR accuracy without 4-point perspective rectification.
- **Heavy Motion Blur:** Preprocessing enhances edge contrast, but severely smeared characters cannot be reconstructed without specialized deblurring neural networks.
- **CPU vs GPU:** On CPU, EasyOCR inference averages ~150–300 ms/crop; on CUDA GPU, latency drops to ~15–35 ms/crop.
- **Decorative Fonts:** Non-standard or embossed typography on non-HSRP plates may require OCR fine-tuning.
