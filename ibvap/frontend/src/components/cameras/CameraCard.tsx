import React from 'react';
import { Video, MapPin, Calendar, Edit3, Trash2, Eye, Activity } from 'lucide-react';
import { Camera } from '../../types';
import { CameraStatusBadge } from '../common/Badge';

interface CameraCardProps {
  camera: Camera;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onViewEvents: (camera: Camera) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  onEdit,
  onDelete,
  onViewEvents,
}) => {
  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 hover:border-slate-500/60 font-mono">
      <div>
        {/* Header with Camera ID & Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-blue-400 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase truncate">
                  {camera.camera_id}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 uppercase">
                  Event Monitoring
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mt-0.5 truncate">{camera.name}</h3>
            </div>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        {/* Location & Details */}
        <div className="space-y-2 mt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{camera.location || 'Location unassigned'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Registered: {camera.created_at ? camera.created_at.substring(0, 10) : '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-400">
            <Activity className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="text-[11px]">Mode: Event & Telemetry Ingestion</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-surface-border/60">
        <button
          onClick={() => onViewEvents(camera)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 hover:text-white border border-blue-800/80 text-xs font-semibold transition-colors"
          title="Inspect Telemetry Events for this Camera"
        >
          <Eye className="w-3.5 h-3.5" />
          View Events
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(camera)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Edit Camera"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(camera)}
            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 border border-red-900/60 transition-colors"
            title="Delete Camera"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraCard;
