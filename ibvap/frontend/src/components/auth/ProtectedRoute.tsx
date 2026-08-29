import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { UserRole } from '../../types';
import { Shield, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center font-mono">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center gap-3 shadow-2xl animate-pulse">
          <div className="p-3 bg-blue-950/80 border border-blue-800 rounded-xl text-blue-400">
            <Shield className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-100">IBVAP Command Center</h3>
            <p className="text-xs text-slate-400 mt-0.5">Verifying authentication credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-4 font-mono">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-red-800/80 rounded-2xl shadow-2xl space-y-4 text-center">
          <div className="inline-flex p-3 bg-red-950 border border-red-700 rounded-xl text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">Access Restricted</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your assigned role <strong className="text-red-400">{user.role}</strong> does not possess clearance to view this module.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
