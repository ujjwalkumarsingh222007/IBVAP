import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Camera as CameraIcon,
  Eye,
  Filter,
  RefreshCw,
  Car,
  User,
} from 'lucide-react';
import { SurveillanceEvent, EventType, EventFilters } from '../../types';
import { eventsApi, cameraApi, formatApiError } from '../../api';
import { EventBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { Card } from '../common/Card';
import { EventDetailModal } from './EventDetailModal';
import { getEventSeverity, getSeverityConfig } from '../../utils/severity';

interface EventTimelineProps {
  initialLimit?: number;
  autoPoll?: boolean;
}

const EVENT_TYPE_OPTIONS: { label: string; value: EventType }[] = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Watchlist Match', value: 'WATCHLIST_MATCH' },
  { label: 'Intrusions', value: 'INTRUSION_DETECTED' },
  { label: 'Suspicious', value: 'SUSPICIOUS_ACTIVITY' },
  { label: 'ANPR Reads', value: 'ANPR_DETECTED' },
  { label: 'Vehicles', value: 'VEHICLE_DETECTED' },
  { label: 'Persons', value: 'PERSON_DETECTED' },
];

export const EventTimeline: React.FC<EventTimelineProps> = ({
  initialLimit = 25,
  autoPoll = true,
}) => {
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<EventType>('ALL');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [cameraList, setCameraList] = useState<string[]>([]);

  // Load cameras for dropdown
  useEffect(() => {
    cameraApi
      .getCameras()
      .then((cams) => setCameraList(cams.map((c) => c.camera_id)))
      .catch(() => {});
  }, []);

  const fetchTimelineEvents = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    const filters: EventFilters = {
      limit: initialLimit,
      offset: 0,
    };

    if (selectedType && selectedType !== 'ALL') {
      filters.event_type = selectedType;
    }
    if (selectedCamera.trim()) {
      filters.camera_id = selectedCamera.trim();
    }
    if (minConfidence > 0) {
      filters.confidence_min = minConfidence;
    }

    try {
      const data = await eventsApi.getEvents(filters);
      // Newest event at top
      data.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA || b.id - a.id;
      });
      setEvents(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, selectedCamera, minConfidence, initialLimit]);

  useEffect(() => {
    fetchTimelineEvents();

    if (!autoPoll) return;
    const interval = setInterval(() => {
      fetchTimelineEvents();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchTimelineEvents, autoPoll]);

  const handleResetFilters = () => {
    setSelectedType('ALL');
    setSelectedCamera('');
    setMinConfidence(0);
  };

  const hasActiveFilters = selectedType !== 'ALL' || selectedCamera !== '' || minConfidence > 0;

  return (
    <Card
      title="Surveillance Chronological Timeline"
      subtitle="Real-time chronological stream of multi-camera detections with dynamic telemetry filters"
      icon={<Clock className="w-5 h-5 text-blue-400" />}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={refreshing}
            onClick={() => fetchTimelineEvents(true)}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Timeline
          </Button>
        </div>
      }
    >
      {/* Interactive Filter Toolbar */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold">Filters:</span>
          </div>

          {/* Event Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as EventType)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Camera Selector */}
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Cameras</option>
            {cameraList.map((cam) => (
              <option key={cam} value={cam}>
                {cam}
              </option>
            ))}
          </select>

          {/* Min Confidence */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Min Conf:</span>
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="0">0% (Any)</option>
              <option value="0.5">50%+</option>
              <option value="0.75">75%+</option>
              <option value="0.85">85%+</option>
              <option value="0.9">90%+</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="text-blue-400 hover:text-blue-300 underline text-xs"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs font-mono text-red-300 mb-4">
          {error}
        </div>
      )}

      {/* Timeline Stream */}
      {loading && events.length === 0 ? (
        <div className="space-y-4 py-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No Events on Timeline"
          description={
            hasActiveFilters
              ? 'No surveillance detections match your selected filter criteria.'
              : 'Waiting for edge surveillance telemetry streams.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filter Parameters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 space-y-4">
          {events.map((ev, index) => {
            const severity = getEventSeverity(ev.event_type);
            const sevConfig = getSeverityConfig(severity);
            const isWatchlist = ev.event_type === 'WATCHLIST_MATCH';
            const isIntrusion = ev.event_type === 'INTRUSION_DETECTED';

            return (
              <div
                key={ev.id}
                className={`relative group bg-slate-900/60 rounded-xl p-4 border transition-all duration-200 hover:border-slate-500 shadow-sm ${
                  isWatchlist
                    ? 'border-red-600/70 bg-gradient-to-r from-red-950/30 to-slate-900/60'
                    : isIntrusion
                    ? 'border-rose-600/60 bg-gradient-to-r from-rose-950/20 to-slate-900/60'
                    : 'border-slate-800 hover:bg-slate-900/90'
                }`}
              >
                {/* Timeline node marker */}
                <span
                  className={`absolute -left-6 sm:-left-8 top-5 w-3 h-3 rounded-full border-2 border-surface ${
                    severity === 'CRITICAL'
                      ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                      : severity === 'HIGH'
                      ? 'bg-rose-500'
                      : severity === 'MEDIUM'
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                  {/* Left Column: Identification & Type */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Event #{ev.id}
                      </span>
                      <EventBadge eventType={ev.event_type} />
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                      >
                        {sevConfig.label}
                      </span>
                      {index === 0 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold tracking-wider uppercase">
                          LATEST
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <strong>{ev.camera_id}</strong>
                      </span>

                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(ev.timestamp).toLocaleTimeString()} ({new Date(ev.timestamp).toLocaleDateString()})
                      </span>

                      {ev.metadata?.plate_number && (
                        <span className="flex items-center gap-1 text-amber-300 font-bold">
                          <Car className="w-3.5 h-3.5" />
                          {ev.metadata.plate_number}
                        </span>
                      )}

                      {ev.metadata?.track_id !== undefined && (
                        <span className="flex items-center gap-1 text-purple-300">
                          <User className="w-3.5 h-3.5" />
                          Track #{ev.metadata.track_id}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Confidence & Inspect Modal Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
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
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Inspector */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </Card>
  );
};

export default EventTimeline;
