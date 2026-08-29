import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertNotificationProvider } from './context/AlertNotificationContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LiveEvents } from './pages/LiveEvents';
import { Alerts } from './pages/Alerts';
import { ANPR } from './pages/ANPR';
import { Analytics } from './pages/Analytics';
import { Events } from './pages/Events';
import { EventDetails } from './pages/EventDetails';
import { Cameras } from './pages/Cameras';
import { SystemHealth } from './pages/SystemHealth';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <AuthProvider>
      <AlertNotificationProvider>
        <Router>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Command Center Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="live-events" element={<LiveEvents />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="anpr" element={<ANPR />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="cameras" element={<Cameras />} />
                <Route path="health" element={<SystemHealth />} />
                <Route path="system" element={<Navigate to="/health" replace />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AlertNotificationProvider>
    </AuthProvider>
  );
}

export default App;
