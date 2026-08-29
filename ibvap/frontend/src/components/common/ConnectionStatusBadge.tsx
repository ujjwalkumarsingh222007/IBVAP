import React from 'react';
import { Server, Database, RefreshCw } from 'lucide-react';
import { useHealth } from '../../hooks';

interface ConnectionStatusBadgeProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  compact = false,
  showDetails = false,
  className = '',
}) => {
  const { isDegraded, isOffline, health, refreshing, refresh } = useHealth(5000);

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border transition-all ${
          isOffline
            ? 'bg-red-950/80 text-red-400 border-red-800'
            : isDegraded
            ? 'bg-amber-950/80 text-amber-400 border-amber-800'
            : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
        } ${className}`}
        title={
          isOffline
            ? 'Backend Server Offline (Port 8000)'
            : isDegraded
            ? 'Database Disconnected'
            : 'All Systems Operational'
        }
      >
        <span className="relative flex h-2 w-2">
          {isOffline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </>
          ) : isDegraded ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          )}
        </span>
        <span>
          {isOffline ? 'BACKEND OFFLINE' : isDegraded ? 'DB DEGRADED' : 'SYSTEM ONLINE'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono shadow-sm ${className}`}
    >
      {/* Backend indicator */}
      <div className="flex items-center gap-1.5">
        <Server className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">Backend:</span>
        {isOffline ? (
          <span className="text-red-400 font-semibold flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            OFFLINE
          </span>
        ) : (
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            ONLINE
          </span>
        )}
      </div>

      <div className="h-3 w-px bg-slate-800" />

      {/* Database indicator */}
      <div className="flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">DB:</span>
        <span
          className={`font-semibold ${
            isOffline
              ? 'text-red-400'
              : health?.database === 'connected'
              ? 'text-emerald-400'
              : 'text-amber-400'
          }`}
        >
          {isOffline ? 'DISCONNECTED' : health?.database ? health.database.toUpperCase() : 'CHECKING'}
        </span>
      </div>

      {showDetails && (
        <>
          <div className="h-3 w-px bg-slate-800" />
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
            title="Check System Health"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </>
      )}
    </div>
  );
};

export default ConnectionStatusBadge;
