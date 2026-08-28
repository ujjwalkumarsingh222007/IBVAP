# IBVAP — Member 4 Frontend Phase 2 Implementation

This directory (`frontend/`) contains the React + Vite + TypeScript surveillance dashboard application for **IBVAP (Intelligent Border Video Analytics Platform)**.

---

## 🛠 Technology Stack

- **Framework:** React 18
- **Build Tool:** Vite 5
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3 (Dark surveillance command & control theme)
- **Routing:** React Router DOM v6
- **Data Visualization:** Recharts
- **Iconography:** Lucide React

---

## 🚀 Phase 2 Features Implemented

1. **Enhanced Dashboard (`/dashboard`)**:
   - 6 key metric cards: Active Cameras, Total Detections, Active Alerts, Watchlist Matches, Vehicles Detected, Persons Detected.
   - Interactive camera status cards with last activity timestamps.
   - Live recent event stream following the Common Event Contract.
   - Recharts visual charts for hourly detection trends and event distribution.

2. **Live Camera Monitoring Wall & Inspector (`/cameras`)**:
   - Stream cards displaying camera ID, name, status, FPS, resolution, location, last hit timestamp, and hit count.
   - Interactive `CameraDetailModal` stream inspector with simulated video preview and masked RTSP credentials.

3. **Surveillance Events Registry (`/events`)**:
   - Search bar across camera IDs, license plates, and event details.
   - Event type tabs & camera drop-down filters.
   - Raw JSON payload contract modal inspector.

4. **Alerts & Threat Feed (`/alerts`)**:
   - Interactive severity feed (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
   - Operator actions: **Acknowledge**, **Mark Resolved**, **Dismiss**, and **View Alert Details**.

5. **Computer Vision Detections Feed (`/detections`)**:
   - Tracking ID tags (`TRK-xxxx`), bounding box coordinates, confidence badges, and object class filters (`person`, `vehicle`, `car`, `truck`, `motorcycle`, `license_plate`).

6. **Target Watchlist Management (`/watchlist`)**:
   - Complete CRUD UI: Search bar, priority filter, Add Target modal, Edit Target modal, Delete confirmation dialog (`ConfirmModal`), and hit count tracking.

7. **Analytics Dashboard (`/analytics`)**:
   - Recharts graphs: Detections Over Time, Event Type distribution pie chart, Camera Event Breakdown bar chart, and Alert Severity distribution bar chart.

8. **Camera Stream Management Hub (`/camera-management`)**:
   - Complete CRUD UI: Search bar, Add Camera modal, Edit Camera modal, Delete Camera confirmation dialog, Enable/Disable stream toggle, and credential masking.

---

## 📁 Folder Structure

```text
frontend/
├── public/
│   └── favicon.svg               # Platform favicon
├── src/
│   ├── components/
│   │   ├── camera-management/
│   │   │   └── CameraFormModal.tsx # Add / Edit camera stream modal
│   │   ├── cameras/
│   │   │   └── CameraDetailModal.tsx # Stream inspection modal
│   │   ├── common/               # Reusable UI states & controls
│   │   │   ├── Card.tsx
│   │   │   ├── ConfirmModal.tsx  # Confirmation dialog for destructive actions
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── SkeletonLoader.tsx # Loading skeleton
│   │   │   └── StatusBadge.tsx
│   │   ├── dashboard/            # Dashboard specific widgets
│   │   ├── layout/               # Header & Sidebar
│   │   └── watchlist/
│   │       └── WatchlistModal.tsx # Add / Edit watchlist modal
│   ├── data/
│   │   └── mockData.ts           # Isolated UI demonstration mock dataset
│   ├── layouts/
│   │   └── AppLayout.tsx         # Main layout container
│   ├── pages/                    # 8 Application route views
│   │   ├── AlertsPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   ├── CameraManagementPage.tsx
│   │   ├── CamerasPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DetectionsPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── WatchlistPage.tsx
│   ├── services/                 # Decoupled API service layer
│   │   ├── alertsService.ts
│   │   ├── analyticsService.ts
│   │   ├── api.ts                # Base fetch wrapper
│   │   ├── camerasService.ts
│   │   ├── detectionsService.ts
│   │   ├── eventsService.ts
│   │   └── watchlistService.ts
│   ├── types/                    # TypeScript interfaces
│   │   ├── alert.ts
│   │   ├── analytics.ts
│   │   ├── api.ts
│   │   ├── camera.ts
│   │   ├── detection.ts
│   │   ├── event.ts              # Common Event Contract
│   │   └── watchlist.ts
│   ├── utils/
│   │   └── formatters.ts         # Formatting helpers
│   ├── App.tsx                   # React Router definition
│   ├── index.css                 # Main stylesheet with Tailwind
│   ├── main.tsx                  # React DOM entry point
│   └── vite-env.d.ts
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 💻 How to Run the Frontend

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Vite Development Server
```bash
npm run dev
```
Access at: `http://localhost:3000`

### 3. Type Checking & Production Build
```bash
npx tsc --noEmit
npm run build
```

---

## 📡 Backend Integration & API Services

The service layer in `src/services/` targets Member 3's FastAPI backend endpoints:
- Base API URL: `import.meta.env.VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`)
- Endpoints:
  - `GET /api/v1/events`, `POST /api/v1/events`
  - `GET /api/v1/cameras`, `POST /api/v1/cameras`, `PATCH /api/v1/cameras/:id`, `DELETE /api/v1/cameras/:id`
  - `GET /api/v1/alerts`, `PATCH /api/v1/alerts/:id/acknowledge`, `PATCH /api/v1/alerts/:id/resolve`, `PATCH /api/v1/alerts/:id/dismiss`
  - `GET /api/v1/detections`
  - `GET /api/v1/watchlist`, `POST /api/v1/watchlist`, `PATCH /api/v1/watchlist/:id`, `DELETE /api/v1/watchlist/:id`

### Common Event Contract
```json
{
  "camera_id": "CAM-01",
  "event_type": "OBJECT_DETECTED",
  "timestamp": "2026-08-28T15:30:00",
  "confidence": 0.94,
  "metadata": {}
}
```
