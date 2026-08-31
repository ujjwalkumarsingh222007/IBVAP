import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cctv,
  Users,
  Car,
  ShieldAlert,
  RefreshCw,
  Clock,
  ArrowRight,
  Radio,
  Shield,
  Maximize2,
} from 'lucide-react';
import { cameraApi } from '../api/cameraApi';
import { eventApi } from '../api/eventApi';
import { alertApi } from '../api/alertApi';
import { Camera, DashboardSummary, SurveillanceEventPayload, CorrelatedThreat } from '../types';
import { formatTimestamp, timeAgo } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<SurveillanceEventPayload[]>([]);
  const [activeThreats, setActiveThreats] = useState<CorrelatedThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [cams, sum, recent, threats] = await Promise.allSettled([
        cameraApi.getCameras(),
        eventApi.getDashboardSummary(),
        eventApi.getRecentEvents(8),
        alertApi.getActiveThreats(undefined, 6),
      ]);

      if (cams.status === 'fulfilled') setCameras(cams.value);
      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (recent.status === 'fulfilled') setRecentEvents(recent.value);
      if (threats.status === 'fulfilled') setActiveThreats(threats.value);
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 8000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const activeCamerasCount = cameras.filter((c) => c.status === 'ONLINE').length;
  const peopleDetectedCount = summary?.total_persons || 0;
  const vehiclesDetectedCount = summary?.total_vehicles || summary?.total_anpr || 0;
  const activeAlertsCount = activeThreats.length;
  const primaryCamera = cameras.length > 0 ? cameras[0] : null;

  return (
    <div className="space-y-4">
      {/* 1. Header & System Status Strip */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg shadow-tactical flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-mono font-black tracking-widest text-white">
              IBVAP
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-semibold">
              v2.0 PRO
            </span>
          </div>
          <p className="text-[11px] font-mono text-tactical-slate mt-0.5">
            Intelligent Video-Based Alert Platform · Autonomous Defense & Biometric Surveillance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/cameras/CAM-01')}
            className="px-3.5 py-1.5 rounded bg-tactical-blue hover:bg-blue-600 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-tactical cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            Launch Live Monitor
          </button>
        </div>
      </div>

      {/* 2. Key Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        {/* Active Feeds */}
        <div className="p-3 bg-surface border border-surface-border rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase tracking-wider font-bold">
              ACTIVE FEEDS
            </div>
            <div className="text-xl font-bold text-white mt-0.5">
              {loading ? '--' : `${activeCamerasCount} / ${cameras.length || 1}`}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
            <Cctv className="w-4 h-4" />
          </div>
        </div>

        {/* Biometrics Tracked */}
        <div className="p-3 bg-surface border border-surface-border rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase tracking-wider font-bold">
              PEOPLE IDENTIFIED
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {loading ? '--' : peopleDetectedCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Vehicles & Plates */}
        <div className="p-3 bg-surface border border-surface-border rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase tracking-wider font-bold">
              ANPR / PLATES SCANNED
            </div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">
              {loading ? '--' : vehiclesDetectedCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-cyan-400">
            <Car className="w-4 h-4" />
          </div>
        </div>

        {/* Active Threats */}
        <div className="p-3 bg-surface border border-surface-border rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase tracking-wider font-bold">
              ACTIVE THREATS
            </div>
            <div className={`text-xl font-bold mt-0.5 ${activeAlertsCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
              {loading ? '--' : activeAlertsCount}
            </div>
          </div>
          <div className={`w-9 h-9 rounded border flex items-center justify-center ${activeAlertsCount > 0 ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-surface-elevated border-surface-border text-slate-400'}`}>
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Primary Grid: Live Surveillance + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Pane: Live Primary Surveillance Viewport (7 Cols) */}
        <div className="lg:col-span-7 bg-surface border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-tactical">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                PRIMARY SURVEILLANCE FEED
              </span>
              <span className="text-[10px] text-tactical-slate px-1.5 py-0.2 rounded bg-surface-subtle border border-surface-border">
                {primaryCamera?.camera_id || 'CAM-01'}
              </span>
            </div>

            <button
              onClick={() => navigate(`/cameras/${primaryCamera?.camera_id || 'CAM-01'}`)}
              className="text-[11px] font-mono text-tactical-blue hover:text-blue-300 flex items-center gap-1"
            >
              Full Monitor <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          {/* Camera Viewport Canvas */}
          <div className="relative my-3 bg-black rounded border border-surface-border overflow-hidden aspect-video flex items-center justify-center tactical-reticle">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 border border-slate-700 text-[10px] font-mono text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE 1080p</span>
            </div>

            <div className="absolute top-2 right-2 z-10 text-[10px] font-mono text-tactical-slate bg-black/70 px-2 py-0.5 rounded border border-slate-800">
              FPS: 30 / AI: 6
            </div>

            <div className="text-center p-6 space-y-2">
              <Cctv className="w-8 h-8 mx-auto text-tactical-slate/60" />
              <div className="text-xs font-mono text-slate-300 font-semibold">
                {primaryCamera?.name || 'Primary Perimeter Optical Gateway'}
              </div>
              <div className="text-[11px] font-mono text-tactical-slate">
                Live AI object tracking, face recognition & ANPR active
              </div>
              <button
                onClick={() => navigate(`/cameras/${primaryCamera?.camera_id || 'CAM-01'}`)}
                className="mt-2 px-3 py-1.5 bg-surface-elevated hover:bg-tactical-blue hover:text-white border border-surface-border text-slate-300 rounded text-xs font-mono font-semibold transition-colors"
              >
                Engage Live Stream
              </button>
            </div>
          </div>

          {/* Quick Telemetry Footnote */}
          <div className="flex items-center justify-between text-[11px] font-mono text-tactical-slate pt-2 border-t border-surface-border">
            <span>LOCATION: {primaryCamera?.location || 'GATE-01 MAIN ENTRANCE'}</span>
            <span className="text-emerald-400">STATUS: ONLINE</span>
          </div>
        </div>

        {/* Right Pane: Active Alerts & Correlated Threat Feed (5 Cols) */}
        <div className="lg:col-span-5 bg-surface border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-tactical">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  ACTIVE THREATS & ALERTS
                </span>
              </div>
              <button
                onClick={() => navigate('/alerts')}
                className="text-[11px] font-mono text-tactical-blue hover:text-blue-300 flex items-center gap-1"
              >
                View all ({activeThreats.length}) <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Alert List */}
            <div className="space-y-2 mt-3">
              {activeThreats.length === 0 ? (
                <div className="py-12 text-center text-tactical-slate font-mono text-xs">
                  <Shield className="w-7 h-7 mx-auto text-tactical-slate/50 mb-2" />
                  <div>SECTOR SECURE · NO ACTIVE THREATS</div>
                </div>
              ) : (
                activeThreats.slice(0, 4).map((threat) => (
                  <div
                    key={threat.threat_id || threat.id}
                    onClick={() => navigate('/alerts')}
                    className="p-2.5 rounded bg-surface-subtle hover:bg-surface-elevated border border-surface-border hover:border-tactical-blue transition-all cursor-pointer flex items-start gap-2.5"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        threat.severity === 'CRITICAL'
                          ? 'bg-red-500 animate-pulse'
                          : threat.severity === 'HIGH'
                          ? 'bg-amber-500'
                          : 'bg-blue-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {threat.title || 'Security Anomaly'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            threat.severity === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {threat.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {threat.reason}
                      </div>
                      <div className="text-[10px] text-tactical-slate mt-1 flex items-center justify-between">
                        <span>CAM: {threat.camera_id}</span>
                        <span>{timeAgo(threat.last_event_time)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-surface-border flex items-center justify-between text-[11px] font-mono text-tactical-slate">
            <span>SEVERITY CRITICAL THRESHOLD: HIGH</span>
            <button
              onClick={() => navigate('/alerts')}
              className="text-tactical-blue hover:underline"
            >
              Threat Engine Console →
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Grid: Recent Surveillance Events Timeline + Camera Status Nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Recent Events Table (8 Cols) */}
        <div className="lg:col-span-8 bg-surface border border-surface-border rounded-lg p-4 shadow-tactical">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border font-mono">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-tactical-blue" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                SURVEILLANCE EVENT LOGS
              </span>
            </div>
            <button
              onClick={() => navigate('/events')}
              className="text-[11px] text-tactical-blue hover:text-blue-300 flex items-center gap-1"
            >
              All Events <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            {recentEvents.length === 0 ? (
              <div className="py-8 text-center text-tactical-slate font-mono text-xs">
                No recent surveillance events logged.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-tactical-slate text-[10px] uppercase">
                    <th className="pb-2 font-medium">TIME</th>
                    <th className="pb-2 font-medium">CAMERA</th>
                    <th className="pb-2 font-medium">ENTITY / STATUS</th>
                    <th className="pb-2 font-medium">DETAILS</th>
                    <th className="pb-2 font-medium text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/60">
                  {recentEvents.map((evt, idx) => {
                    const statusStr = evt.metadata?.status || 'UNKNOWN';
                    const isKnown = statusStr === 'KNOWN';
                    const isFlagged = statusStr === 'FLAGGED';
                    const targetName = evt.metadata?.person_name || evt.metadata?.plate_number || evt.event_type;

                    return (
                      <tr key={evt.id || idx} className="hover:bg-surface-subtle/60 transition-colors">
                        <td className="py-2 text-slate-300 whitespace-nowrap">
                          {formatTimestamp(evt.timestamp || evt.created_at)}
                        </td>
                        <td className="py-2 text-tactical-blue whitespace-nowrap">
                          {evt.camera_id}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              isKnown
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : isFlagged
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {statusStr}
                          </span>
                        </td>
                        <td className="py-2 text-slate-300 truncate max-w-xs">
                          {targetName}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => navigate('/events')}
                            className="text-[10px] text-tactical-slate hover:text-white px-2 py-1 rounded bg-surface-subtle border border-surface-border"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Camera Nodes Matrix (4 Cols) */}
        <div className="lg:col-span-4 bg-surface border border-surface-border rounded-lg p-4 shadow-tactical flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-border font-mono">
              <div className="flex items-center gap-2">
                <Cctv className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                  CAMERA NODES
                </span>
              </div>
              <button
                onClick={() => navigate('/cameras')}
                className="text-[11px] text-tactical-blue hover:text-blue-300"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2 mt-3 font-mono">
              {cameras.map((c) => (
                <div
                  key={c.camera_id}
                  onClick={() => navigate(`/cameras/${c.camera_id}`)}
                  className="p-2.5 rounded bg-surface-subtle hover:bg-surface-elevated border border-surface-border transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{c.camera_id}</div>
                      <div className="text-[10px] text-tactical-slate truncate max-w-[140px]">
                        {c.name}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-slate-300 border border-surface-border">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-surface-border text-[11px] font-mono text-tactical-slate flex items-center justify-between">
            <span>RTSP / HTTP INGESTION</span>
            <span className="text-emerald-400 font-semibold">100% HEALTHY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
