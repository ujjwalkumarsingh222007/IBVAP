import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CamerasPage } from './pages/CamerasPage';
import { EventsPage } from './pages/EventsPage';
import { AlertsPage } from './pages/AlertsPage';
import { DetectionsPage } from './pages/DetectionsPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CameraManagementPage } from './pages/CameraManagementPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="detections" element={<DetectionsPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="camera-management" element={<CameraManagementPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
