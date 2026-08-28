# IBVAP — Member 1: Computer Vision Module

> **Phase 1A Pipeline:** Video → OpenCV → YOLOv8 → Person & Vehicle Detection → Bounding Boxes + Confidence
>
> **Phase 1B Pipeline:** Detection → ByteTrack → Persistent Track IDs
>
> **Phase 1C Pipeline:** Tracking → Virtual Fence → Intrusion Detection → Structured Event
>
> **Phase 1D Pipeline:** Structured Intrusion Event → HTTP Adapter → POST `/api/v1/events` (Backend)
>
> **Phase 2B Pipeline:** YOLO + ByteTrack → AI Event Engine (`PERSON_DETECTED`, `VEHICLE_DETECTED`, `OBJECT_DETECTED`, `INTRUSION_DETECTED`) → EventClient → Backend

---

## What this module does

### Phase 1A — Detection
* Reads a live webcam stream **or** a local video file using OpenCV.
* Runs [YOLOv8](https://github.com/ultralytics/ultralytics) inference on every frame.
* Detects **people** and **vehicles** (car, motorcycle, bus, truck) from the COCO label set.
* Draws colour-coded bounding boxes and confidence scores.
* Displays a real-time annotated window.
* Prints structured detection data to stdout.

### Phase 1B — Tracking
* Everything Phase 1A does, **plus**:
* Runs [ByteTrack](https://arxiv.org/abs/2110.06864) (bundled inside Ultralytics) to assign a persistent integer **Track ID** to each detected object.
* The same person or vehicle keeps the same ID across consecutive frames as long as the tracker continues to recognise it as the same object.
* Track IDs are printed in the console output and overlaid on the video.

> **Important:** A Track ID means *"the tracker currently considers this detection to belong to the same tracked object."*
> It does **not** mean *"this is a permanently identified person."*
> IDs may change after long occlusion or when an object leaves and re-enters the scene — this is expected tracker behaviour.

### Phase 1C — Virtual Fence + Intrusion Detection
* Everything Phase 1B does, **plus**:
* Defines a configurable **polygonal restricted zone** (virtual fence) on the video frame.
* Uses the **bounding-box centre point** of each tracked object to test whether it is inside the polygon.
* Detects the **OUTSIDE → INSIDE transition** for each track ID exactly once per entry episode.
* Generates a structured `IntrusionEvent` when a tracked object crosses into the zone.
* Draws the fence polygon on every frame (orange = clear, red = active intrusion).
* Displays a red **`!! INTRUSION !!`** banner on frames where a new crossing occurs.
* Prints a JSON intrusion event to the console on the frame of crossing — never repeatedly.

### Phase 1D — Backend Event Integration
* Everything Phase 1C does, **plus**:
* Includes an isolated, lightweight HTTP client (`adapter/event_client.py`) using Python's standard library (`urllib.request`).
* Maps events to the agreed **IBVAP Common Event JSON schema**.
* Attaches a configurable `camera_id` (default `CAM-01`) and ISO-8601 UTC timestamp.
* HTTP `POST`s events to `http://127.0.0.1:8000/api/v1/events`.
* **Zero crash guarantee:** if the backend is down or returns errors, the CV process logs a warning and continues smoothly.

### Phase 2B — Complete AI Event Engine
* Everything Phase 1D does, **plus**:
* Introduces a modular **AI Event Engine** (`events/analyzer.py`) that classifies tracked objects into domain surveillance events:
  * **`PERSON_DETECTED`**: Emitted when a tracked person first appears.
  * **`VEHICLE_DETECTED`**: Emitted when a vehicle (`car`, `motorcycle`, `bus`, `truck`) first appears.
  * **`OBJECT_DETECTED`**: Emitted for other tracked objects.
  * **`INTRUSION_DETECTED`**: Emitted when a tracked object enters the virtual fence.
* **Per-Track Deduplication:** Suppresses duplicate events across consecutive frames while the track is active.
* **Lifecycle Cleanup:** Automatically cleans up disappeared tracks so re-entries are correctly detected as new events.
* **Safe Missing Track Handling:** Detections lacking a `track_id` (e.g. initial frame before tracking assignment) are safely skipped without generating unidentifiable events.
* **CLI Control:** Toggle detection events via `--no-object-events` while keeping fence intrusions active.

---

## Directory structure

```
ai/member1_cv/
├── adapter/
│   ├── __init__.py         # package export
│   └── event_client.py     # EventClient — Common Event HTTP adapter (Phase 1D)
├── detection/
│   ├── __init__.py         # package export
│   └── detector.py         # Detector class, DetectionResult, BoundingBox (Phase 1A)
├── tracking/
│   ├── __init__.py         # package export
│   └── tracker.py          # ObjectTracker class (Phase 1B)
├── intrusion/
│   ├── __init__.py         # package export
│   ├── fence.py            # VirtualFence — configurable polygon (Phase 1C)
│   └── detector.py         # IntrusionDetector + IntrusionEvent (Phase 1C)
├── events/
│   ├── __init__.py         # package export
│   └── analyzer.py         # EventAnalyzer + AnalyticsEvent (Phase 2B)
├── models/                 # put custom .pt weights here
├── tests/
│   ├── test_detector.py    # Phase 1A unit tests  (13 tests)
│   ├── test_tracker.py     # Phase 1B unit tests  (18 tests)
│   ├── test_intrusion.py   # Phase 1C unit tests  (41 tests)
│   ├── test_event_client.py# Phase 1D unit tests  (31 tests)
│   └── test_event_analyzer.py # Phase 2B unit tests (22 tests)
├── main.py                 # CLI entry point / video loop (all phases)
├── requirements.txt
└── README.md
```

---

## Installation

### 1 — Create and activate a virtual environment

```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 2 — Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running

### Phase 2B — Full Pipeline with AI Event Engine + Fence + Backend (default)

```bash
# Webcam stream, default camera CAM-01, default backend http://127.0.0.1:8000
python main.py

# Video file stream
python main.py --source path/to/video.mp4

# Custom camera ID and custom backend URL
python main.py --camera-id CAM-NORTH-GATE --backend-url http://192.168.1.100:8000
```

### Disable Object Events (Intrusions Only)

```bash
python main.py --no-object-events
```

### Phase 1C — Local only (no backend transmission)

```bash
python main.py --no-backend
```

### Phase 1B — Tracking only (no fence, no backend)

```bash
python main.py --no-fence
```

### Phase 1A — Detection only (no tracking, no fence, no backend)

```bash
python main.py --no-track
```

### Custom fence polygon via CLI

```bash
python main.py --fence "100,80;700,80;700,450;100,450"
```

---

## All CLI options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--source` | `-s` | `0` | Webcam index or video file path |
| `--model` | `-m` | `yolov8n.pt` | YOLO weights file or model name |
| `--confidence` | `-c` | `0.40` | Minimum confidence (0.0 – 1.0) |
| `--device` | `-d` | *(auto)* | `cpu`, `cuda`, `mps`, or blank |
| `--tracker` | — | `bytetrack.yaml` | Tracker config (Phase 1B) |
| `--no-track` | — | off | Phase 1A detection-only mode |
| `--no-fence` | — | off | Disable virtual fence |
| `--fence` | — | `DEFAULT_FENCE_POLYGON` | Custom polygon `"x1,y1;x2,y2;..."` |
| `--no-object-events`| — | off | Disable person/vehicle/object events |
| `--no-backend` | — | off | Disable HTTP backend transmission |
| `--backend-url` | — | `http://127.0.0.1:8000` | Base URL of the backend |
| `--camera-id` | — | `CAM-01` | Camera identifier included in events |

---

## Event Payload Examples

### 1. `PERSON_DETECTED`
```json
{
  "camera_id": "CAM-01",
  "event_type": "PERSON_DETECTED",
  "timestamp": "2026-08-28T15:30:00Z",
  "confidence": 0.94,
  "metadata": {
    "track_id": 17,
    "class_name": "person",
    "bbox": [120, 80, 300, 450],
    "position": {
      "x": 210,
      "y": 265
    }
  }
}
```

### 2. `VEHICLE_DETECTED`
```json
{
  "camera_id": "CAM-01",
  "event_type": "VEHICLE_DETECTED",
  "timestamp": "2026-08-28T15:30:00Z",
  "confidence": 0.91,
  "metadata": {
    "track_id": 25,
    "class_name": "car",
    "bbox": [400, 200, 700, 420],
    "position": {
      "x": 550,
      "y": 310
    }
  }
}
```

### 3. `OBJECT_DETECTED`
```json
{
  "camera_id": "CAM-01",
  "event_type": "OBJECT_DETECTED",
  "timestamp": "2026-08-28T15:30:00Z",
  "confidence": 0.88,
  "metadata": {
    "track_id": 31,
    "class_name": "backpack",
    "bbox": [100, 200, 180, 300],
    "position": {
      "x": 140,
      "y": 250
    }
  }
}
```

---

## Running the tests

```bash
# Run all 125 unit tests (Phase 1A + 1B + 1C + 1D + 2B)
pytest tests/ -v

# Run tests by phase
pytest tests/test_detector.py -v       # Phase 1A — 13 tests
pytest tests/test_tracker.py -v        # Phase 1B — 18 tests
pytest tests/test_intrusion.py -v      # Phase 1C — 41 tests
pytest tests/test_event_client.py -v   # Phase 1D — 31 tests
pytest tests/test_event_analyzer.py -v # Phase 2B — 22 tests
```

---

## Known limitations

* **Single-stream only** — one video source per process.
* **ID re-assignment after long occlusion** — if an object is occluded for many frames, ByteTrack may assign a new ID upon re-emergence; this triggers a new appearance event as expected.
* **Centre-point position** — representative position is the geometric centre of the bounding box.
* **No facial or person recognition** — Track IDs and events are motion/appearance-tracking based, not biometric.
