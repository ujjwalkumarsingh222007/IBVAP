# Intelligent Border Video Analytics Platform (IBVAP)

> **Real-Time AI-Powered Multi-Sensor Border Surveillance Command Center**  
> *Developed for Smart India Hackathon (SIH)*

---

## 1. System Architecture & Overview

IBVAP is an end-to-end intelligent border surveillance platform integrating real-time edge computer vision pipelines, deep automated number plate recognition (ANPR), and a centralized FastAPI backend connected to a surveillance command center UI built with React, TypeScript, TailwindCSS, and Recharts.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 EDGE AI INGESTION NODES                 │
                  │                                                         │
                  │  ┌───────────────────────┐   ┌───────────────────────┐  │
                  │  │ Member 1 CV Module    │   │ Member 2 ANPR Module  │  │
                  │  │ • YOLOv8 Detection    │   │ • YOLO Plate Detector │  │
                  │  │ • ByteTrack Tracker   │   │ • EasyOCR Deep Engine │  │
                  │  │ • Intrusion & Loiter  │   │ • Watchlist Matching  │  │
                  │  └───────────┬───────────┘   └───────────┬───────────┘  │
                  └──────────────┼───────────────────────────┼──────────────┘
                                 │                           │
                                 │ JPEG Frames / Common Events
                                 ▼                           ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                   CENTRAL FASTAPI GATEWAY                │ (Port 8000)
                  │                                                         │
                  │  • Unified AI Frame Ingestion (/api/v1/ai/process-frame)│
                  │  • Threat Intelligence & Correlation Service            │
                  │  • JWT Bearer Authentication & RBAC (Admin/Operator)    │
                  │  • Camera Node Management & Real-Time Health Status     │
                  │  • Security & Management Audit Trail                    │
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                       SQLAlchemy ORM (SQLite / PostgreSQL)
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                   SURVEILLANCE STORAGE                  │
                  │  • events (surveillance detections & OCR metadata)      │
                  │  • threats & threat_events (correlated threat timeline) │
                  │  • cameras (perimeter video sensor nodes)               │
                  │  • users (credential hashes & role permissions)         │
                  │  • audit_logs (security action compliance records)      │
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                     HTTP Polling / Analytics API
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │            REACT SURVEILLANCE COMMAND CENTER            │ (Port 5173)
                  │                                                         │
                  │  • Command Center Dashboard (4 Primary KPI Cards)       │
                  │  • Live Laptop Webcam Ingestion & Real-Time HUD Overlay │
                  │  • Threat Intelligence Feed with Chronological Timeline │
                  │  • ANPR & Watchlist Radar (Clean 5-Column Table)        │
                  │  • Tactical Threat Alerts Matrix (4 Severity Tiers)     │
                  │  • Operational Analytics & Threat Density Trends        │
                  │  • System Health Diagnostic Node & Audit Trail Viewer   │
                  └─────────────────────────────────────────────────────────┘
```

---

## 2. Common Event JSON Specification

All AI modules emit detections to `POST /api/v1/events` using the standardized schema:

```json
{
  "camera_id": "CAM-TOWER-04",
  "event_type": "INTRUSION_DETECTED",
  "timestamp": "2026-08-29T10:00:00Z",
  "confidence": 0.968,
  "metadata": {
    "track_id": 14,
    "class_name": "person",
    "bbox": [180, 110, 310, 440],
    "position": { "x": 245, "y": 275 },
    "fence_zone": "Sector 4 Alpha"
  }
}
```

### Supported Event Types & Operational Severity

| Event Type | AI Source | Operational Severity | Description |
|---|---|---|---|
| `WATCHLIST_MATCH` | Member 2 ANPR | **CRITICAL** | Stolen vehicle or wanted target hotlist hit |
| `INTRUSION_DETECTED` | Member 1 CV | **HIGH** | Perimeter fence crossing into restricted buffer zone |
| `SUSPICIOUS_ACTIVITY` | Member 1 CV | **HIGH** | Prolonged loitering or anomalous path trajectory |
| `VEHICLE_DETECTED` | Member 1 CV / Member 2 | **MEDIUM** | Checkpoint vehicle entry and tracking |
| `ANPR_DETECTED` | Member 2 ANPR | **LOW** | Verified standard license plate OCR read |
| `PERSON_DETECTED` | Member 1 CV | **LOW** | Standard pedestrian/traveler detection |
| `OBJECT_DETECTED` | Member 1 CV | **LOW** | Stationary or abandoned object detection |

---

## 3. Quick System Startup

### Prerequisites
- Python 3.10+ (tested with Python 3.13)
- Node.js 18+ and npm

### 1. Start Backend API Gateway
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* **Swagger API Docs:** `http://localhost:8000/docs`
* **Health Endpoint:** `http://localhost:8000/health`

### 2. Start React Surveillance Command Center
```bash
cd frontend
npm install
npm run dev
```
* **Command Center UI:** `http://localhost:5173`

---

## 4. Default Demonstration Credentials

| Username | Password | Role | Permissions |
|---|---|---|---|
| `admin` | `admin123` | **ADMIN** | Full command center access, camera CRUD, audit log inspection, demo data reset |
| `operator` | `operator123` | **OPERATOR** | Dashboard, live stream, threat alerts, ANPR radar, analytics, camera monitoring |
| `viewer` | `viewer123` | **VIEWER** | Read-only access to operational dashboards and telemetry streams |

---

## 5. Automated Testing & Verification Suite

All **492 automated regression tests** across backend, AI pipelines, and frontend pass with 100% success rate:

```bash
# 1. Run Backend Core & Threat Tests (101 tests)
pytest backend/tests -v

# 2. Run Member 1 CV Pipeline Tests (125 tests)
pytest ai/member1_cv/tests -v

# 3. Run Member 2 ANPR Pipeline Tests (245 tests)
pytest ai/member2_anpr/tests -v

# 4. Run Frontend Unit Tests (21 tests)
cd frontend
npm test

# 5. Verify Frontend Production Build
npm run build
```

---

## 6. License & Compliance
Built for the Smart India Hackathon (SIH). Conforms to surveillance audit, data protection, and operational safety standards.
