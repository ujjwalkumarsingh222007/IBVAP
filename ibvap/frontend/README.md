# IBVAP — Frontend Surveillance Dashboard

> **Intelligent Border Video Analytics Platform (IBVAP)** — Command Center UI

---

## 1. Overview

The **IBVAP Frontend** is a modern, high-performance surveillance dashboard application built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Recharts**. It interfaces directly with the central IBVAP FastAPI backend running at `http://127.0.0.1:8000`.

### Key Features
* **Command Center Dashboard (`/` & `/dashboard`):** Real-time KPI summaries across all 7 surveillance event categories, active camera ratios, interactive Recharts visualizations (pie distribution and bar breakdowns), and live recent events feed.
* **Surveillance Event Logs (`/events`):** Paginated event tables with multi-parameter filtering (`event_type`, `camera_id`, `confidence_min`, `confidence_max`), server-side pagination, and exportable data views.
* **Forensic Event Detail (`/events/:id`):** Deep dive into spatial telemetry, bounding box visualizer, centroid coordinates, and raw JSON common event contract viewer.
* **Camera Management (`/cameras`):** Camera stream registry with `ONLINE`, `OFFLINE`, and `UNKNOWN` status tracking, Add/Edit/Delete modals, and safe historical event retention.
* **Diagnostics & Architecture (`/system`):** Live backend health check and database connectivity monitor.
* **Automatic Polling:** Lightweight 12-second background sync with manual refresh triggers.

---

## 2. Tech Stack

* **Core Framework:** React 18 with TypeScript 5
* **Build Tool:** Vite 6
* **Routing:** React Router v7
* **Styling:** Tailwind CSS 3 (Dark Government/Surveillance Security Theme)
* **Data Visualization:** Recharts
* **Icons:** Lucide React
* **HTTP Client:** Axios with centralized error normalization

---

## 3. Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/             # Badges, Buttons, Cards, Modals, Skeletons, Error Alerts
│   │   ├── layout/             # Sidebar navigation, Header with live clock & health
│   │   ├── dashboard/          # KPI Cards, Analytics Charts, Recent Events Feed
│   │   ├── events/             # Filter Panel, Events Table, Pagination
│   │   └── cameras/            # Camera Cards, Camera Modal, Delete Confirmation Modal
│   ├── pages/
│   │   ├── Dashboard.tsx       # Live surveillance command center
│   │   ├── Events.tsx          # Full event search and filter logs
│   │   ├── EventDetails.tsx    # Forensic event telemetry and raw JSON
│   │   ├── Cameras.tsx         # Camera stream CRUD and status tracking
│   │   ├── SystemHealth.tsx    # Microservice diagnostic view
│   │   ├── Settings.tsx        # Dashboard preferences & API targets
│   │   └── NotFound.tsx        # 404 handler
│   ├── services/
│   │   └── api.ts              # Centralized Axios client and error formatting
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces matching backend models
│   ├── App.tsx                 # React Router setup
│   ├── main.tsx                # Application bootstrap
│   ├── index.css               # Dark theme base styles and radar pulse animations
│   └── vite-env.d.ts           # Ambient type declarations
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── README.md
```

---

## 4. Getting Started

### 1 — Prerequisites
* Node.js 18+ / 20+
* npm or yarn
* IBVAP Backend running at `http://127.0.0.1:8000`

### 2 — Install Dependencies
```bash
npm install
```

### 3 — Run Development Server
```bash
npm run dev
```
Development Server will launch at: **`http://localhost:5173`**

### 4 — Production Build
```bash
npm run build
npm run preview
```

---

## 5. Backend Integration & Environment

The frontend defaults to connecting to:
`http://127.0.0.1:8000`

To customize the backend endpoint, create a `.env` file in the `frontend/` directory:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```
