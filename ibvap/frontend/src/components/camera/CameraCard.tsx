import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cctv, Users, Car, Eye, MoreVertical, Trash2, Radio } from 'lucide-react';
import { Camera } from '../../types';

interface CameraCardProps {
  camera: Camera;
  peopleCount?: number;
  vehicleCount?: number;
  onDelete?: (cameraId: string) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  peopleCount = 0,
  vehicleCount = 0,
  onDelete,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const isOnline = camera.status === 'ONLINE';

  return (
    <div className="bg-surface border border-surface-border hover:border-tactical-blue rounded-lg p-3.5 transition-all shadow-tactical flex flex-col justify-between font-mono">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
              <Cctv className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 truncate max-w-[170px]">
                {camera.name}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-tactical-slate mt-0.5">
                <span className="font-bold text-tactical-blue">{camera.camera_id}</span>
                {camera.location && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[110px]">{camera.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors border border-surface-border"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-7 w-28 bg-surface-card border border-surface-border rounded shadow-xl py-1 z-20 text-[11px]">
                {onDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(camera.camera_id);
                    }}
                    className="w-full px-2.5 py-1 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Viewport Canvas Simulation */}
        <div className="relative aspect-video rounded bg-black border border-surface-border overflow-hidden flex items-center justify-center mb-3 tactical-reticle">
          <div className="text-center p-3 text-tactical-slate space-y-1">
            <Radio className={`w-5 h-5 mx-auto ${isOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <div className="text-[10px] uppercase font-bold tracking-wider">
              {isOnline ? 'FEED ONLINE · 1080p' : 'DISCONNECTED'}
            </div>
          </div>

          <div className="absolute top-2 left-2 z-10 bg-black/80 px-2 py-0.5 rounded border border-surface-border text-[9px] flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-slate-300 font-bold">{camera.status}</span>
          </div>
        </div>

        {/* Telemetry Counts */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface-subtle border border-surface-border">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-slate-200">{peopleCount}</span>
            <span className="text-[10px] text-tactical-slate">Persons</span>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface-subtle border border-surface-border">
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-slate-200">{vehicleCount}</span>
            <span className="text-[10px] text-tactical-slate">Vehicles</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => navigate(`/cameras/${camera.camera_id}`)}
        className="w-full py-1.5 px-3 rounded bg-surface-elevated hover:bg-tactical-blue text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-surface-border cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5" />
        MONITOR FEED
      </button>
    </div>
  );
};
