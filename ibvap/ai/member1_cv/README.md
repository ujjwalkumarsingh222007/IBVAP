# IBVAP — Member 1: Computer Vision Module

> **Phase 1A Pipeline:** Video → OpenCV → YOLOv8 → Person & Vehicle Detection → Bounding Boxes + Confidence
>
> **Phase 1B Pipeline:** Detection → ByteTrack → Persistent Track IDs
>
> **Phase 1C Pipeline:** Tracking → Virtual Fence → Intrusion Detection → Structured Event
>
> **Phase 1D Pipeline:** Structured Intrusion Event → HTTP Adapter → POST `/api/v1/events` (Member 3 Backend)

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

> **Important:** An intrusion event means *"a tracked object crossed from outside to inside the restricted zone."*
> It does **not** mean *"a specific person has been identified."*
> Track IDs are motion-based, not biometric.

### Phase 1D — Backend Event Integration
* Everything Phase 1C does, **plus**:
* Includes an isolated, lightweight HTTP client (`adapter/event_client.py`) using Python's standard library (`urllib.request`).
* Maps Phase 1C `IntrusionEvent` to the agreed **IBVAP Common Event JSON schema**.
* Maps `event_type` to **`INTRUSION_DETECTED`**.
* Packs `track_id`, `class_name`, `bbox` `[x1, y1, x2, y2]`, and `position` `{"x": ..., "y": ...}` inside `metadata`.
* Attaches a configurable `camera_id` (default `CAM-01`) and ISO-8601 UTC timestamp.
* HTTP `POST`s the event to `http://127.0.0.1:8000/api/v1/events`.
* **Zero crash guarantee:** if the backend is down, connection refused, or returns HTTP 4xx/5xx errors, the CV process logs a warning and continues smoothly.

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
├── models/                 # put custom .pt weights here
├── tests/
│   ├── test_detector.py    # Phase 1A unit tests  (13 tests)
│   ├── test_tracker.py     # Phase 1B unit tests  (18 tests)
│   ├── test_intrusion.py   # Phase 1C unit tests  (41 tests)
│   └── test_event_client.py# Phase 1D unit tests  (31 tests)
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

> **PyTorch** is pulled in automatically by `ultralytics`.
> `lap` (Linear Assignment Problem solver used by ByteTrack) is also in `requirements.txt`.
> For GPU support install the matching CUDA PyTorch build **before** `pip install -r requirements.txt`:
> `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`

---

## Model weights

The default model is **YOLOv8n** (`yolov8n.pt` — ~6 MB).

On the **first run** Ultralytics automatically downloads it to:

| OS | Cache location |
|----|----------------|
| Windows | `%USERPROFILE%\.cache\ultralytics\` |
| Linux / macOS | `~/.cache/ultralytics/` |

To use a different model:

```bash
python main.py --model yolov8s.pt       # larger / more accurate
python main.py --model models/custom.pt # local weights file
```

---

## Running

### Phase 1D — Full Pipeline with Backend Integration (default)

```bash
# Webcam stream, default camera CAM-01, default backend http://127.0.0.1:8000
python main.py

# Video file stream
python main.py --source path/to/video.mp4

# Custom camera ID and custom backend URL
python main.py --camera-id CAM-NORTH-GATE --backend-url http://192.168.1.100:8000
```

### Phase 1C — Local only (no backend transmission)

```bash
python main.py --no-backend
python main.py --source path/to/video.mp4 --no-backend
```

### Phase 1B — Tracking only (no fence, no backend)

```bash
python main.py --no-fence
python main.py --source path/to/video.mp4 --no-fence
```

### Phase 1A — Detection only (no tracking, no fence, no backend)

```bash
python main.py --no-track
python main.py --source path/to/video.mp4 --no-track
```

### Custom fence polygon via CLI

```bash
# Format: "x1,y1;x2,y2;x3,y3;x4,y4"
python main.py --fence "100,80;700,80;700,450;100,450"
python main.py --source video.mp4 --fence "50,50;300,50;300,300;50,300"
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
| `--no-fence` | — | off | Disable virtual fence (Phase 1B mode) |
| `--fence` | — | `DEFAULT_FENCE_POLYGON` | Custom polygon `"x1,y1;x2,y2;..."` |
| `--no-backend` | — | off | Disable HTTP backend POST (Phase 1C mode) |
| `--backend-url` | — | `http://127.0.0.1:8000` | Base URL of Member 3's backend |
| `--camera-id` | — | `CAM-01` | Camera identifier included in events |

---

## Common Event HTTP Contract (Phase 1D)

When an intrusion occurs, the adapter sends:

* **Method:** `POST`
* **URL:** `http://127.0.0.1:8000/api/v1/events`
* **Content-Type:** `application/json`
* **Auth:** None (Phase 1D)

### Request Payload Format

```json
{
  "camera_id": "CAM-01",
  "event_type": "INTRUSION_DETECTED",
  "timestamp": "2026-08-28T10:00:00.123456+00:00",
  "confidence": 0.9412,
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

### Schema Mapping

| Phase 1C Internal Field | Phase 1D Common Event Field | Note |
|-------------------------|-----------------------------|------|
| *(configured)* | `camera_id` | Top-level string (e.g. `CAM-01`) |
| `event_type` (`"INTRUSION"`) | `event_type` (`"INTRUSION_DETECTED"`) | Mapped to agreed IBVAP enum |
| `timestamp` | `timestamp` | ISO-8601 UTC timestamp string |
| `confidence` | `confidence` | Float (0.0 – 1.0) |
| `track_id` | `metadata.track_id` | Integer track ID inside metadata |
| `class_name` | `metadata.class_name` | String (`person`, `car`, etc.) |
| `bbox` `{x1,y1,x2,y2}` | `metadata.bbox` `[x1, y1, x2, y2]` | Converted to 4-element list |
| `position` `{x, y}` | `metadata.position` `{"x": .., "y": ..}` | Dict with centre coordinates |

---

## Error Handling & Backend Unavailable Behavior

* **HTTP 2xx:** Accepted as success.
* **HTTP 400 / 404 / 422 / 500:** Caught and logged with status code and response body details. No crash.
* **Connection Refused / Network Down:** Caught gracefully, warning logged, CV loop continues unaffected.
* **Timeout (default 5.0s):** Caught, warning logged, CV loop does not freeze.

---

## Running the tests

```bash
# Run all 103 unit tests (Phase 1A + 1B + 1C + 1D)
pytest tests/ -v

# Run tests by phase
pytest tests/test_detector.py -v     # Phase 1A — 13 tests
pytest tests/test_tracker.py -v      # Phase 1B — 18 tests
pytest tests/test_intrusion.py -v    # Phase 1C — 41 tests
pytest tests/test_event_client.py -v # Phase 1D — 31 tests
```

Tests use synthetic frames and mocks — no webcam, video file, YOLO weights, or running backend server needed.

---

## Manual Integration Test with Member 3 Backend

1. Start Member 3's backend server (e.g., `uvicorn app.main:app --port 8000`).
2. Run Member 1's CV module:
   ```bash
   python main.py
   ```
3. Move into the virtual fence restricted area.
4. Verify the console displays:
   ```
   [Phase 1D] ✓ Event sent  track_id=1  status=200
   ```
5. Confirm in Member 3's backend logs / database that the event was received and persisted.

---

## Known limitations

* **No GPU auto-install** — install CUDA PyTorch manually if needed.
* **Single-stream only** — one video source at a time.
* **ID re-assignment after occlusion** — if an object is hidden for many frames, the tracker may assign a new ID when it reappears; this resets its intrusion state.
* **Fence is pixel-based** — coordinates are absolute pixels, not relative or geo-referenced.
* **Centre-point check only** — only the bounding-box centre is tested; a partially overlapping object is not yet flagged.
* **YOLOv8n accuracy** — the nano model is fast but less accurate; use `yolov8s.pt` for better results.
* **Display requires a screen** — headless servers need `--no-fence` or headless mode when running in headless containers.
* **No facial or person recognition** — Track IDs and intrusion events are purely positional/motion-based.
