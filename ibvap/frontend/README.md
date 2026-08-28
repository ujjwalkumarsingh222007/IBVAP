# IBVAP — Member 4 Frontend Phase 1 Foundation

This directory (`frontend/`) contains the React + Vite + TypeScript frontend application for **IBVAP (Intelligent Border Video Analytics Platform)**.

---

## 🛠 Technology Stack

- **Framework:** React 18
- **Build Tool:** Vite 5
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3 (Custom dark surveillance / command & control theme)
- **Routing:** React Router DOM v6
- **Data Visualization:** Recharts
- **Iconography:** Lucide React

---

## 📁 Directory & Folder Structure

```text
frontend/
├── public/
│   └── favicon.svg               # IBVAP platform favicon
├── src/
│   ├── components/
│   │   ├── common/               # Reusable UI states & controls
│   │   │   ├── Card.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── dashboard/            # Dashboard specific widgets
│   │   │   ├── CameraStatusGrid.tsx
│   │   │   ├── DetectionStatsChart.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   └── RecentEventsList.tsx
│   │   └── layout/               # Shell layout components
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── data/
│   │   └── mockData.ts           # Isolated UI demonstration mock dataset
│   ├── layouts/
│   │   └── AppLayout.tsx         # Main frame layout wrapper
│   ├── pages/                    # 8 Application route views
│   │   ├── AlertsPage.tsx        # /alerts
│   │   ├── AnalyticsPage.tsx     # /analytics
│   │   ├── CameraManagementPage.tsx # /camera-management
│   │   ├── CamerasPage.tsx       # /cameras
│   │   ├── DashboardPage.tsx     # /dashboard & /
│   │   ├── DetectionsPage.tsx    # /detections
│   │   ├── EventsPage.tsx       # /events
│   │   ├── NotFoundPage.tsx      # * (404)
│   │   └── WatchlistPage.tsx     # /watchlist
│   ├── services/                 # Decoupled API service layer
│   │   ├── alertsService.ts
│   │   ├── analyticsService.ts
│   │   ├── api.ts                # Base fetch wrapper & error handler
│   │   ├── camerasService.ts
│   │   ├── detectionsService.ts
│   │   ├── eventsService.ts
│   │   └── watchlistService.ts
│   ├── types/                    # API Data contracts & interfaces
│   │   ├── alert.ts
│   │   ├── analytics.ts
│   │   ├── api.ts
│   │   ├── camera.ts
│   │   ├── detection.ts
│   │   ├── event.ts              # Common Event Contract
│   │   └── watchlist.ts
│   ├── utils/
│   │   └── formatters.ts         # Timestamp, confidence %, badge formatting
│   ├── App.tsx                   # Route definitions
│   ├── index.css                 # Main stylesheet with Tailwind directives
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

## 🚀 How to Run the Frontend

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Vite Development Server
```bash
npm run dev
```
The application will launch at: `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
```

---

## 🌐 Available Routes

| Route | Description |
|---|---|
| `/` or `/dashboard` | Main surveillance command dashboard with key cards, live stream grid, event stream & detection charts |
| `/cameras` | Live video feed wall with AI detection overlays & stream parameters |
| `/events` | Event log table with filter by type & raw JSON payload contract viewer |
| `/alerts` | Critical/High threat alert feed with acknowledgement controls |
| `/detections` | YOLO computer vision bounding box detections feed |
| `/watchlist` | Target license plate registry & POI watchlist modal |
| `/analytics` | Recharts data visualizations for detection frequencies & threat ratios |
| `/camera-management` | IP CCTV / RTSP stream registration and configuration table |

---

## 📡 Future Backend Integration Approach

The frontend connects to Member 3's FastAPI backend over REST APIs.

Base API URL is configurable via environment variable:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

All services in `src/services/` (`eventsService.ts`, `camerasService.ts`, `alertsService.ts`, etc.) consume endpoints such as:
- `GET /api/v1/events`
- `GET /api/v1/cameras`
- `GET /api/v1/alerts`
- `GET /api/v1/detections`
- `GET /api/v1/watchlist`
- `POST /api/v1/events`

### Common Event Contract Format
Events adhere strictly to the IBVAP contract:
```json
{
  "camera_id": "CAM-01",
  "event_type": "OBJECT_DETECTED",
  "timestamp": "2026-08-28T15:30:00",
  "confidence": 0.94,
  "metadata": {}
}
```

---

## 🔐 Development Guidelines

- **Ownership Scope:** All frontend modifications must remain strictly within `frontend/`.
- **Decoupled Architecture:** Keep UI components independent from database schemas and AI model internals.
- **Graceful Fallbacks:** Use `LoadingSpinner`, `EmptyState`, and `ErrorState` components for asynchronous API states.
