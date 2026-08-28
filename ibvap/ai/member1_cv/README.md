# IBVAP — Member 1: Computer Vision Module (Phase 1A)

> **Pipeline:** Video → OpenCV → YOLOv8 → Person & Vehicle Detection → Bounding Boxes + Confidence

---

## What this module does

* Reads a live webcam stream **or** a local video file using OpenCV.
* Runs [YOLOv8](https://github.com/ultralytics/ultralytics) inference on every frame.
* Detects **people** and **vehicles** (car, motorcycle, bus, truck) from the COCO label set.
* Draws colour-coded bounding boxes and confidence scores on the frame.
* Displays a real-time annotated window.
* Prints structured detection data to stdout each frame.

---

## Directory structure

```
ai/member1_cv/
├── detection/
│   ├── __init__.py         # package export
│   └── detector.py         # Detector class + DetectionResult dataclass
├── models/                 # (empty) put custom .pt weights here
├── tests/
│   └── test_detector.py    # pytest unit tests
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
> On CPU-only machines this is sufficient.  
> For GPU support install the matching CUDA build of PyTorch **before** running `pip install -r requirements.txt`:  
> `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`

---

## Model weights

The default model is **YOLOv8n** (`yolov8n.pt` — ~6 MB).

On the **first run** Ultralytics automatically downloads the weights to:

| OS | Cache location |
|----|----------------|
| Windows | `%USERPROFILE%\.cache\ultralytics\` |
| Linux / macOS | `~/.cache/ultralytics/` |

To use a different model, pass `--model`:

```bash
# Use a larger, more accurate model
python main.py --model yolov8s.pt

# Use a locally stored weights file
python main.py --model models/my_custom.pt
```

---

## Running

### Webcam detection (default: index 0)

```bash
python main.py
```

### Specific webcam index

```bash
python main.py --source 1
```

### Video file detection

```bash
python main.py --source path/to/video.mp4
```

---

## All CLI options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--source` | `-s` | `0` | Webcam index or video file path |
| `--model` | `-m` | `yolov8n.pt` | YOLO weights file or model name |
| `--confidence` | `-c` | `0.40` | Minimum confidence (0.0 – 1.0) |
| `--device` | `-d` | *(auto)* | `cpu`, `cuda`, `mps`, or blank for auto |

---

## Changing the confidence threshold

```bash
# More permissive — show more detections
python main.py --confidence 0.25

# Stricter — only high-confidence detections
python main.py --confidence 0.60
```

---

## Expected output

### Window

A live video window titled **"IBVAP — Phase 1A: Person & Vehicle Detection"** showing:

* Colour-coded bounding boxes per class (green = person, blue = car, …)
* Class name + confidence score label above each box
* Top-left HUD: live FPS, person count, vehicle count

### Console (per frame)

```
Frame 00042 | FPS  28.3 | persons=2 vehicles=1
   {'class_name': 'person', 'confidence': 0.9312, 'bbox': {'x1': 102, 'y1': 118, 'x2': 248, 'y2': 497}}
   {'class_name': 'person', 'confidence': 0.8754, 'bbox': {'x1': 310, 'y1': 95,  'x2': 420, 'y2': 460}}
   {'class_name': 'car',    'confidence': 0.7643, 'bbox': {'x1': 500, 'y1': 200, 'x2': 750, 'y2': 380}}
```

### Exit

Press **`q`** in the video window to exit cleanly.

---

## Running the tests

```bash
# From the member1_cv directory
pytest tests/ -v
```

The tests use synthetic numpy frames — no webcam or video file is needed.

---

## Design decisions for future phases

| Phase | Extension point |
|-------|----------------|
| **1B** — Tracking | Replace `Detector.detect()` with a tracking wrapper; `DetectionResult.track_id` field is already reserved |
| **1C** — Virtual fence | Add a `FenceChecker` class that receives `List[DetectionResult]` |
| **1D** — CEF output | Call `det.as_dict()` and serialise to the backend event bus |

---

## Known limitations

* **No GPU auto-install** — install a CUDA PyTorch build manually if needed.
* **Single-stream only** — Phase 1A processes one source at a time.
* **No frame buffering** — on slow machines detection may lag behind real-time.
* **YOLOv8n accuracy** — the nano model is fast but less accurate than larger variants; use `yolov8s.pt` or `yolov8m.pt` for better results.
* **Display requires a screen** — headless servers need to disable the `cv2.imshow` call; that will be addressed in Phase 1D when output routes to the backend instead.
