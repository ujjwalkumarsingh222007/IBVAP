import React from 'react';
import {
  Clock,
  Eye,
  Camera as CameraIcon,
} from 'lucide-react';
import { SurveillanceEvent } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { alertRules } from '../../utils/alertRules';

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
            className="h-12 bg-surface border border-surface-border rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No Events Found"
        description="No events match your current filter parameters or no activity has been recorded yet."
      />
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-lg font-mono">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 pl-4">Time</th>
              <th className="py-3.5">Camera</th>
              <th className="py-3.5">Detection</th>
              <th className="py-3.5">Identity</th>
              <th className="py-3.5">Status</th>
              <th className="py-3.5 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/40">
            {events.map((ev) => {
              const cls = alertRules.classify(ev);
              const timeFormatted = ev.timestamp
                ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '--:--:--';

              let badgeClasses = 'bg-slate-900 text-slate-300 border-slate-700';
              if (cls.badgeType === 'known' || cls.statusLabel === 'Registered') {
                badgeClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
              } else if (cls.badgeType === 'flagged' || cls.badgeType === 'watchlist') {
                badgeClasses = 'bg-red-950 text-red-300 border-red-800';
              } else if (cls.badgeType === 'alert') {
                badgeClasses = 'bg-amber-950/80 text-amber-300 border-amber-800';
              }

              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelectEvent && onSelectEvent(ev.id)}
                  className={`hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                    cls.isAlert ? 'bg-red-950/10' : ''
                  }`}
                >
                  {/* Time */}
                  <td className="py-3.5 pl-4 text-slate-400">
                    <span className="flex items-center gap-1.5 font-sans">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {timeFormatted}
                    </span>
                  </td>

                  {/* Camera */}
                  <td className="py-3.5 text-slate-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
                      {ev.camera_id}
                    </span>
                  </td>

                  {/* Detection */}
                  <td className="py-3.5 text-slate-200 font-bold">
                    {cls.detectionType}
                  </td>

                  {/* Identity */}
                  <td className="py-3.5 text-slate-300">
                    <span className={cls.identity === 'Unknown' ? 'text-red-400 font-semibold' : ''}>
                      {cls.identity}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${badgeClasses}`}
                    >
                      {cls.statusLabel}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 text-right pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectEvent) onSelectEvent(ev.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 font-sans text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
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

export default EventTable;
