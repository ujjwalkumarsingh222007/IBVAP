import React from 'react';
import { Clock, Eye, Target } from 'lucide-react';
import { SurveillanceEvent } from '../../types';
import { EventBadge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';

interface EventTableProps {
  events: SurveillanceEvent[];
  loading?: boolean;
  onSelectEvent?: (id: number) => void;
}

export const EventTable: React.FC<EventTableProps> = ({
  events,
  loading = false,
  onSelectEvent,
}) => {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-surface border border-surface-border rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No Surveillance Events Found"
        description="No events match your current filter parameters or no alerts have been reported yet."
      />
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/90 border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 pl-4">ID</th>
              <th className="py-3.5">Category</th>
              <th className="py-3.5">Camera</th>
              <th className="py-3.5">Confidence</th>
              <th className="py-3.5">Track / Class</th>
              <th className="py-3.5">Position (X, Y)</th>
              <th className="py-3.5">Timestamp</th>
              <th className="py-3.5 text-right pr-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/40">
            {events.map((ev) => {
              const trackId = ev.metadata?.track_id;
              const className = ev.metadata?.class_name;
              const position = ev.metadata?.position;

              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelectEvent && onSelectEvent(ev.id)}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                >
                  <td className="py-3.5 pl-4 font-semibold text-slate-300">
                    #{ev.id}
                  </td>
                  <td className="py-3.5">
                    <EventBadge eventType={ev.event_type} />
                  </td>
                  <td className="py-3.5 text-slate-300 font-semibold">
                    {ev.camera_id}
                  </td>
                  <td className="py-3.5">
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
                  <td className="py-3.5 text-slate-300">
                    {trackId !== undefined ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        <Target className="w-3 h-3 text-blue-400" />
                        #{trackId} <span className="text-slate-400">({className || 'object'})</span>
                      </span>
                    ) : (
                      className || '—'
                    )}
                  </td>
                  <td className="py-3.5 text-slate-400">
                    {position ? (
                      <span>
                        X: {position.x}, Y: {position.y}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 text-slate-400">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {ev.timestamp.replace('T', ' ').substring(0, 19)}
                    </span>
                  </td>
                  <td className="py-3.5 text-right pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectEvent) onSelectEvent(ev.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 font-sans text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
