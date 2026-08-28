# Member 2 — ANPR Module

**IBVAP (Intelligent Border Video Analytics Platform)**
Module: `ai/member2_anpr/`
Phase: 1 — Foundation

---

## Overview

The ANPR (Automatic Number Plate Recognition) module converts raw video frames into structured, standardised IBVAP events containing detected plate numbers and watchlist match status.

It is designed as a self-contained, independently testable subsystem within the larger IBVAP platform.

---

## Responsibilities

Member 2 exclusively owns all code under `ai/member2_anpr/`.

| Responsibility | Module |
|---|---|
| Number plate detection (bounding box) | `detector.py` |
| OCR — reading plate text | `ocr.py` |
| Text normalisation & recognition | `recognizer.py` |
| Watchlist matching | `watchlist.py` |
| Standardised event generation | `event_generator.py` |
| End-to-end pipeline orchestration | `pipeline.py` |
| Data contracts / schemas | `schemas.py` |
| Configuration | `config.py` |

Member 2 does **not** implement:

- Vehicle detection / tracking (Member 1 — CV)
- FastAPI routes or REST endpoints (Member 3 — Backend)
- PostgreSQL models (Member 3 — Backend)
- React components (Member 4 — Frontend)
- RTSP stream management

---

## Architecture

```
Input frame  (NumPy BGR array)
      ¦
      ?
BasePlateDetector.detect(frame)
      ¦   ? List[PlateRegion]  (x1, y1, x2, y2, confidence)
      ¦
      ?   (crop each region)
BaseOCREngine.read(plate_image)
      ¦   ? OCRResult  (raw_text, confidence, engine)
      ¦
      ?
PlateRecognizer.recognise(ocr_result)
      ¦   ? RecognitionResult  (plate_number, confidence, normalised)
      ¦
      ?
BaseWatchlistMatcher.match(plate_number)
      ¦   ? WatchlistResult  (is_match, status, reason)
      ¦
      ?
ANPREventGenerator.generate(...)
      ¦   ? IBVAPEvent  (camera_id, event_type, timestamp, confidence, metadata)
      ¦
      ?
ANPRResult  (plate_number, confidences, watchlist info, event)
```

### Phase 1 Implementations

| Abstract | Phase 1 Stub |
|---|---|
| `BasePlateDetector` | `MockPlateDetector` |
| `BaseOCREngine` | `MockOCREngine` |
| `BaseWatchlistMatcher` | `InMemoryWatchlistMatcher` |

Swap in a real implementation (e.g. `YOLOPlateDetector`, `EasyOCREngine`) by subclassing the base class and injecting it into `ANPRPipeline`.

---

## Installation

```bash
# From repository root
cd ai/member2_anpr
pip install -r requirements.txt
```

Python 3.10+ is required.

---

## Usage

### Minimal example

```python
import numpy as np
from ai.member2_anpr import ANPRPipeline

# Build a synthetic frame (replace with a real OpenCV frame)
frame = np.zeros((480, 640, 3), dtype=np.uint8)

pipeline = ANPRPipeline()          # uses mock components by default
results  = pipeline.process_frame(
    frame,
    camera_id="CAM-01",
    timestamp="2026-08-28T15:30:00+05:30",
)

for result in results:
    if result.success:
        print(result.plate_number)          # e.g. TN09AB1234
        print(result.watchlist_match)       # True / False
        print(result.event.model_dump())    # full IBVAPEvent dict
```

### Running the demo

```bash
# From repository root
python -m ai.member2_anpr.main
```

---

## Input

| Parameter | Type | Description |
|---|---|---|
| `frame` | `np.ndarray` | OpenCV BGR image (H × W × 3, uint8) |
| `camera_id` | `str` | Camera identifier e.g. `"CAM-BORDER-01"` |
| `timestamp` | `str \| None` | ISO-8601 string. Auto-generated (UTC) if omitted. |

---

## Output

`process_frame()` returns `List[ANPRResult]`.

### ANPRResult example

```json
{
  "plate_number": "TN09AB1234",
  "plate_confidence": 0.90,
  "ocr_confidence": 0.91,
  "watchlist_match": false,
  "watchlist_status": null,
  "watchlist_reason": null,
  "event": {
    "camera_id": "CAM-01",
    "event_type": "ANPR_DETECTED",
    "timestamp": "2026-08-28T15:30:00+05:30",
    "confidence": 0.9047,
    "metadata": {
      "plate_number": "TN09AB1234",
      "raw_ocr_text": "TN 09 AB 1234",
      "plate_confidence": 0.9,
      "ocr_confidence": 0.91,
      "vehicle_id": null,
      "watchlist_match": false
    }
  },
  "error": null
}
```

### Watchlist match event example

```json
{
  "camera_id": "CAM-01",
  "event_type": "WATCHLIST_MATCH",
  "timestamp": "2026-08-28T15:30:00+05:30",
  "confidence": 0.9047,
  "metadata": {
    "plate_number": "TN09AB1234",
    "plate_confidence": 0.9,
    "ocr_confidence": 0.91,
    "vehicle_id": null,
    "watchlist_match": true,
    "watchlist_status": "WATCHLIST",
    "watchlist_reason": "Sample watchlist entry for testing"
  }
}
```

---

## Testing

All tests run with mock/stub components — no GPU, no camera, no database required.

```bash
# From repository root
pytest ai/member2_anpr/tests/ -v
```

With coverage:

```bash
pytest ai/member2_anpr/tests/ -v --cov=ai.member2_anpr --cov-report=term-missing
```

### Test coverage

| Test file | Covers |
|---|---|
| `test_detector.py` | PlateDetector interface, frame validation, PlateRegion schema |
| `test_ocr.py` | OCREngine interface, image validation, OCRResult schema |
| `test_recognizer.py` | Text normalisation, PlateRecognizer, confidence thresholds |
| `test_watchlist.py` | Watchlist match/non-match, case handling, dynamic entries |
| `test_event_generator.py` | ANPR_DETECTED, WATCHLIST_MATCH, IBVAPEvent schema |
| `test_pipeline.py` | End-to-end: valid frame, invalid frame, OCR failure, watchlist |

---

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|---|---|---|
| `ANPR_DETECTOR_BACKEND` | `mock` | Detector backend (`mock`, `yolo`) |
| `ANPR_DETECTOR_MODEL_PATH` | _(none)_ | Path to detector weights |
| `ANPR_DETECTOR_CONF` | `0.50` | Detection confidence threshold |
| `ANPR_OCR_BACKEND` | `mock` | OCR engine (`mock`, `easyocr`, `tesseract`) |
| `ANPR_OCR_CONF` | `0.40` | OCR confidence threshold |
| `ANPR_PLATE_COUNTRY` | `IN` | Country for normalisation rules |
| `ANPR_LOG_LEVEL` | `INFO` | Python log level |

---

## Future Integration

In later phases, Member 2 will communicate with Member 3 (Backend) via the standardised `IBVAPEvent` object.

```
ANPRPipeline.process_frame(frame)
         ¦
         ?
    List[ANPRResult]
         ¦
         ?  (extract result.event)
    IBVAPEvent   --?   Member 3 Backend Event Ingestion API
                              ¦
                              ?
                         PostgreSQL
```

**The backend should import only `IBVAPEvent` from `ai.member2_anpr`.** It must never depend on internal classes such as `PlateDetector`, `OCREngine`, or `WatchlistMatcher`.

This decoupling allows Member 2 to upgrade OCR engines or detection models without requiring any changes to the backend.

---

## File Structure

```
ai/member2_anpr/
+-- __init__.py          ? Public API surface
+-- config.py            ? Runtime configuration
+-- schemas.py           ? All Pydantic data contracts
+-- detector.py          ? Plate detector abstraction + mock
+-- ocr.py               ? OCR engine abstraction + mock
+-- recognizer.py        ? Normalisation + PlateRecognizer
+-- watchlist.py         ? Watchlist matcher abstraction + in-memory
+-- event_generator.py   ? IBVAPEvent builder
+-- pipeline.py          ? End-to-end orchestration
+-- main.py              ? Demo entry point
+-- requirements.txt
+-- README.md
+-- tests/
    +-- __init__.py
    +-- conftest.py          ? Shared pytest fixtures
    +-- test_detector.py
    +-- test_ocr.py
    +-- test_recognizer.py
    +-- test_watchlist.py
    +-- test_event_generator.py
    +-- test_pipeline.py
```
