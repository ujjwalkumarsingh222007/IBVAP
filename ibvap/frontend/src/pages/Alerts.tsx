import React, { useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  Search,
  Eye,
  Camera as CameraIcon,
  Clock,
  Car,
  UserCheck,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { eventsApi, formatApiError } from '../api';
import { SurveillanceEvent } from '../types';
import { usePolling } from '../hooks';
import {
  getEventSeverity,
  getSeverityConfig,
  getSeverityWeight,
  SeverityLevel,
} from '../utils/severity';

type AlertFilterTab = 'ALL' | SeverityLevel | 'WATCHLIST_MATCH' | 'INTRUSION_DETECTED' | 'SUSPICIOUS_ACTIVITY';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AlertFilterTab>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchAlerts = useCallback(async () => {
    try {
      // Fetch recent threat events using backend filter limit
      const [intrusions, watchlists, suspicious, vehicles] = await Promise.all([
        eventsApi.getEvents({ event_type: 'INTRUSION_DETECTED', limit: 25 }),
        eventsApi.getEvents({ event_type: 'WATCHLIST_MATCH', limit: 25 }),
        eventsApi.getEvents({ event_type: 'SUSPICIOUS_ACTIVITY', limit: 25 }),
        eventsApi.getEvents({ event_type: 'VEHICLE_DETECTED', limit: 15 }),
      ]);

      const map = new Map<number, SurveillanceEvent>();
      [...watchlists, ...intrusions, ...suspicious, ...vehicles].forEach((ev) => {
        map.set(ev.id, ev);
      });

      // Sort by severity weight first, then timestamp descending
      const combined = Array.from(map.values()).sort((a, b) => {
        const weightA = getSeverityWeight(getEventSeverity(a.event_type));
        const weightB = getSeverityWeight(getEventSeverity(b.event_type));
        if (weightB !== weightA) return weightB - weightA;

        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA || b.id - a.id;
      });

      setAlerts(combined);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, lastUpdated, refresh } = usePolling(
    fetchAlerts,
    {
      intervalMs: 3500,
      enabled: true,
      pauseWhenHidden: true,
      immediate: true,
    }
  );

  // Filtered list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((ev) => {
      const severity = getEventSeverity(ev.event_type);

      if (activeTab !== 'ALL') {
        if (activeTab === 'CRITICAL' && severity !== 'CRITICAL') return false;
        if (activeTab === 'HIGH' && severity !== 'HIGH') return false;
        if (activeTab === 'MEDIUM' && severity !== 'MEDIUM') return false;
        if (activeTab === 'LOW' && severity !== 'LOW') return false;
        if (
          (activeTab === 'WATCHLIST_MATCH' ||
            activeTab === 'INTRUSION_DETECTED' ||
            activeTab === 'SUSPICIOUS_ACTIVITY') &&
          ev.event_type !== activeTab
        ) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCam = ev.camera_id.toLowerCase().includes(q);
        const matchPlate = ev.metadata?.plate_number?.toLowerCase().includes(q);
        const matchReason = ev.metadata?.watchlist_reason?.toLowerCase().includes(q);
        const matchClass = ev.metadata?.class_name?.toLowerCase().includes(q);
        const matchType = ev.event_type.toLowerCase().includes(q);
        if (!matchCam && !matchPlate && !matchReason && !matchClass && !matchType) return false;
      }
      return true;
    });
  }, [alerts, activeTab, searchTerm]);

  // Counts by severity
  const criticalCount = alerts.filter((a) => getEventSeverity(a.event_type) === 'CRITICAL').length;
  const highCount = alerts.filter((a) => getEventSeverity(a.event_type) === 'HIGH').length;
  const mediumCount = alerts.filter((a) => getEventSeverity(a.event_type) === 'MEDIUM').length;

  return (
    <div className="space-y-6">
      <Header
        title="Threat Alert Command Matrix"
        subtitle="Priority Surveillance Alerts Categorized by Operational Severity (CRITICAL / HIGH / MEDIUM / LOW)"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Severity Level Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-red-800/80 rounded-xl p-4 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <p className="text-xs text-red-400 font-mono font-bold uppercase">CRITICAL SEVERITY</p>
            </div>
            <p className="text-2xl font-bold font-mono text-white mt-1">{criticalCount}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Watchlist hits / wanted targets</p>
          </div>
          <div className="p-3 bg-red-950/90 border border-red-700 rounded-xl text-red-400 relative z-10">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-surface border border-rose-800/70 rounded-xl p-4 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-950/30 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-rose-400 font-mono font-bold uppercase">HIGH THREATS</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">{highCount}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Perimeter intrusions & suspicious</p>
          </div>
          <div className="p-3 bg-rose-950/90 border border-rose-700 rounded-xl text-rose-400 relative z-10">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-amber-800/60 rounded-xl p-4 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-amber-400 font-mono font-bold uppercase">MEDIUM THREATS</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">{mediumCount}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Vehicles & tracking anomalies</p>
          </div>
          <div className="p-3 bg-amber-950/90 border border-amber-700 rounded-xl text-amber-400 relative z-10">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono font-semibold uppercase">Total Buffer</p>
            <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{alerts.length}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Last sync: {lastUpdated || 'Connecting'}</p>
          </div>
          <div className="p-3 bg-cyan-950/80 border border-cyan-800 rounded-xl text-cyan-400">
            <Car className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Severity Filter Tabs and Search Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === 'ALL' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('ALL')}
          >
            All Alerts ({alerts.length})
          </Button>

          <Button
            variant={activeTab === 'CRITICAL' ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('CRITICAL')}
          >
            🚨 Critical ({criticalCount})
          </Button>

          <Button
            variant={activeTab === 'HIGH' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('HIGH')}
          >
            ⚠️ High ({highCount})
          </Button>

          <Button
            variant={activeTab === 'MEDIUM' ? 'outline' : 'outline'}
            size="sm"
            className={activeTab === 'MEDIUM' ? 'bg-amber-950/80 text-amber-300 border-amber-700 font-bold' : ''}
            onClick={() => setActiveTab('MEDIUM')}
          >
            Medium ({mediumCount})
          </Button>

          <Button
            variant={activeTab === 'WATCHLIST_MATCH' ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('WATCHLIST_MATCH')}
          >
            Watchlist
          </Button>

          <Button
            variant={activeTab === 'INTRUSION_DETECTED' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('INTRUSION_DETECTED')}
          >
            Intrusions
          </Button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search camera, plate, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/90 border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Threat Buffer Sync Error"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Alerts Grid */}
      {loading && alerts.length === 0 ? (
        <CardSkeleton count={4} />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          title="No Active Threat Alerts"
          description="Perimeter security zones and checkpoints report all clear for the selected severity level."
          action={
            <Button variant="outline" size="sm" onClick={refresh}>
              Refresh Threats
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map((alert) => {
            const severity = getEventSeverity(alert.event_type);
            const sevConfig = getSeverityConfig(severity);
            const isCritical = severity === 'CRITICAL';
            const isHigh = severity === 'HIGH';

            return (
              <div
                key={alert.id}
                className={`bg-surface border rounded-xl p-5 shadow-lg relative overflow-hidden transition-all duration-200 hover:border-slate-400 flex flex-col justify-between ${
                  isCritical
                    ? 'border-red-600/80 bg-red-950/20'
                    : isHigh
                    ? 'border-rose-700/70 bg-rose-950/15'
                    : 'border-surface-border bg-slate-900/60'
                }`}
              >
                {/* Severity indicator top border glow */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isCritical
                      ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                      : isHigh
                      ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                      : 'bg-amber-500'
                  }`}
                />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                      >
                        {sevConfig.label}
                      </span>
                      <Badge variant={alert.event_type} pulse={isCritical} />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                      ID #{alert.id}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CameraIcon className="w-3.5 h-3.5 text-cyan-400" /> Origin Camera:
                      </span>
                      <span className="font-bold text-slate-100">{alert.camera_id}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" /> Timestamp:
                      </span>
                      <span className="text-slate-200">
                        {new Date(alert.timestamp).toLocaleTimeString()} ({new Date(alert.timestamp).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Confidence:</span>
                      <span
                        className={`font-bold ${
                          alert.confidence >= 0.85
                            ? 'text-emerald-400'
                            : alert.confidence >= 0.6
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {(alert.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    {/* Contextual Plate or Threat Info */}
                    {alert.metadata?.plate_number && (
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase">License Plate</span>
                          <span className="font-bold text-yellow-300 text-sm tracking-wider">
                            {alert.metadata.plate_number}
                          </span>
                        </div>
                        {alert.metadata?.watchlist_reason && (
                          <p className="text-[10px] text-red-300 mt-1 font-semibold">
                            ⚠️ {alert.metadata.watchlist_reason}
                          </p>
                        )}
                      </div>
                    )}

                    {alert.metadata?.track_id !== undefined && (
                      <div className="flex items-center justify-between text-slate-300 pt-1">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-purple-400" /> Track Target:
                        </span>
                        <span className="text-purple-300 font-bold">
                          #{alert.metadata.track_id} ({alert.metadata.class_name || 'person'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setSelectedEventId(alert.id)}
                  >
                    Inspect Telemetry
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Telemetry Inspection Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
};

export default Alerts;
