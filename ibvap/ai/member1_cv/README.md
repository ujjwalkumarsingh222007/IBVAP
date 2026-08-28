# IBVAP — Member 1: Computer Vision Module

> **Phase 1A Pipeline:** Video → OpenCV → YOLOv8 → Person & Vehicle Detection → Bounding Boxes + Confidence
>
> **Phase 1B Pipeline:** Detection → ByteTrack → Persistent Track IDs

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
├── models/                 # put custom .pt weights here
├── tests/
│   ├── test_detector.py    # Phase 1A unit tests
│   └── test_tracker.py     # Phase 1B unit tests
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

### Webcam — tracking ON (default, Phase 1B)

```bash
python main.py
```

### Webcam — detection only (Phase 1A mode)

```bash
python main.py --no-track
```

### Specific webcam index

```bash
python main.py --source 1
```

### Video file — tracking ON

```bash
python main.py --source path/to/video.mp4
```

### Video file — detection only

```bash
python main.py --source path/to/video.mp4 --no-track
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
| `--no-track` | — | off | Run Phase 1A detection-only mode |

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

## Expected output

### Video window

Colour-coded bounding boxes with labels:

```
#1 person 0.93
#2 car 0.88
```

Top-left HUD: FPS, person count, vehicle count, mode.

### Console (per frame, Phase 1B)

```
Frame 00042 | FPS  27.8 | persons=2 vehicles=1
   {'class_name': 'person', 'confidence': 0.9312, 'bbox': {'x1': 102, 'y1': 118, 'x2': 248, 'y2': 497}, 'track_id': 1}
   {'class_name': 'person', 'confidence': 0.8754, 'bbox': {'x1': 310, 'y1': 95,  'x2': 420, 'y2': 460}, 'track_id': 2}
   {'class_name': 'car',    'confidence': 0.7643, 'bbox': {'x1': 500, 'y1': 200, 'x2': 750, 'y2': 380}, 'track_id': 3}
```

### Exit

Press **`q`** in the video window to quit cleanly.

---

## Running the tests

```bash
# All tests (Phase 1A + 1B)
pytest tests/ -v

# Phase 1A only
pytest tests/test_detector.py -v

# Phase 1B only
pytest tests/test_tracker.py -v
```

Tests use synthetic numpy frames — no webcam or video file is needed.

---

## Design decisions for future phases

| Phase | Extension point |
|-------|----------------|
| **1C** — Virtual fence | Add a `FenceChecker` class consuming `List[DetectionResult]` with `track_id` and `bbox` |
| **1D** — CEF / Backend | Call `det.as_dict()` (already includes `track_id`) and send to FastAPI |

---

## Known limitations

* **No GPU auto-install** — install CUDA PyTorch manually if needed.
* **Single-stream only** — one video source at a time.
* **ID re-assignment after occlusion** — if an object is hidden for many frames, the tracker may assign a new ID when it reappears.
* **YOLOv8n accuracy** — the nano model is fast but less accurate; use `yolov8s.pt` for better results.
* **Display requires a screen** — headless servers need the `cv2.imshow` path replaced; this will be addressed in Phase 1D.
* **No facial or person recognition** — Track IDs are positional/motion-based only.
