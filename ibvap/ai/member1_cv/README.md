# IBVAP — Member 1: Computer Vision Module

> **Phase 1A Pipeline:** Video → OpenCV → YOLOv8 → Person & Vehicle Detection → Bounding Boxes + Confidence
>
> **Phase 1B Pipeline:** Detection → ByteTrack → Persistent Track IDs
>
> **Phase 1C Pipeline:** Tracking → Virtual Fence → Intrusion Detection → Structured Event

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

---

## Directory structure

```
ai/member1_cv/
├── detection/
│   ├── __init__.py         # package export
│   └── detector.py         # Detector class, DetectionResult, BoundingBox
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
│   └── test_intrusion.py   # Phase 1C unit tests  (41 tests)
├── main.py                 # CLI entry point / video loop
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

### Phase 1C — Webcam with virtual fence + intrusion detection (default)

```bash
python main.py
```

### Phase 1C — Video file with virtual fence

```bash
python main.py --source path/to/video.mp4
```

### Phase 1B — Tracking only (no fence)

```bash
python main.py --no-fence
python main.py --source path/to/video.mp4 --no-fence
```

### Phase 1A — Detection only (no tracking, no fence)

```bash
python main.py --no-track
python main.py --source path/to/video.mp4 --no-track
```

### Specific webcam index

```bash
python main.py --source 1
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
| `--fence` | — | DEFAULT_FENCE_POLYGON | Custom polygon `"x1,y1;x2,y2;..."` |

---

## Changing the confidence threshold

```bash
python main.py --confidence 0.25   # more permissive
python main.py --confidence 0.60   # stricter
```

---

## Tracking algorithm

**ByteTrack** — a lightweight, state-of-the-art multi-object tracker that works by associating every detection (not just high-confidence ones) with existing tracks using an IoU-based matching strategy.

It is bundled inside Ultralytics and requires no separate installation beyond `lap`.

An alternative tracker available in Ultralytics is **BoT-SORT**:

```bash
python main.py --tracker botsort.yaml
```

---

## What Track IDs mean

| Statement | True / False |
|-----------|-------------|
| The same ID appears for the same person across consecutive frames | **True** (when tracker is confident) |
| IDs never change | **False** — IDs may change after long occlusion |
| An ID identifies a specific person permanently | **False** — no facial recognition is performed |
| IDs restart at 1 every frame | **False** — IDs are global across the entire run |

---

## What an intrusion event means

An **intrusion event** is generated when a tracked object's bounding-box centre crosses from outside to inside the configured restricted polygon.

| Statement | True / False |
|-----------|-------------|
| One event per entry episode | **True** |
| New event while same object stays inside | **False** — silenced after first event |
| New event after object exits and re-enters | **True** |
| Event identifies a specific person biometrically | **False** — position-based only |

---

## Expected output

### Video window (Phase 1C)

* Colour-coded bounding boxes with `#ID class confidence` labels
* **OUTSIDE** / **IN ZONE** status badge below each tracked box
* Centre dot: green = outside, red = inside fence
* Orange fence polygon outline with "RESTRICTED ZONE" label
* Red banner `!! INTRUSION !!  ID:7 person` on frames where crossing occurs
* Top-left HUD: FPS, person count, vehicle count, mode, session intrusion count

### Console (per frame)

```
Frame 00041 | FPS  27.8 | persons=1 vehicles=0
   {'class_name': 'person', 'confidence': 0.9312, 'bbox': {...}, 'track_id': 7}

[INTRUSION EVENT]
{
  "event_type": "INTRUSION",
  "track_id": 7,
  "class_name": "person",
  "confidence": 0.9312,
  "timestamp": "2026-08-28T12:55:03.123456+00:00",
  "bbox": {"x1": 200, "y1": 150, "x2": 400, "y2": 350},
  "position": {"x": 300, "y": 250}
}
```

### Exit

Press **`q`** in the video window to quit cleanly.

---

## Configuring the virtual fence

### Option A — Edit the constant (default)

Open [`intrusion/fence.py`](intrusion/fence.py) and change `DEFAULT_FENCE_POLYGON`:

```python
DEFAULT_FENCE_POLYGON: Polygon = [
    (200, 100),   # top-left
    (600, 100),   # top-right
    (600, 400),   # bottom-right
    (200, 400),   # bottom-left
]
```

### Option B — CLI argument

```bash
python main.py --fence "200,100;600,100;600,400;200,400"
```

Format: `"x1,y1;x2,y2;x3,y3;..."` (at least 3 vertices, semicolon-separated).

---

## Running the tests

```bash
# All tests (Phase 1A + 1B + 1C)
pytest tests/ -v

# By phase
pytest tests/test_detector.py -v    # Phase 1A — 13 tests
pytest tests/test_tracker.py -v     # Phase 1B — 18 tests
pytest tests/test_intrusion.py -v   # Phase 1C — 41 tests
```

Tests use synthetic numpy frames — no webcam, video file, or model needed for Phase 1C tests.

---

## Design decisions for future phases

| Phase | Extension point |
|-------|----------------|
| **1D** — CEF / Backend | `IntrusionEvent.as_dict()` already matches the output contract; Phase 1D wraps it in CEF and POSTs to FastAPI |

---

## Known limitations

* **No GPU auto-install** — install CUDA PyTorch manually if needed.
* **Single-stream only** — one video source at a time.
* **ID re-assignment after occlusion** — if an object is hidden for many frames, the tracker may assign a new ID when it reappears; this resets its intrusion state.
* **Fence is pixel-based** — coordinates are absolute pixels, not relative or geo-referenced.
* **Centre-point check only** — only the bounding-box centre is tested; a partially overlapping object is not yet flagged.
* **YOLOv8n accuracy** — the nano model is fast but less accurate; use `yolov8s.pt` for better results.
* **Display requires a screen** — headless servers need the `cv2.imshow` path replaced; addressed in Phase 1D.
* **No facial or person recognition** — Track IDs and intrusion events are purely positional/motion-based.

