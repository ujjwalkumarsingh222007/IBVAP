import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HealthProvider } from './context/HealthContext';
import { AlertProvider } from './context/AlertContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Cameras } from './pages/Cameras';
import { CameraMonitor } from './pages/CameraMonitor';
import { People } from './pages/People';
import { Vehicles } from './pages/Vehicles';
import { Events } from './pages/Events';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <HealthProvider>
      <AlertProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="cameras" element={<Cameras />} />
              <Route path="cameras/:id" element={<CameraMonitor />} />
              <Route path="people" element={<People />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="events" element={<Events />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AlertProvider>
    </HealthProvider>
  );
};

export default App;
