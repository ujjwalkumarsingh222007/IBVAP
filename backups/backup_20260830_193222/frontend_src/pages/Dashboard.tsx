import React, { useState } from 'react';
import { Shield, Eye, Camera as CameraIcon, AlertTriangle, User, Car } from 'lucide-react';
import { KPICards } from '../components/dashboard/KPICards';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { useDashboardSummary } from '../hooks';
import { SurveillanceEvent } from '../types';

export const Dashboard: React.FC = () => {
  const {
    summary,
    recentEvents,
    loading,
    error,
    refresh,
  } = useDashboardSummary({ pollIntervalMs: 4000, recentLimit: 12 });

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const getEventBadge = (event: SurveillanceEvent) => {
    const meta = event.metadata || {};
    const type = event.event_type;
    const name = meta.person_name && meta.person_name !== 'Unknown' ? meta.person_name : null;
    const plate = meta.plate_number ? meta.plate_number : null;

    if (type === 'FLAGGED_PERSON' || meta.status === 'FLAGGED') {
      return {
        label: name ? `FLAGGED PERSON: ${name}` : 'FLAGGED PERSON',
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        badgeBg: 'bg-red-950/80 text-red-300 border-red-700/80',
        dot: 'bg-red-500',
      };
    }
    if (type === 'UNKNOWN_PERSON' || (meta.class_name === 'person' && !meta.is_known)) {
      return {
        label: 'UNKNOWN PERSON',
        icon: <User className="w-4 h-4 text-amber-400" />,
        badgeBg: 'bg-amber-950/70 text-amber-300 border-amber-700/70',
        dot: 'bg-amber-500',
      };
    }
    if (type === 'PERSON_DETECTED' || meta.is_known) {
      return {
        label: name ? `KNOWN PERSON: ${name}` : 'KNOWN PERSON',
        icon: <User className="w-4 h-4 text-emerald-400" />,
        badgeBg: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70',
        dot: 'bg-emerald-500',
      };
    }
    if (type === 'WATCHLIST_MATCH' || meta.watchlist_match) {
      return {
        label: plate ? `FLAGGED VEHICLE: ${plate}` : 'FLAGGED VEHICLE',
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        badgeBg: 'bg-red-950/80 text-red-300 border-red-700/80',
        dot: 'bg-red-500',
      };
    }
    if (type === 'ANPR_DETECTED' || type === 'VEHICLE_DETECTED') {
      return {
        label: plate ? `VEHICLE: ${plate}` : 'VEHICLE DETECTED',
        icon: <Car className="w-4 h-4 text-cyan-400" />,
        badgeBg: 'bg-cyan-950/70 text-cyan-300 border-cyan-700/70',
        dot: 'bg-cyan-500',
      };
    }
    return {
      label: type.replace('_', ' '),
      icon: <Shield className="w-4 h-4 text-blue-400" />,
      badgeBg: 'bg-blue-950/70 text-blue-300 border-blue-800',
      dot: 'bg-blue-500',
    };
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-surface-border/60">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
            IBVAP
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Intelligent Video & Biometric Analysis Platform
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 self-start sm:self-auto font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 font-semibold">System Online</span>
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Surveillance Gateway Offline"
          message={error}
          onRetry={refresh}
        />
      )}

      {loading && !summary ? (
        <div className="space-y-6">
          <CardSkeleton count={4} />
          <div className="h-64 bg-surface border border-surface-border rounded-xl animate-pulse" />
        </div>
      ) : (
        summary && (
          <div className="space-y-6">
            {/* 4 Summary KPI Cards */}
            <KPICards summary={summary} />

            {/* LIVE ACTIVITY Feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Live Activity
                  </h2>
                </div>
                <button
                  onClick={refresh}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono"
                >
                  Refresh
                </button>
              </div>

              {recentEvents.length === 0 ? (
                <div className="p-8 text-center bg-surface border border-surface-border rounded-xl text-slate-400 font-mono text-xs">
                  No surveillance events recorded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentEvents.map((ev) => {
                    const badge = getEventBadge(ev);
                    const confPct = ev.confidence ? Math.round(ev.confidence * 100) : null;

                    return (
                      <div
                        key={ev.id}
                        className="bg-surface border border-surface-border hover:border-slate-600/80 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs transition-all font-mono"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                            {badge.icon}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded font-bold border ${badge.badgeBg}`}>
                                {badge.label}
                              </span>
                              {confPct !== null && (
                                <span className="text-[10px] text-slate-400">
                                  {confPct}% conf
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                              <span className="flex items-center gap-1">
                                <CameraIcon className="w-3 h-3 text-slate-500" />
                                {ev.camera_id}
                              </span>
                              <span>•</span>
                              <span>{formatTimestamp(ev.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedEventId(ev.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors"
                          title="View Details & Evidence"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Progressive Disclosure: Event Details & Evidence Modal */}
      {selectedEventId && (
        <EventDetailModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

