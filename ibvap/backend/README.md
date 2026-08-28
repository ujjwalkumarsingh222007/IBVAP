# IBVAP — Backend API Service

> **Intelligent Border Video Analytics Platform (IBVAP)** — Surveillance Event Processing, Camera Management, and Real-Time Dashboard API

---

## 1. Overview

The **IBVAP Backend** is a modular, high-performance REST API built with **FastAPI**, **Pydantic**, and **SQLAlchemy**. It acts as the central intelligence and management service for the IBVAP platform:

* **Phase 1D & 2B:** Ingests AI surveillance events (`PERSON_DETECTED`, `VEHICLE_DETECTED`, `OBJECT_DETECTED`, `INTRUSION_DETECTED`) from edge analytics modules via `POST /api/v1/events`.
* **Phase 2A:** Provides surveillance event querying, multi-parameter filtering, pagination, and type-grouped event statistics.
* **Phase 2C:** Adds comprehensive dashboard endpoints (`/dashboard/summary`, `/dashboard/recent-events`), full camera stream CRUD and status tracking (`/cameras`), event counting, confidence range filtering, and real-time database health monitoring (`/health`).

---

## 2. Architecture & Tech Stack

```
AI Analytics (Member 1 CV, Member 2 ANPR)      Frontend Dashboard (Member 4 React)
               │                                            ▲
          HTTP POST                                     HTTP GET / POST / PUT / DELETE
       /api/v1/events                         /api/v1/dashboard, /events, /cameras, /health
               ▼                                            │
   ┌────────────────────────────────────────────────────────┴───┐
   │                    FastAPI Application                     │ (app/main.py)
   │  ├─ CORS Middleware (Local Dev Enabled)                    │
   │  ├─ Pydantic Validation (app/schemas.py)                   │
   │  └─ Modular Routers                                        │ (app/routes/)
   │      ├─ events.py     (/api/v1/events)                     │
   │      ├─ dashboard.py  (/api/v1/dashboard)                  │
   │      ├─ cameras.py    (/api/v1/cameras)                    │
   │      └─ health.py     (/api/v1/health)                     │
   └────────────────────────────┬───────────────────────────────┘
                                │
                          SQLAlchemy ORM      (app/models.py, app/database.py)
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │                    SQLite (ibvap.db)                       │ (local dev / modular for PostgreSQL)
   └────────────────────────────────────────────────────────────┘
```

* **Framework:** FastAPI (Python 3.10+)
* **Data Validation:** Pydantic v2
* **ORM:** SQLAlchemy 2.0
* **Database:** SQLite (`backend/ibvap.db` with automatic table creation)
* **Server:** Uvicorn ASGI Server

---

## 3. Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entrypoint, CORS, lifespan, router registrations
│   ├── database.py          # SQLAlchemy engine, session maker, get_db dependency
│   ├── models.py            # Event and Camera SQLAlchemy database models
│   ├── schemas.py           # Pydantic schemas (Events, Cameras, Dashboard, Health)
│   └── routes/
│       ├── __init__.py      # Router exports
│       ├── events.py        # POST /events, GET /events, GET /events/stats, GET /events/count
│       ├── dashboard.py     # GET /dashboard/summary, GET /dashboard/recent-events
│       ├── cameras.py       # Camera CRUD: GET, POST, PUT, DELETE /cameras
│       └── health.py        # GET /health
├── tests/
│   ├── __init__.py
│   ├── test_events.py       # Event ingestion, filtering, and stats tests
│   ├── test_cameras.py      # Camera CRUD, validation, and historical retention tests
│   ├── test_dashboard.py    # Summary metrics and recent events tests
│   └── test_health.py       # Health check tests
├── requirements.txt         # Backend Python dependencies
├── README.md                # Documentation & usage instructions
└── .gitignore
```

---

## 4. Installation & Setup

### 1 — Virtual Environment

```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 2 — Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 5. Running the Backend Server

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Base URL:** `http://127.0.0.1:8000`
* **Interactive OpenAPI Swagger Docs:** `http://127.0.0.1:8000/docs`
* **ReDoc Documentation:** `http://127.0.0.1:8000/redoc`

---

## 6. API Reference

### 1 — Dashboard Endpoints (`/api/v1/dashboard`)

#### `GET /api/v1/dashboard/summary`
Returns high-level statistics across all event types and camera operational statuses:
```json
{
  "total_events": 127,
  "total_intrusions": 14,
  "total_persons": 31,
  "total_vehicles": 82,
  "total_anpr": 25,
  "total_watchlist_matches": 3,
  "total_suspicious_activity": 5,
  "active_cameras": 2,
  "total_cameras": 3
}
```

#### `GET /api/v1/dashboard/recent-events?limit=10`
Returns the latest surveillance events ordered newest first (`created_at DESC, id DESC`). Limit allowed: 1–50 (default: 10).

---

### 2 — Camera Management Endpoints (`/api/v1/cameras`)

* **`GET /api/v1/cameras`** — List all registered cameras.
* **`GET /api/v1/cameras/{camera_id}`** — Fetch a single camera.
* **`POST /api/v1/cameras`** — Register a new camera stream (returns `201 Created`, duplicate `camera_id` returns `409 Conflict`).
* **`PUT /api/v1/cameras/{camera_id}`** — Update camera name, location, or status (`ONLINE`, `OFFLINE`, `UNKNOWN`).
* **`DELETE /api/v1/cameras/{camera_id}`** — Delete a camera (returns `204 No Content`; historical events for this camera are preserved).

#### Example Camera Object
```json
{
  "id": 1,
  "camera_id": "CAM-01",
  "name": "Main Gate Camera",
  "location": "North Perimeter Gate",
  "status": "ONLINE",
  "created_at": "2026-08-28T12:00:00Z",
  "updated_at": "2026-08-28T12:00:00Z"
}
```

---

### 3 — Event Ingestion & Retrieval (`/api/v1/events`)

* **`POST /api/v1/events`** — Ingest common event (returns `201 Created` with generated ID).
* **`GET /api/v1/events`** — List and filter events with pagination and confidence range.
* **`GET /api/v1/events/count`** — Get total count of events matching filters via SQL `COUNT`.
* **`GET /api/v1/events/stats`** — Grouped event category counts.
* **`GET /api/v1/events/{id}`** — Get details of a single event by ID.

#### Supported Query Parameters for `GET /api/v1/events`
* `event_type`: Filter by category (`PERSON_DETECTED`, `VEHICLE_DETECTED`, `INTRUSION_DETECTED`, etc.)
* `camera_id`: Filter by camera ID
* `confidence_min`: Minimum confidence threshold (`0.0 <= min <= 1.0`)
* `confidence_max`: Maximum confidence threshold (`0.0 <= max <= 1.0`)
* `limit`: Page size (`1 <= limit <= 100`, default: 50)
* `offset`: Page offset (`offset >= 0`, default: 0)

---

### 4 — System Health Check (`/api/v1/health` & `GET /`)

#### `GET /api/v1/health`
Tests real database connectivity and returns:
```json
{
  "status": "healthy",
  "service": "IBVAP Backend",
  "database": "connected"
}
```

---

## 7. Automated Testing

All tests use an isolated in-memory SQLite database (`sqlite:///:memory:`).

```bash
# Run all backend tests
pytest tests/ -v

# Run individual test suites
pytest tests/test_events.py -v
pytest tests/test_cameras.py -v
pytest tests/test_dashboard.py -v
pytest tests/test_health.py -v
```

---

## 8. End-to-End Integration with Member 1 CV Module

1. **Start Backend Server:**
   ```bash
   cd backend
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Run Member 1 CV:**
   ```bash
   cd ai/member1_cv
   python main.py
   ```

3. **Verify Dashboard Analytics:**
   * Open `http://127.0.0.1:8000/api/v1/dashboard/summary` in your browser.
   * As objects and intrusions are detected by YOLO and ByteTrack, the summary and recent event feeds will update in real-time.
