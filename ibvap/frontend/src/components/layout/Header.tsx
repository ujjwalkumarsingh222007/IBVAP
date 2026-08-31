import React, { useState, useEffect } from 'react';
import { Menu, Bell, ShieldAlert, Database, Cpu, Radio } from 'lucide-react';
import { useHealth } from '../../context/HealthContext';
import { useAlerts } from '../../context/AlertContext';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { isBackendOnline, isAiOnline, isDbConnected, health } = useHealth();
  const { alerts } = useAlerts();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setDateStr(
        now.toLocaleDateString([], {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).toUpperCase()
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const criticalAlertCount = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;

  return (
    <header className="h-14 bg-surface border-b border-surface-border px-3 lg:px-5 flex items-center justify-between sticky top-0 z-30 shadow-tactical">
      {/* Left: Mobile toggle + Breadcrumb / Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors lg:hidden border border-surface-border"
          aria-label="Toggle navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
              IBVAP COMMAND CONSOLE
            </span>
          </div>
          <span className="text-surface-border-light hidden sm:inline">|</span>
          <span className="text-[11px] font-mono text-tactical-muted hidden md:inline">
            ZONE: PRIMARY SECURITY PERIMETER
          </span>
        </div>
      </div>

      {/* Center: Tactical Live Status Rail */}
      <div className="hidden lg:flex items-center gap-4 bg-surface-subtle border border-surface-border px-3 py-1 rounded-md text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <span className="text-slate-400">SRV:</span>
          <span className={isBackendOnline ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
            {isBackendOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <span className="text-surface-border">|</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Cpu className="w-3 h-3 text-tactical-blue" />
          <span className="text-slate-400">AI CORE:</span>
          <span className={isAiOnline ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
            {isAiOnline ? 'READY' : 'STANDBY'}
          </span>
        </div>
        <span className="text-surface-border">|</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Database className="w-3 h-3 text-tactical-cyan" />
          <span className="text-slate-400">DB:</span>
          <span className={isDbConnected ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
            {isDbConnected ? 'SYNCED' : 'DISCONNECTED'}
          </span>
        </div>
        <span className="text-surface-border">|</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Radio className="w-3 h-3 text-tactical-amber" />
          <span className="text-slate-400">FEEDS:</span>
          <span className="text-slate-200 font-semibold">{health?.active_cameras || 1} ACTIVE</span>
        </div>
      </div>

      {/* Right: Operational Telemetry Clock & Alerts Bell */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Synchronized Precision Clock */}
        <div className="text-right hidden sm:block">
          <div className="text-xs font-mono font-bold tracking-widest text-slate-200">
            {timeStr || '00:00:00'}
          </div>
          <div className="text-[10px] font-mono text-tactical-slate tracking-wider">
            {dateStr || 'UTC'}
          </div>
        </div>

        {/* Operator Badge */}
        <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-surface-border">
          <div className="w-6 h-6 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-[10px] font-mono font-bold text-tactical-blue">
            OP
          </div>
          <div className="text-[11px] font-mono text-slate-300 leading-tight">
            <div>SEC-OP #01</div>
            <div className="text-[9px] text-emerald-400 font-semibold">AUTHORIZED</div>
          </div>
        </div>

        {/* Alert Notification Trigger */}
        <Link
          to="/alerts"
          className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-surface-elevated border border-surface-border transition-colors flex items-center justify-center"
          title="Active Tactical Alerts"
        >
          {criticalAlertCount > 0 ? (
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          ) : (
            <Bell className="w-4 h-4 text-slate-300" />
          )}
          {alerts.length > 0 && (
            <span
              className={`absolute -top-1 -right-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-white shadow-md ${
                criticalAlertCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-tactical-blue'
              }`}
            >
              {alerts.length > 99 ? '99+' : alerts.length}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};
