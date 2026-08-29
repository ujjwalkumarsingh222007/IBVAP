# IBVAP — Backend API Service

> **Intelligent Border Video Analytics Platform (IBVAP)** — Surveillance Event Processing, Camera Management, Authentication, Real-Time Operational Analytics, and Threat Intelligence API

---

## 1. Overview

The **IBVAP Backend** is a modular, high-performance REST API built with **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0**. It acts as the central intelligence and management service for the IBVAP platform:

* **Phase 1D & 2B:** Ingests AI surveillance events (`PERSON_DETECTED`, `VEHICLE_DETECTED`, `OBJECT_DETECTED`, `INTRUSION_DETECTED`, `ANPR_DETECTED`, `WATCHLIST_MATCH`, `SUSPICIOUS_ACTIVITY`) from edge analytics modules via `POST /api/v1/events`.
* **Phase 2A & 2C:** Provides surveillance event querying, multi-parameter filtering, pagination, camera stream management, and database health monitoring.
* **Phase 3B Security & Hardening:** Enforces JWT Bearer authentication, PBKDF2 password hashing, role-based access control (`ADMIN`, `OPERATOR`, `VIEWER`), and security audit trails.
* **Phase 3B Operational Intelligence & Analytics:** High-performance database-level SQL aggregations, time-series event and threat trend analysis, event type distribution, and camera threat density rankings with flexible time-range filtering.

---

## 2. Architecture & Tech Stack

```
AI Analytics (Member 1 CV, Member 2 ANPR)      Frontend Dashboard (React + TypeScript)
               │                                            ▲
          HTTP POST                                     HTTP GET / POST / PUT / DELETE
       /api/v1/events                         /api/v1/analytics, /dashboard, /events, /cameras, /auth
               ▼                                            │
   ┌────────────────────────────────────────────────────────┴───┐
   │                    FastAPI Application                     │ (app/main.py)
   │  ├─ CORS Middleware (Local Dev Enabled)                    │
   │  ├─ Pydantic Validation (app/schemas.py)                   │
   │  └─ Modular Routers                                        │ (app/routes/)
   │      ├─ auth.py       (/api/v1/auth)                       │
   │      ├─ analytics.py  (/api/v1/analytics)                  │
   │      ├─ events.py     (/api/v1/events)                     │
   │      ├─ dashboard.py  (/api/v1/dashboard)                  │
   │      ├─ cameras.py    (/api/v1/cameras)                    │
   │      └─ health.py     (/api/v1/health)                     │
   └────────────────────────────┬───────────────────────────────┘
                                │
                          SQLAlchemy ORM      (app/models.py, app/database.py)
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │                    SQLite (ibvap.db)                       │
   │      Tables: events, cameras, users, audit_logs            │
   └────────────────────────────────────────────────────────────┘
```

* **Framework:** FastAPI (Python 3.10+)
* **Data Validation:** Pydantic v2
* **ORM:** SQLAlchemy 2.0
* **Security & Tokens:** PyJWT + PBKDF2-HMAC-SHA256
* **Database:** SQLite (`backend/ibvap.db` with automatic table creation & seeding)
* **Server:** Uvicorn ASGI Server

---

## 3. Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entrypoint, CORS, lifespan, router registrations
│   ├── database.py          # SQLAlchemy engine, session maker, get_db dependency
│   ├── models.py            # Event, Camera, User, and AuditLog database models
│   ├── schemas.py           # Pydantic schemas (Events, Cameras, Dashboard, Analytics, Health)
│   ├── auth/                # Authentication & Security module
│   │   ├── __init__.py      # Exports
│   │   ├── dependencies.py  # get_current_user, require_admin, require_operator, require_viewer
│   │   ├── init_admin.py    # Safe initial user seeding
│   │   ├── routes.py        # /auth/login, /auth/me, /auth/users, /auth/audit-logs
│   │   ├── schemas.py       # LoginRequest, TokenResponse, UserCreate, UserResponse
│   │   └── security.py      # Password hashing & JWT creation/verification
│   ├── services/            # Business logic & SQL query aggregations
│   │   ├── __init__.py
│   │   └── analytics_service.py # Database aggregations, time-range filters, trend calculations
│   └── routes/
│       ├── __init__.py      # Router exports
│       ├── analytics.py     # GET /analytics/summary, /trends, /distribution, /cameras
│       ├── auth.py          # Auth router proxy
│       ├── cameras.py       # Camera CRUD (Admin protected write operations)
│       ├── dashboard.py     # GET /dashboard/summary, GET /dashboard/recent-events
│       ├── events.py        # POST /events, GET /events, GET /events/stats, GET /events/count
│       └── health.py        # GET /health
├── tests/
│   ├── __init__.py
│   ├── test_analytics.py    # Analytics aggregations, trends, and time-range tests
│   ├── test_auth.py         # Authentication, authorization, and audit log tests
│   ├── test_cameras.py      # Camera CRUD, validation, and historical retention tests
│   ├── test_dashboard.py    # Summary metrics and recent events tests
│   ├── test_e2e_integration.py # End-to-end integration tests
│   ├── test_events.py       # Event ingestion, filtering, and stats tests
│   └── test_health.py       # Health check tests
├── requirements.txt         # Backend Python dependencies
├── README.md                # Documentation & usage instructions
└── .gitignore
```

---

## 4. Installation & Setup

```bash
# Windows (PowerShell)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Interactive OpenAPI Swagger Docs:** `http://127.0.0.1:8000/docs`
* **ReDoc Documentation:** `http://127.0.0.1:8000/redoc`

---

## 5. Phase 3B Analytics & Threat Intelligence Endpoints

### 1. `GET /api/v1/analytics/summary`
Returns high-level operational surveillance statistics, threat counts grouped by severity, and detection confidence stats.

**Query Parameters:**
* `start_time` *(optional)*: ISO-8601 string (e.g. `2026-08-28T00:00:00Z`).
* `end_time` *(optional)*: ISO-8601 string (e.g. `2026-08-29T23:59:59Z`).
* `camera_id` *(optional)*: Filter by origin camera.
* `event_type` *(optional)*: Filter by event type.

**Response Example:**
```json
{
  "total_events": 142,
  "threats": {
    "total_threats": 38,
    "critical": 6,
    "high": 18,
    "medium": 14,
    "low": 104
  },
  "confidence_stats": {
    "avg_confidence": 0.9234,
    "min_confidence": 0.65,
    "max_confidence": 0.99
  },
  "event_type_counts": {
    "WATCHLIST_MATCH": 6,
    "INTRUSION_DETECTED": 12,
    "SUSPICIOUS_ACTIVITY": 6,
    "VEHICLE_DETECTED": 14,
    "PERSON_DETECTED": 45,
    "ANPR_DETECTED": 40,
    "OBJECT_DETECTED": 19
  },
  "time_range": {
    "start_time": "2026-08-28T00:00:00Z",
    "end_time": "2026-08-29T23:59:59Z"
  }
}
```

---

### 2. `GET /api/v1/analytics/trends`
Returns time-series event and threat trend buckets grouped by hourly or daily granularity via SQL grouping.

**Query Parameters:**
* `start_time`, `end_time`, `camera_id`, `event_type` *(optional)*.
* `interval`: Granularity (`hourly` or `daily`, default: `hourly`).

**Response Example:**
```json
{
  "interval": "hourly",
  "trends": [
    {
      "bucket": "2026-08-29 08:00",
      "total_events": 24,
      "intrusions": 3,
      "watchlist_matches": 1,
      "suspicious_activity": 2,
      "vehicles": 4,
      "persons": 10,
      "total_threats": 10,
      "avg_confidence": 0.912
    },
    {
      "bucket": "2026-08-29 09:00",
      "total_events": 35,
      "intrusions": 4,
      "watchlist_matches": 2,
      "suspicious_activity": 1,
      "vehicles": 7,
      "persons": 15,
      "total_threats": 14,
      "avg_confidence": 0.935
    }
  ]
}
```

---

### 3. `GET /api/v1/analytics/distribution`
Returns event category distribution and threat severity percentages.

**Response Example:**
```json
{
  "total_events": 100,
  "distribution": [
    {
      "event_type": "PERSON_DETECTED",
      "count": 40,
      "percentage": 40.0
    },
    {
      "event_type": "INTRUSION_DETECTED",
      "count": 20,
      "percentage": 20.0
    }
  ],
  "threat_breakdown": {
    "total_threats": 35,
    "critical": 5,
    "high": 20,
    "medium": 10,
    "low": 65
  }
}
```

---

### 4. `GET /api/v1/analytics/cameras`
Ranks surveillance cameras by total event volume, threat density, and confidence.

**Response Example:**
```json
{
  "cameras": [
    {
      "camera_id": "CAM-BORDER-01",
      "camera_name": "Sector 4 North Fence",
      "location": "North Perimeter Line",
      "status": "ONLINE",
      "total_events": 54,
      "threat_count": 18,
      "critical_threats": 4,
      "high_threats": 10,
      "medium_threats": 4,
      "avg_confidence": 0.945,
      "last_event_time": "2026-08-29T11:45:00Z"
    }
  ]
}
```

---

## 6. Authentication & Security Endpoints (`/api/v1/auth`)

* **`POST /api/v1/auth/login`** — Authenticate username & password, returns JWT token.
* **`GET /api/v1/auth/me`** — Inspect authenticated user profile & role.
* **`POST /api/v1/auth/users`** *(ADMIN only)* — Register new operators or admins.
* **`GET /api/v1/auth/users`** *(ADMIN only)* — List all registered users.
* **`GET /api/v1/auth/audit-logs`** *(ADMIN only)* — Inspect security audit trail.

Default Development Accounts:
* `admin` / `admin123` (Role: `ADMIN`)
* `operator` / `operator123` (Role: `OPERATOR`)
* `viewer` / `viewer123` (Role: `VIEWER`)

---

## 7. Automated Testing

```bash
# Run all backend test suites
pytest backend/tests -v
```

All 73 backend tests execute against in-memory SQLite instances verifying:
- SQL-level aggregations and date filtering
- Reverse date validation (`start_time > end_time -> 400 Bad Request`)
- Empty database resilience
- Role-based access control and camera write protection
- Security audit logging
