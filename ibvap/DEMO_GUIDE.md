# IBVAP — Live Demonstration & Evaluation Guide

This guide provides a structured **5 to 10-minute live demonstration flow** designed for evaluators, hackathon judges, and command center operators.

---

## Prerequisites & Launch Checklist

1. **Start Backend Server:**
   ```bash
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Start Frontend Server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open Browser:** Navigate to `http://localhost:5173`

---

## 10-Step Live Demonstration Walkthrough

### Step 1: Authentication & Role-Based Access
- **Action:** Open `http://localhost:5173`.
- **Demo:** Log in with Admin credentials (`admin` / `admin123`).
- **Talking Point:** Highlight secure bcrypt hash verification, signed JWT Bearer session, and role permissions.

### Step 2: Command Center Overview
- **Action:** Navigate to **COMMAND CENTER** (`/dashboard`).
- **Demo:**
  - Point to the **4 Primary KPI Cards**: `ACTIVE CAMERAS`, `ACTIVE THREATS`, `TODAY'S EVENTS`, `WATCHLIST MATCHES`.
  - Highlight the **Live Security Status** perimeter health indicator.
- **Talking Point:** Explain that the UI gives a first-time operator complete situational awareness within 5–10 seconds.

### Step 3: Open Cameras & Node Grid
- **Action:** Navigate to **CAMERAS** $\rightarrow$ **Live Cameras** (`/cameras`).
- **Demo:** Show the list of registered perimeter camera streams (`CAM-TOWER-01` to `CAM-TOWER-05`).
- **Talking Point:** Point out online/offline status badges, location zoning, and instant Live access.

### Step 4: Live Laptop Webcam & AI Ingestion
- **Action:** Click `[📹 Live Preview]` on camera `CAM-TOWER-04`.
- **Demo:**
  - Grant camera permission in browser.
  - Show real laptop webcam streaming in high definition.
  - Click `[Enable AI Analysis]`.
- **Talking Point:** Show that frames are converted to high-speed JPEG buffers and dispatched to `/api/v1/ai/process-frame` with zero UI latency and active frame throttling.

### Step 5: Member 1 CV Real-Time Detection
- **Action:** Stand or move in front of the webcam.
- **Demo:** Point to the real-time detection badge `👤 PERSON (100%)` and ByteTrack identifier.
- **Talking Point:** Member 1 YOLOv8 + ByteTrack detects multiple objects and maintains consistent track IDs across frames.

### Step 6: Member 2 Real ANPR & License Plate Recognition
- **Action:** Hold up an Indian license plate (e.g. `HR98AA0000` or on your smartphone screen).
- **Demo:**
  - Observe the HUD overlay highlighting the plate bounding box.
  - Point to the detection pill: `🚗 HR98AA0000 — 93%`.
- **Talking Point:** Highlight that Member 2 uses a **real YOLO license plate detector model** + **EasyOCR engine** (not a mock placeholder) with strict Indian HSRP validation.

### Step 7: Hotlist Watchlist Matching
- **Action:** Hold up the watchlisted plate number `TN09AB1234`.
- **Demo:**
  - Watch the top banner flash red: `🚨 ACTIVE THREAT DETECTED ON THIS CAMERA`.
  - Detection badge turns red: `🚨 WATCHLIST MATCH (TN09AB1234)`.
- **Talking Point:** Stolen/wanted targets trigger instantaneous visual hotlist alerts and database events.

### Step 8: Unified Threat Intelligence & Correlation
- **Action:** Return to **COMMAND CENTER** (`/dashboard`) or **Threat Alerts** (`/alerts`).
- **Demo:**
  - Show the newly correlated threat item (e.g. `THR-CAM-TOWER-04-...`).
  - Point to the Threat Score meter (`95.7/100`) and `CRITICAL` severity level.
- **Talking Point:** The platform correlates multi-sensor occurrences (e.g. Watchlisted Vehicle + Person Movement + Virtual Fence Breach) occurring within temporal sliding windows.

### Step 9: Threat Timeline & Event Storytelling
- **Action:** Click `[View Timeline]` on the correlated threat card.
- **Demo:**
  - Walk through the chronological story progression of events leading to the threat score calculation.
  - Expand the metadata pills to inspect exact bounding boxes, OCR confidence, and timestamps.
- **Talking Point:** Operators get full forensic auditability without being overwhelmed by raw JSON dumps.

### Step 10: Event Archive, Filter Matrix & Threat Resolution
- **Action:**
  - Navigate to **ANPR & Watchlist** (`/anpr`) to view the clean 5-column plate detection archive.
  - Update threat status to `[RESOLVED]`.
- **Talking Point:** Demonstrates the complete closed-loop lifecycle from edge detection to operator triage and resolution.
