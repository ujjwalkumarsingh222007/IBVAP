import React from 'react';
import { Event } from '../../types/event';
import { formatTimestamp, formatConfidence, getEventTypeBadge } from '../../utils/formatters';
import { Activity, ShieldAlert, Eye } from 'lucide-react';

interface RecentEventsListProps {
  events: Event[];
  onSelectEvent?: (event: Event) => void;
}

export const RecentEventsList: React.FC<RecentEventsListProps> = ({ events, onSelectEvent }) => {
  return (
    <div className="divide-y divide-slate-800/80">
      {events.map((evt) => {
        const badge = getEventTypeBadge(evt.event_type);
        return (
          <div
            key={evt.id || `${evt.camera_id}-${evt.timestamp}`}
            onClick={() => onSelectEvent?.(evt)}
            className="py-3 px-1 flex items-center justify-between hover:bg-slate-800/30 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                {evt.event_type === 'WATCHLIST_MATCH' ? (
                  <ShieldAlert size={16} className="text-red-400" />
                ) : (
                  <Activity size={16} className="text-cyan-400" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {evt.event_type}
                  </span>
                  <span className="text-xs font-mono text-cyan-400 font-semibold">{evt.camera_id}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {evt.metadata?.license_plate
                    ? `Plate Match: ${evt.metadata.license_plate}`
                    : evt.metadata?.details
                    ? String(evt.metadata.details)
                    : `Detection triggered on camera feed ${evt.camera_id}`}
                </p>
              </div>
            </div>

            <div className="text-right flex items-center gap-3">
              <div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {formatConfidence(evt.confidence)}
                </div>
                <div className="text-[10px] text-slate-400">{formatTimestamp(evt.timestamp)}</div>
              </div>
              <button
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="View JSON metadata"
              >
                <Eye size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
