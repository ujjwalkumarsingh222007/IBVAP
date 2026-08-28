# IBVAP — Member 3 Backend (Phase 1)

This is the **FastAPI Backend** component for **IBVAP (Intelligent Border Video Analytics Platform)** maintained by **Member 3**.

The backend serves as the centralized API gateway and database persistence layer connecting AI event generators (Member 1 Computer Vision & Member 2 ANPR) with the React frontend user interface (Member 4).

---

## Architecture Overview

```text
IP CCTV / RTSP
      ↓
Video Processing / OpenCV
      ↓
┌─────────────────────────┬─────────────────────────┐
│  Member 1: CV Module    │  Member 2: ANPR Module  │
│  (YOLO / Fence / CV)    │  (OCR / Plates / Watch) │
└────────────┬────────────┴────────────┬────────────┘
             │ (Standardized JSON)     │ (Standardized JSON)
             └────────────┬────────────┘
                          ↓
               Member 3: FastAPI Backend
                          ↓
                      PostgreSQL
                          ↓
                  REST API Endpoints
                          ↓
              Member 4: React Frontend
```

---

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entrypoint & middleware
│   ├── config.py            # Environment variable configuration
│   ├── database.py          # SQLAlchemy engine, session maker, get_db dependency
│   │
│   ├── models/              # SQLAlchemy database models
│   │   ├── __init__.py
│   │   ├── event.py         # Event table model (JSON metadata support)
│   │   ├── camera.py        # Camera table model
│   │   ├── alert.py         # Alert table model
│   │   └── watchlist.py     # Watchlist table model
│   │
│   ├── schemas/             # Pydantic data schemas & validators
│   │   ├── __init__.py
│   │   ├── event.py         # Common Event contract validation
│   │   ├── camera.py        # Camera schemas
│   │   ├── alert.py         # Alert schemas
│   │   └── watchlist.py     # Watchlist schemas
│   │
│   └── routes/              # REST API endpoint handlers
│       ├── __init__.py
│       ├── events.py        # POST /api/v1/events, GET /api/v1/events
│       ├── cameras.py       # GET /api/v1/cameras
│       ├── alerts.py        # GET /api/v1/alerts
│       ├── watchlist.py     # GET /api/v1/watchlist
│       └── detections.py    # GET /api/v1/detections
│
├── tests/                   # Pytest automated test suite
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_events.py
│   └── test_endpoints.py
│
├── requirements.txt         # Backend Python dependencies
├── .env.example             # Environment variable configuration template
└── README.md                # Backend documentation
```

---

## Prerequisites & Installation

### 1. Requirements
* Python 3.10+
* PostgreSQL (or SQLite for local testing)

### 2. Create Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
venv\Scripts\Activate.ps1
# On Windows (CMD):
venv\Scripts\activate.bat
# On Linux / macOS:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configuration

### Environment Variables (`.env`)
Copy `.env.example` to `.env` inside `backend/`:

```bash
cp .env.example .env
```

Default `.env` contents:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ibvap
APP_NAME=IBVAP Backend
APP_VERSION=1.0.0
DEBUG=True
```

### PostgreSQL Setup
1. Ensure PostgreSQL service is running on `localhost:5432`.
2. Create the target database:
   ```sql
   CREATE DATABASE ibvap;
   ```
3. Update `DATABASE_URL` in `.env` with your actual database credentials:
   ```env
   DATABASE_URL=postgresql://username:your_password@localhost:5432/ibvap
   ```

---

## Running the Server

Start the Uvicorn development server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API server will be available at `http://127.0.0.1:8000`.

### API Documentation & Interactive Swagger UI
Once running, view the automatically generated interactive documentation:
* **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **OpenAPI Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend service health check (`{"status": "ok"}`) |
| `POST` | `/api/v1/events` | Ingest and validate AI events |
| `GET` | `/api/v1/events` | Retrieve list of ingested events |
| `GET` | `/api/v1/cameras` | Retrieve list of registered cameras |
| `GET` | `/api/v1/alerts` | Retrieve security alerts |
| `GET` | `/api/v1/detections` | Retrieve detection events |
| `GET` | `/api/v1/watchlist` | Retrieve license plate watchlist |

---

## Common Event Contract (AI Ingestion)

Member 1 (Computer Vision) and Member 2 (ANPR) send events using this standardized JSON payload format:

```json
{
  "camera_id": "CAM-01",
  "event_type": "OBJECT_DETECTED",
  "timestamp": "2026-08-28T15:30:00",
  "confidence": 0.94,
  "metadata": {
    "label": "person",
    "bounding_box": [120, 80, 45, 110],
    "zone": "border_fence_alpha"
  }
}
```

### Supported Event Types
* `OBJECT_DETECTED`
* `VEHICLE_DETECTED`
* `PERSON_DETECTED`
* `ANPR_DETECTED`
* `INTRUSION_DETECTED`
* `WATCHLIST_MATCH`
* `SUSPICIOUS_ACTIVITY`

---

## Running Automated Tests

Run the backend test suite using `pytest`:

```bash
# From backend directory
pytest

# Verbose output
pytest -v
```

The test suite runs using an in-memory SQLite database (`sqlite:///:memory:`) so tests execute independently of external PostgreSQL availability.

---

## Integration Guidelines

### Member 1 (Computer Vision) & Member 2 (ANPR)
Send HTTP `POST` requests to `http://localhost:8000/api/v1/events` containing valid JSON payload matching the Common Event Contract. The backend validates and persists event metadata without requiring internal Python code dependencies on YOLO, OpenCV, or OCR.

### Member 4 (React Frontend)
Consume REST APIs using standard HTTP clients (e.g. `axios` or `fetch`):
* `GET http://localhost:8000/api/v1/events`
* `GET http://localhost:8000/api/v1/cameras`
* `GET http://localhost:8000/api/v1/alerts`
* `GET http://localhost:8000/api/v1/detections`
* `GET http://localhost:8000/api/v1/watchlist`
* `GET http://localhost:8000/health`
