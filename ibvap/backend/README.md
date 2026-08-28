# IBVAP — Backend API Service

> **Intelligent Border Video Analytics Platform (IBVAP)** — Core Event Processing and Persistence Service

---

## 1. Overview

The **IBVAP Backend** is a high-performance, modular REST API built with **FastAPI**, **Pydantic**, and **SQLAlchemy**. It serves as the central hub for receiving, validating, and persisting common events from AI edge modules:

* **Member 1 (Computer Vision):** Intrusion events, person/vehicle detections.
* **Member 2 (ANPR):** License plate recognitions and vehicle metadata.
* **Member 4 (Frontend):** Real-time monitoring and alert retrieval.

---

## 2. Architecture & Tech Stack

```
AI Analytics (Member 1 CV, Member 2 ANPR)
               │
          HTTP POST
       /api/v1/events
               ▼
   ┌───────────────────────┐
   │  FastAPI Application  │ (app/main.py)
   │  ├─ CORS Middleware   │
   │  ├─ Pydantic Validate │ (app/schemas.py)
   │  └─ Events Router     │ (app/routes/events.py)
   └───────────┬───────────┘
               │
         SQLAlchemy ORM      (app/models.py, app/database.py)
               ▼
   ┌───────────────────────┐
   │ SQLite (ibvap.db)     │ (local dev / easily switched to PostgreSQL)
   └───────────────────────┘
```

* **Framework:** FastAPI (Python 3.10+)
* **Data Validation:** Pydantic v2
* **ORM:** SQLAlchemy 2.0
* **Database:** SQLite (`backend/ibvap.db` for zero-configuration local development)
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
│   ├── schemas.py           # Pydantic schemas (EventCreate, EventResponse, EventType)
│   └── routes/
│       ├── __init__.py      # Router exports
│       └── events.py        # POST /api/v1/events, GET /api/v1/events
├── tests/
│   ├── __init__.py
│   └── test_events.py       # Pytest test suite with isolated in-memory DB
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

## 6. API Endpoints

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

### 2 — Ingest Analytics Event

* **Endpoint:** `POST /api/v1/events`
* **Content-Type:** `application/json`
* **Status Code:** `201 Created`

#### Allowed `event_type` Values
* `OBJECT_DETECTED`
* `VEHICLE_DETECTED`
* `PERSON_DETECTED`
* `ANPR_DETECTED`
* `INTRUSION_DETECTED`
* `WATCHLIST_MATCH`
* `SUSPICIOUS_ACTIVITY`

#### Example Request Payload (Member 1 CV Intrusion)
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

#### Example Response (201 Created)
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

### 3 — Query Events

* **List Events:** `GET /api/v1/events?skip=0&limit=100` (Returns `200 OK` with JSON array of events)
* **Get Single Event:** `GET /api/v1/events/{id}` (Returns `200 OK` or `404 Not Found`)

---

## 7. Validation & Error Handling

* **HTTP 201:** Event schema valid, database persistence successful.
* **HTTP 422:** Request validation error (e.g., unknown `event_type`, `confidence` out of `[0.0, 1.0]`, missing fields, non-JSON `metadata`).
* **HTTP 404:** Resource not found.
* **HTTP 500:** Internal server error.

---

## 8. Running Automated Tests

The test suite uses an isolated in-memory SQLite database so your development `ibvap.db` file is never altered.

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

2. **Run Member 1 CV in another terminal:**
   ```bash
   cd ai/member1_cv
   python main.py
   ```

3. **Observe Intrusion Trigger:**
   * When a person or vehicle crosses into the configured virtual fence, Member 1 converts the local `IntrusionEvent` and transmits `POST http://127.0.0.1:8000/api/v1/events`.
   * Member 1 console displays: `[Phase 1D] ✓ Event sent track_id=... status=201`.
   * The backend persists the event to `backend/ibvap.db` and assigns an auto-incremented database ID.
