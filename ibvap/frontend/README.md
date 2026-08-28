# IBVAP — Member 4 Frontend Phase 3 Integration & Reliability

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

## 📡 Phase 3 API Integration Architecture

The Phase 3 frontend architecture establishes a reliable, decoupled connection to Member 3's FastAPI REST API:

```text
FastAPI Backend (http://localhost:8000/api/v1)
       ↓
Centralized API Client (src/services/apiClient.ts)
       ↓ (Network Error Fallback) ──→ Isolated Mock Dataset (src/data/mockData.ts)
Data Mapper Layer (src/utils/mappers.ts)
       ↓
Services (src/services/*)
       ↓
Custom Hooks (src/hooks/useApiData.ts & usePolling.ts)
       ↓
React Pages & UI Components
```

### Key API Integration & Reliability Features:
1. **Configurable Base URL**: Configured via `VITE_API_BASE_URL` in `frontend/.env.example` (default: `http://localhost:8000/api/v1`).
2. **Data Mappers (`src/utils/mappers.ts`)**: Prevents UI crashes by converting snake_case or variant API fields safely into UI contracts.
3. **Environment Status Badge**:
   - Displays **`LIVE BACKEND (FastAPI)`** with a green pulse when the FastAPI server responds.
   - Displays **`DEMO DATA`** with an amber indicator when running on development mock fallback.
4. **Periodic Polling (`src/hooks/usePolling.ts`)**: Automatically polls API endpoints every 10 seconds with timer cleanup on unmount to prevent memory leaks.
5. **Masked RTSP Credentials**: Masks passwords inside camera stream URLs (`rtsp://admin:****@192.168.10.101:554/live`).

---

## 🔌 API Endpoints Supported

| Endpoint | Method | Service Method | Description |
|---|---|---|---|
| `/api/v1/events` | GET | `eventsService.getEvents(filters)` | Fetch event stream (Common Event Contract) |
| `/api/v1/events` | POST | `eventsService.createEvent(payload)` | Publish new event payload |
| `/api/v1/cameras` | GET | `camerasService.getCameras()` | Fetch registered CCTV/RTSP camera feeds |
| `/api/v1/cameras` | POST | `camerasService.addCamera(input)` | Register new RTSP stream |
| `/api/v1/cameras/:id` | PATCH | `camerasService.updateCamera(id, input)` | Update stream properties / status |
| `/api/v1/cameras/:id` | DELETE | `camerasService.deleteCamera(id)` | Unregister camera stream |
| `/api/v1/alerts` | GET | `alertsService.getAlerts()` | Fetch security threat warnings |
| `/api/v1/alerts/:id/acknowledge` | PATCH | `alertsService.acknowledgeAlert(id)` | Acknowledge alert status |
| `/api/v1/alerts/:id/resolve` | PATCH | `alertsService.resolveAlert(id, notes)` | Resolve alert status |
| `/api/v1/alerts/:id/dismiss` | PATCH | `alertsService.dismissAlert(id)` | Dismiss alert |
| `/api/v1/detections` | GET | `detectionsService.getDetections()` | Fetch YOLO object detection logs |
| `/api/v1/watchlist` | GET | `watchlistService.getWatchlist()` | Fetch ANPR license plate & POI watchlist |
| `/api/v1/watchlist` | POST | `watchlistService.addWatchlistEntry(input)` | Add target to watchlist |
| `/api/v1/watchlist/:id` | PATCH | `watchlistService.updateWatchlistEntry(id, input)` | Update watchlist target |
| `/api/v1/watchlist/:id` | DELETE | `watchlistService.deleteWatchlistEntry(id)` | Remove watchlist target |

---

## 📁 Project Structure

```text
frontend/
├── .env.example                  # Environment configuration example
├── public/
│   └── favicon.svg
├── src/
│   ├── components/               # Modular UI components
│   │   ├── camera-management/
│   │   ├── cameras/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   │   └── Header.tsx        # Live / Demo Data status badge
│   │   └── watchlist/
│   ├── data/
│   │   └── mockData.ts           # Development mock dataset
│   ├── hooks/
│   │   ├── useApiData.ts         # Centralized state & data hook
│   │   └── usePolling.ts         # Periodic refresh hook with timer cleanup
│   ├── pages/                    # 8 Application route views
│   ├── services/                 # Service layer & API client
│   │   ├── alertService.ts
│   │   ├── analyticsService.ts
│   │   ├── api.ts
│   │   ├── apiClient.ts          # Centralized fetch wrapper & status tracking
│   │   ├── cameraService.ts
│   │   ├── detectionService.ts
│   │   ├── eventService.ts
│   │   └── watchlistService.ts
│   ├── types/                    # TypeScript interfaces
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── mappers.ts            # Response payload mappers
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 💻 Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Start Vite dev server
npm run dev

# 3. Type check & production build
npx tsc --noEmit
npm run build
```
