import React, { useState, useCallback, useRef } from 'react';
import {
  Radio,
  ShieldAlert,
  Clock,
  Target,
  RefreshCw,
  Eye,
  AlertTriangle,
  Flame,
  Car,
  Camera as CameraIcon,
  Sparkles,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { EventBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { dashboardApi, formatApiError } from '../api';
import { SurveillanceEvent } from '../types';
import { usePolling } from '../hooks';
import { getEventSeverity, getSeverityConfig } from '../utils/severity';

export const LiveEvents: React.FC = () => {
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [newlyDetectedIds, setNewlyDetectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  const fetchLiveEvents = useCallback(async () => {
    try {
      const data = await dashboardApi.getRecentEvents(20);

      // Prevent duplicates and sort newest first
      const uniqueEventsMap = new Map<number, SurveillanceEvent>();
      data.forEach((ev) => uniqueEventsMap.set(ev.id, ev));

      const sorted = Array.from(uniqueEventsMap.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA || b.id - a.id;
      });

      setEvents(sorted);

      // Detect newly arrived events
      if (sorted.length > 0) {
        const newIds = new Set<number>();
        if (!initialLoadRef.current) {
          sorted.forEach((ev) => {
            if (!seenIdsRef.current.has(ev.id)) {
              newIds.add(ev.id);
            }
          });
        }
        initialLoadRef.current = false;

        sorted.forEach((ev) => seenIdsRef.current.add(ev.id));

        if (newIds.size > 0) {
          setNewlyDetectedIds(newIds);
          setTimeout(() => {
            setNewlyDetectedIds(new Set());
          }, 4500);
        }
      }

      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { isPolling, refreshing, lastUpdated, refresh, togglePolling } = usePolling(
    fetchLiveEvents,
    {
      intervalMs: 3000,
      enabled: true,
      pauseWhenHidden: true,
      immediate: true,
    }
  );

  const criticalCount = events.filter(
    (e) => getEventSeverity(e.event_type) === 'CRITICAL' || getEventSeverity(e.event_type) === 'HIGH'
  ).length;

  return (
    <div className="space-y-6">
      <Header
        title="Live Surveillance Stream"
        subtitle="High-Frequency Edge Telemetry & Real-Time Threat Stream (3s Active Polling)"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Stream Status Control Panel */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              isPolling
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <Radio className={`w-5 h-5 ${isPolling ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 font-mono">
                {isPolling ? 'LIVE FEED ACTIVE — POLLING (3s)' : 'STREAM PAUSED'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                Last sync: {lastUpdated || 'Connecting...'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Monitoring 20 latest edge detections in real time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/70 border border-red-800 text-xs font-mono text-red-300 animate-pulse">
              <Flame className="w-4 h-4 text-red-400" />
              <span>{criticalCount} HIGH/CRITICAL THREATS IN STREAM</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={togglePolling}
          >
            {isPolling ? 'Pause Stream' : 'Resume Stream'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            loading={refreshing}
            onClick={refresh}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Now
          </Button>
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Live Feed Sync Warning"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Live Events Stream */}
      {loading && events.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-surface border border-surface-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="w-12 h-12 text-slate-500 stroke-[1.5]" />}
          title="No Live Events Detected"
          description="Edge cameras are operational. Detections will appear here automatically in real time."
        />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const severity = getEventSeverity(ev.event_type);
            const sevConfig = getSeverityConfig(severity);
            const isNew = newlyDetectedIds.has(ev.id);

            const trackId = ev.metadata?.track_id;
            const className = ev.metadata?.class_name;
            const plateNumber = ev.metadata?.plate_number;
            const position = ev.metadata?.position;

            return (
              <div
                key={ev.id}
                className={`relative bg-surface rounded-xl p-4 transition-all duration-300 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg hover:border-slate-500/60 ${
                  isNew
                    ? 'ring-2 ring-blue-500/80 bg-gradient-to-r from-blue-950/40 via-surface to-surface border-blue-500/80 animate-in fade-in duration-500'
                    : severity === 'CRITICAL'
                    ? 'border-red-600/70 bg-gradient-to-r from-red-950/30 via-surface to-surface'
                    : severity === 'HIGH'
                    ? 'border-rose-600/60 bg-gradient-to-r from-rose-950/20 via-surface to-surface'
                    : 'border-surface-border'
                }`}
              >
                {/* Visual New Detection Ribbon */}
                {isNew && (
                  <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-mono font-bold tracking-wider uppercase shadow-md flex items-center gap-1 animate-pulse">
                    <Sparkles className="w-2.5 h-2.5" />
                    NEW DETECTION
                  </span>
                )}

                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div
                    className={`p-3 rounded-xl shrink-0 border ${
                      severity === 'CRITICAL'
                        ? 'bg-red-950/80 border-red-700 text-red-400 animate-pulse'
                        : severity === 'HIGH'
                        ? 'bg-rose-950/80 border-rose-700 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-blue-400'
                    }`}
                  >
                    {severity === 'CRITICAL' ? (
                      <Flame className="w-5 h-5" />
                    ) : severity === 'HIGH' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Radio className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-200 text-sm">
                        Event #{ev.id}
                      </span>
                      <EventBadge eventType={ev.event_type} />
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                      >
                        {sevConfig.label}
                      </span>
                      <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                        <CameraIcon className="w-3 h-3" />
                        {ev.camera_id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {plateNumber && (
                        <span className="flex items-center gap-1 text-amber-300 font-bold">
                          <Car className="w-3.5 h-3.5" />
                          Plate: {plateNumber}
                        </span>
                      )}

                      {trackId !== undefined && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Target className="w-3.5 h-3.5 text-blue-400" />
                          Track #{trackId} ({className || 'target'})
                        </span>
                      )}

                      {position && (
                        <span>
                          Pos: ({position.x}, {position.y})
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {ev.timestamp.replace('T', ' ').substring(0, 19)} UTC
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 font-mono">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Confidence
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        ev.confidence >= 0.85
                          ? 'text-emerald-400'
                          : ev.confidence >= 0.6
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {(ev.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedEventId(ev.id)}
                    icon={<Eye className="w-3.5 h-3.5" />}
                  >
                    Inspect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Detail Modal for Live Inspector */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
};

export default LiveEvents;
