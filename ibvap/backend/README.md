# IBVAP — Member 3 Backend (Phase 2)

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
│   ├── models/              # SQLAlchemy database models with composite indexes
│   │   ├── __init__.py
│   │   ├── event.py         # Event table model & Alert relationship
│   │   ├── camera.py        # Camera table model
│   │   ├── alert.py         # Alert table model & Event relationship
│   │   └── watchlist.py     # Watchlist table model
│   │
│   ├── schemas/             # Pydantic data schemas & validators
│   │   ├── __init__.py
│   │   ├── event.py         # Event contract & EventPaginatedResponse
│   │   ├── camera.py        # Camera CRUD schemas & pagination
│   │   ├── alert.py         # Alert lifecycle schemas & pagination
│   │   └── watchlist.py     # Watchlist CRUD schemas & pagination
│   │
│   └── routes/              # REST API endpoint handlers
│       ├── __init__.py
│       ├── events.py        # Ingestion, filtering, GET /{id}, alert auto-gen
│       ├── cameras.py       # Full Camera CRUD
│       ├── alerts.py        # Alert list & acknowledge/resolve state machine
│       ├── watchlist.py     # Full Watchlist CRUD
│       └── detections.py    # Detection event queries & filtering
│
├── tests/                   # Pytest automated test suite
│   ├── conftest.py          # Isolated SQLite test fixture (StaticPool)
│   ├── test_health.py       # Health check tests
│   ├── test_events.py       # Event validation, filtering & detail tests
│   ├── test_cameras.py      # Camera CRUD & duplicate validation tests
│   ├── test_alerts.py       # Alert state transition lifecycle tests
│   ├── test_watchlist.py    # Watchlist CRUD & duplicate plate tests
│   └── test_endpoints.py    # Secondary endpoint pagination tests
│
├── .gitignore               # Python venv and pytest cache isolation
├── requirements.txt         # Backend Python dependencies
├── .env.example             # Environment variable configuration template
└── README.md                # Backend documentation
```

---

## Complete API Endpoint Reference

### Health Check
* `GET /health` — Service status check (`{"status": "ok"}`)

### Events API
* `POST /api/v1/events` — Ingest AI event matching common contract (auto-creates Alert for `INTRUSION_DETECTED`, `WATCHLIST_MATCH`, `SUSPICIOUS_ACTIVITY`).
* `GET /api/v1/events` — Query events with filters: `camera_id`, `event_type`, `start_time`, `end_time`, `skip`, `limit`. Returns `EventPaginatedResponse`.
* `GET /api/v1/events/{event_id}` — Retrieve single event by integer ID.

### Detections API
* `GET /api/v1/detections` — Query detection events (`OBJECT_DETECTED`, `VEHICLE_DETECTED`, `PERSON_DETECTED`, `ANPR_DETECTED`, `INTRUSION_DETECTED`, `SUSPICIOUS_ACTIVITY`).

### Camera CRUD API
* `GET /api/v1/cameras` — List cameras (`status`, `skip`, `limit`).
* `POST /api/v1/cameras` — Create camera (returns 409 Conflict if `camera_id` exists).
* `GET /api/v1/cameras/{camera_id}` — Get single camera detail by camera_id string.
* `PUT /api/v1/cameras/{camera_id}` — Update camera details (`name`, `rtsp_url`, `location`, `status`).
* `DELETE /api/v1/cameras/{camera_id}` — Delete camera by camera_id string.

### Alert Management API
* `GET /api/v1/alerts` — List alerts (`status`, `severity`, `skip`, `limit`).
* `POST /api/v1/alerts/{alert_id}/acknowledge` — Transition status: `NEW`/`OPEN` → `ACKNOWLEDGED`. Rejects if already `RESOLVED` (400 Bad Request).
* `POST /api/v1/alerts/{alert_id}/resolve` — Transition status: `NEW`/`OPEN`/`ACKNOWLEDGED` → `RESOLVED`.

### Watchlist CRUD API
* `GET /api/v1/watchlist` — List watchlist entries (`status`, `skip`, `limit`).
* `POST /api/v1/watchlist` — Add plate number (returns 409 Conflict if plate exists).
* `PUT /api/v1/watchlist/{id}` — Update entry (`description`, `status`).
* `DELETE /api/v1/watchlist/{id}` — Remove plate entry by ID.

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
* `INTRUSION_DETECTED` (Auto-creates Alert: `HIGH` severity)
* `WATCHLIST_MATCH` (Auto-creates Alert: `CRITICAL` severity)
* `SUSPICIOUS_ACTIVITY` (Auto-creates Alert: `MEDIUM` severity)

---

## Running the Server

Start Uvicorn server:

```bash
cd backend
venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

* **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **OpenAPI Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## Running Automated Tests

Run pytest suite:

```bash
cd backend
.\venv\Scripts\python.exe -m pytest tests/ -v
```

All tests execute in an isolated in-memory SQLite database (`sqlite:///:memory:`) using `StaticPool`.

---

## Integration Guidelines

### Member 1 & Member 2 AI Integration
Send HTTP `POST` requests to `http://localhost:8000/api/v1/events`. The backend ingests the event and auto-creates alerts for high-priority event types without requiring internal Python module imports.

### Member 4 React Frontend Integration
Consume REST APIs using standard HTTP clients (`fetch` / `axios`):
- All endpoints support structured pagination responses: `{"items": [...], "total": N, "skip": 0, "limit": 20}`.
- CORS middleware is enabled (`allow_origins=["*"]`) for local frontend development.
