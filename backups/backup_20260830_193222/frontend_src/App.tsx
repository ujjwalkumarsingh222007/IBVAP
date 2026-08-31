import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertNotificationProvider } from './context/AlertNotificationContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Cameras } from './pages/Cameras';
import { People } from './pages/People';
import { Vehicles } from './pages/Vehicles';
import { Alerts } from './pages/Alerts';
import { Evidence } from './pages/Evidence';
import { Events } from './pages/Events';
import { EventDetails } from './pages/EventDetails';
import { Settings } from './pages/Settings';
import { LiveEvents } from './pages/LiveEvents';
import { ANPR } from './pages/ANPR';
import { Analytics } from './pages/Analytics';
import { SystemHealth } from './pages/SystemHealth';
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
                <Route path="cameras" element={<Cameras />} />
                <Route path="people" element={<People />} />
                <Route path="vehicles" element={<Vehicles />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="evidence" element={<Evidence />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="settings" element={<Settings />} />

                {/* Compatibility & Secondary Routes */}
                <Route path="live-events" element={<LiveEvents />} />
                <Route path="anpr" element={<ANPR />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="health" element={<SystemHealth />} />
                <Route path="system" element={<Navigate to="/health" replace />} />
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
