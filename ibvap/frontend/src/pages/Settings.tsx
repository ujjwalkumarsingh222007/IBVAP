import React, { useState } from 'react';
import {
  Server,
  Cpu,
  Volume2,
  VolumeX,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Database,
} from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { soundManager } from '../utils/sound';

export const Settings: React.FC = () => {
  const { health, isBackendOnline, isAiOnline, isDbConnected, refreshHealth, lastChecked } =
    useHealth();
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [refreshing, setRefreshing] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    soundManager.setEnabled(next);
    setSoundEnabled(next);
    if (next) {
      soundManager.playAlert('MEDIUM');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHealth();
    setRefreshing(false);
  };

  return (
    <div className="space-y-4 max-w-4xl font-mono pb-12">
      {/* 1. Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              SYSTEM CONFIGURATION & TELEMETRY
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-emerald-400 border border-surface-border font-bold">
              SYS-OK
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Backend services, SQLite data engine, neural AI pipeline diagnostics, and audio alert triggers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Poll system diagnostics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Core Node Diagnostics */}
      <div className="bg-surface border border-surface-border rounded-lg p-4 space-y-4 shadow-tactical">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                CORE GATEWAY TELEMETRY
              </h3>
              <p className="text-[10px] text-tactical-slate">
                REST GATEWAY: HTTP://127.0.0.1:8000 · UVICORN WORKER
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Backend API */}
          <div className="p-3 rounded bg-surface-subtle border border-surface-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-tactical-slate uppercase font-bold">API SERVICE</span>
              {isBackendOnline ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <div className="text-sm font-bold text-white">
              {isBackendOnline ? 'ONLINE (200 OK)' : 'OFFLINE'}
            </div>
            <div className="text-[10px] text-tactical-slate">
              Build Version: {health?.version || '1.0.0'}
            </div>
          </div>

          {/* Database */}
          <div className="p-3 rounded bg-surface-subtle border border-surface-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-tactical-slate uppercase font-bold">DATABASE ENGINE</span>
              {isDbConnected ? (
                <Database className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <div className="text-sm font-bold text-white">
              {isDbConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
            <div className="text-[10px] text-tactical-slate">
              Storage: SQLite (ibvap.db)
            </div>
          </div>

          {/* AI Pipeline */}
          <div className="p-3 rounded bg-surface-subtle border border-surface-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-tactical-slate uppercase font-bold">AI INFERENCE</span>
              {isAiOnline ? (
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <div className="text-sm font-bold text-white">
              {health?.ai_pipeline_status || 'ONLINE'}
            </div>
            <div className="text-[10px] text-tactical-slate truncate">
              YOLOv8 + 1306-D + EasyOCR
            </div>
          </div>
        </div>

        {lastChecked && (
          <div className="text-[10px] text-tactical-slate text-right pt-1 border-t border-surface-border">
            LAST HEALTH TELEMETRY PING: {lastChecked.toLocaleTimeString([], { hour12: false })}
          </div>
        )}
      </div>

      {/* 3. Audio & Alarm Preferences */}
      <div className="bg-surface border border-surface-border rounded-lg p-4 space-y-3 shadow-tactical">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-amber">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                TACTICAL AUDIO & THREAT CHIMES
              </h3>
              <p className="text-[10px] text-tactical-slate">
                Audio alarms for watchlist breaches, unknown entities, and intrusion fence violations.
              </p>
            </div>
          </div>

          <button
            onClick={toggleSound}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${
              soundEnabled
                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-emerald-glow'
                : 'bg-surface-subtle border-surface-border text-tactical-slate'
            }`}
          >
            {soundEnabled ? 'AUDIO ARMED' : 'AUDIO MUTED'}
          </button>
        </div>
      </div>
    </div>
  );
};
