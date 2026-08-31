import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  Layers,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Threat, ThreatStats } from '../../types';
import { threatsApi, formatApiError } from '../../api';
import { ThreatTimelineModal } from './ThreatTimelineModal';
import { Badge } from '../common/Badge';

export const ThreatIntelligenceWidget: React.FC = () => {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);

  const fetchThreatData = useCallback(async () => {
    try {
      const [activeThreats, threatStats] = await Promise.all([
        threatsApi.getActiveThreats(undefined, 10),
        threatsApi.getThreatStats(),
      ]);
      setThreats(activeThreats);
      setStats(threatStats);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreatData();
    const interval = setInterval(fetchThreatData, 4000);
    return () => clearInterval(interval);
  }, [fetchThreatData]);

  return (
    <>
      <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-lg space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/70 border border-red-800/60 text-red-400 shadow">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wide flex items-center gap-2">
                Unified Threat Intelligence
                {stats && stats.active_threats > 0 && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-600 text-white font-mono animate-pulse">
                    {stats.active_threats} ACTIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Cross-sensor correlation of Member 1 CV & Member 2 ANPR streams
              </p>
            </div>
          </div>

          <button
            onClick={fetchThreatData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Refresh Intelligence Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                Total Correlated
              </span>
              <div className="text-lg font-bold font-mono text-slate-200">
                {stats.total_threats}
              </div>
            </div>
            <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-2.5 text-center">
              <span className="text-[10px] text-red-400 uppercase font-mono">
                Critical Hits
              </span>
              <div className="text-lg font-bold font-mono text-red-400">
                {stats.critical}
              </div>
            </div>
            <div className="bg-rose-950/30 border border-rose-900/40 rounded-lg p-2.5 text-center">
              <span className="text-[10px] text-rose-400 uppercase font-mono">
                High Priority
              </span>
              <div className="text-lg font-bold font-mono text-rose-400">
                {stats.high}
              </div>
            </div>
            <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg p-2.5 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-mono">
                Medium Risk
              </span>
              <div className="text-lg font-bold font-mono text-amber-400">
                {stats.medium}
              </div>
            </div>
          </div>
        )}

        {/* Active Threats List */}
        {loading && !threats.length ? (
          <div className="space-y-2">
            <div className="h-16 bg-slate-800/40 rounded-lg animate-pulse" />
            <div className="h-16 bg-slate-800/40 rounded-lg animate-pulse" />
          </div>
        ) : threats.length === 0 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-mono text-slate-400">
              No active correlated threats detected across sensor perimeter.
            </p>
            <p className="text-[11px] text-slate-500">
              Correlation engine is actively monitoring all camera feeds within 10s sliding windows.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
            {threats.map((threat) => (
              <div
                key={threat.id}
                onClick={() => setSelectedThreatId(threat.threat_id)}
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-900/80 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={threat.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                      {threat.severity}
                    </Badge>
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {threat.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {threat.camera_id}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">{threat.reason}</p>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 pt-0.5">
                    <span>
                      Events: <strong className="text-slate-300">{threat.event_count}</strong>
                    </span>
                    <span>
                      Score: <strong className="text-amber-400">{threat.score}/100</strong>
                    </span>
                    <span>
                      Time: {threat.last_event_time.slice(11, 19)}
                    </span>
                  </div>
                </div>

                <button
                  className="flex items-center gap-1 text-xs font-mono text-blue-400 group-hover:text-blue-300 shrink-0 px-2.5 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedThreatId(threat.threat_id);
                  }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Timeline
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Modal */}
      {selectedThreatId && (
        <ThreatTimelineModal
          threatId={selectedThreatId}
          onClose={() => setSelectedThreatId(null)}
          onStatusUpdated={fetchThreatData}
        />
      )}
    </>
  );
};
