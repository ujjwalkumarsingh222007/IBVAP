# IBVAP — Backend API Service

> **Intelligent Border Video Analytics Platform (IBVAP)** — Core Event Processing, Retrieval, and Analytics Service

---

## 1. Overview

The **IBVAP Backend** is a high-performance, modular REST API built with **FastAPI**, **Pydantic**, and **SQLAlchemy**. It serves as the central hub for receiving, validating, persisting, querying, and aggregating surveillance events across the system:

* **Phase 1D:** Ingests structured common events from AI edge modules (Member 1 CV, Member 2 ANPR) via `POST /api/v1/events`.
* **Phase 2A:** Provides surveillance event querying, filtering, pagination, and real-time dashboard statistics (`GET /api/v1/events`, `GET /api/v1/events/stats`).

---

## 2. Architecture & Tech Stack

```
AI Analytics (Member 1 CV, Member 2 ANPR)      Frontend Dashboard (Member 4 React)
               │                                            ▲
          HTTP POST                                     HTTP GET
       /api/v1/events                         /api/v1/events & /events/stats
               ▼                                            │
   ┌────────────────────────────────────────────────────────┴───┐
   │                    FastAPI Application                     │ (app/main.py)
   │  ├─ CORS Middleware (Local Dev Enabled)                    │
   │  ├─ Pydantic Validation (app/schemas.py)                   │
   │  └─ Events Router (app/routes/events.py)                   │
   └────────────────────────────┬───────────────────────────────┘
                                │
                          SQLAlchemy ORM      (app/models.py, app/database.py)
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │                    SQLite (ibvap.db)                       │ (local dev / easily switched to PostgreSQL)
   └────────────────────────────────────────────────────────────┘
```

* **Framework:** FastAPI (Python 3.10+)
* **Data Validation:** Pydantic v2
* **ORM:** SQLAlchemy 2.0
* **Database:** SQLite (`backend/ibvap.db` for local development, modular for PostgreSQL)
* **Server:** Uvicorn ASGI Server

---

## 3. Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entrypoint, CORS, lifespan, health endpoint
│   ├── database.py          # SQLAlchemy engine, session maker, get_db dependency
│   ├── models.py            # Event SQLAlchemy database model
│   ├── schemas.py           # Pydantic schemas (EventCreate, EventResponse, EventStatsResponse, EventType)
│   └── routes/
│       ├── __init__.py      # Router exports
│       └── events.py        # POST /api/v1/events, GET /api/v1/events, GET /api/v1/events/stats
├── tests/
│   ├── __init__.py
│   └── test_events.py       # Comprehensive pytest suite with isolated in-memory DB
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

To start the server on `http://127.0.0.1:8000`:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Base URL:** `http://127.0.0.1:8000`
* **Interactive Swagger UI:** `http://127.0.0.1:8000/docs`
* **ReDoc Documentation:** `http://127.0.0.1:8000/redoc`

---

## 6. API Endpoints (Phase 1D & Phase 2A)

### 1 — Health Check

* **Endpoint:** `GET /`
* **Response (200 OK):**
```json
{
  "status": "ok",
  "service": "IBVAP Backend API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

### 2 — Ingest Analytics Event (Phase 1D)

* **Endpoint:** `POST /api/v1/events`
* **Content-Type:** `application/json`
* **Status Code:** `201 Created`

#### Allowed `event_type` Values
`OBJECT_DETECTED`, `VEHICLE_DETECTED`, `PERSON_DETECTED`, `ANPR_DETECTED`, `INTRUSION_DETECTED`, `WATCHLIST_MATCH`, `SUSPICIOUS_ACTIVITY`

#### Example Request Payload
```json
{
  "camera_id": "CAM-01",
  "event_type": "INTRUSION_DETECTED",
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

#### Example Response (`201 Created`)
```json
{
  "id": 1,
  "camera_id": "CAM-01",
  "event_type": "INTRUSION_DETECTED",
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
  },
  "created_at": "2026-08-28T16:56:50.644353Z"
}
```

---

### 3 — Query & Filter Surveillance Events (Phase 2A)

* **Endpoint:** `GET /api/v1/events`
* **Ordering:** Newest first (`created_at DESC`, `id DESC`)
* **Response (200 OK):** JSON array of events

#### Query Parameters
| Parameter | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `event_type` | string | `None` | Allowed `EventType` enum | Filter by event category |
| `camera_id` | string | `None` | String | Filter by camera ID |
| `limit` | integer | `50` | `1 <= limit <= 100` | Max items to return |
| `offset` | integer | `0` | `offset >= 0` | Items to skip for pagination |

#### Query Examples
* **All events (default pagination):**
  `GET /api/v1/events`
* **Filter by event type:**
  `GET /api/v1/events?event_type=INTRUSION_DETECTED`
* **Filter by camera ID:**
  `GET /api/v1/events?camera_id=CAM-01`
* **Combined filtering:**
  `GET /api/v1/events?event_type=ANPR_DETECTED&camera_id=CAM-01`
* **Pagination (Page 2, 20 items per page):**
  `GET /api/v1/events?limit=20&offset=20`

---

### 4 — Surveillance Dashboard Statistics (Phase 2A)

* **Endpoint:** `GET /api/v1/events/stats`
* **Status Code:** `200 OK`
* **Description:** Calculates aggregated surveillance metrics across all cameras directly in SQL for dashboard display.

#### Example Response
```json
{
  "total_events": 127,
  "total_intrusions": 14,
  "total_vehicles": 82,
  "total_persons": 31,
  "total_anpr": 25,
  "total_watchlist_matches": 3,
  "total_suspicious_activity": 5
}
```

---

### 5 — Get Single Event by ID

* **Endpoint:** `GET /api/v1/events/{id}`
* **Status Code:** `200 OK` or `404 Not Found`

---

## 7. Validation & Error Handling

* **HTTP 201:** Event persisted successfully.
* **HTTP 200:** Query or stats retrieved successfully.
* **HTTP 422:** Request / parameter validation failure (e.g. unknown `event_type`, `limit > 100`, `limit < 1`, `offset < 0`, `confidence` not in `[0.0, 1.0]`, non-JSON metadata).
* **HTTP 404:** Resource not found.
* **HTTP 500:** Internal server error.

---

## 8. Running Automated Tests

The test suite uses an isolated in-memory SQLite database (`sqlite:///:memory:`).

```bash
# Run all backend tests
pytest tests/ -v
```

---

## 9. End-to-End Integration with Member 1 CV Module

1. **Start the Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Run Member 1 CV:**
   ```bash
   cd ai/member1_cv
   python main.py
   ```

3. **Verify Event Ingestion & Querying:**
   * Member 1 detects intrusions and transmits `POST /api/v1/events`.
   * Open `http://127.0.0.1:8000/api/v1/events` or `http://127.0.0.1:8000/api/v1/events/stats` in your browser / curl to observe the live surveillance events and statistics.
