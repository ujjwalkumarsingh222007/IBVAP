import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert, Clock, Eye } from 'lucide-react';
import { SurveillanceEvent } from '../../types';
import { EventBadge } from '../common/Badge';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { EventDetailModal } from '../events/EventDetailModal';
import { getEventSeverity, getSeverityConfig } from '../../utils/severity';

interface RecentEventsTableProps {
  events: SurveillanceEvent[];
  loading?: boolean;
  newlyDetectedIds?: Set<number>;
}

export const RecentEventsTable: React.FC<RecentEventsTableProps> = ({
  events,
  loading = false,
  newlyDetectedIds = new Set(),
}) => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  return (
    <Card
      title="Recent Surveillance Activity"
      subtitle="Real-time live feed of incoming edge detections (auto-refreshed)"
      icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
      action={
        <Link
          to="/events"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors font-mono"
        >
          View all events
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      {loading && events.length === 0 ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-slate-900/60 rounded-lg animate-pulse border border-surface-border/40"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No Recent Surveillance Activity"
          description="Edge cameras have not reported any active detections yet."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="pb-3 pl-2">Event ID</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Severity</th>
                <th className="pb-3">Camera</th>
                <th className="pb-3">Confidence</th>
                <th className="pb-3">Metadata Preview</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40">
              {events.map((ev) => {
                const trackId = ev.metadata?.track_id;
                const className = ev.metadata?.class_name;
                const plateNumber = ev.metadata?.plate_number;
                const isNew = newlyDetectedIds.has(ev.id);
                const severity = getEventSeverity(ev.event_type);
                const sevConfig = getSeverityConfig(severity);

                return (
                  <tr
                    key={ev.id}
                    className={`transition-all duration-300 group ${
                      isNew
                        ? 'bg-blue-950/40 ring-1 ring-blue-500/50 animate-pulse'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 pl-2 font-semibold text-slate-300">
                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}
                        <span>#{ev.id}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <EventBadge eventType={ev.event_type} />
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                      >
                        {sevConfig.label}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300 font-semibold">
                      {ev.camera_id}
                    </td>
                    <td className="py-3 text-slate-300">
                      <span
                        className={`font-semibold ${
                          ev.confidence >= 0.85
                            ? 'text-emerald-400'
                            : ev.confidence >= 0.6
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {(ev.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {plateNumber ? (
                        <span className="text-amber-300 font-bold tracking-wider">
                          {plateNumber}
                        </span>
                      ) : trackId !== undefined ? (
                        <span className="text-slate-200">
                          #{trackId} <span className="text-slate-400">({className || 'target'})</span>
                        </span>
                      ) : (
                        className || '—'
                      )}
                    </td>
                    <td className="py-3 text-slate-400">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {ev.timestamp.replace('T', ' ').substring(0, 19)}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      <button
                        onClick={() => setSelectedEventId(ev.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 font-mono text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Direct Modal Telemetry Inspection */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </Card>
  );
};

export default RecentEventsTable;
