import React, { useState, useEffect } from 'react';
import { RefreshCw, Radio, User, LogOut } from 'lucide-react';
import { ConnectionStatusBadge } from '../common/ConnectionStatusBadge';
import { useAuth } from '../../hooks';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Surveillance Command Center',
  subtitle = 'Real-Time Border Video Analytics Platform',
  onRefresh,
  isRefreshing = false,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const { user, logout } = useAuth();

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 px-6 md:px-8 border-b border-surface-border bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      {/* Title */}
      <div className="min-w-0 pr-4">
        <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-wide truncate">{title}</h1>
        <p className="text-[11px] sm:text-xs text-slate-400 truncate">{subtitle}</p>
      </div>

      {/* Controls & Status */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Reusable System Connection Status Indicator */}
        <div className="hidden sm:block">
          <ConnectionStatusBadge showDetails />
        </div>

        <div className="sm:hidden">
          <ConnectionStatusBadge compact />
        </div>

        {/* Live Clock */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono text-slate-300 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800">
          <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>{timeStr}</span>
        </div>

        {/* Authenticated User Status */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-200">{user.username}</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                user.role === 'ADMIN'
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : user.role === 'OPERATOR'
                  ? 'bg-blue-950 text-blue-400 border border-blue-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {user.role}
            </span>
            <button
              onClick={logout}
              className="ml-1 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
              title="Log Out Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Manual Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
