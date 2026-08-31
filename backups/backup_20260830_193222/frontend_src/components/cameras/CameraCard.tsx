import React, { useState } from 'react';
import { Video, User, Car, Edit3, Trash2, Radio, MoreVertical } from 'lucide-react';
import { Camera } from '../../types';

interface CameraCardProps {
  camera: Camera;
  isAdmin?: boolean;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onLive: (camera: Camera) => void;
  personCount?: number;
  vehicleCount?: number;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  isAdmin = true,
  onEdit,
  onDelete,
  onLive,
  personCount = 0,
  vehicleCount = 0,
}) => {
  const isOnline = camera.status === 'ONLINE';
  const [isRunning, setIsRunning] = useState<boolean>(isOnline);
  const [showMenu, setShowMenu] = useState<boolean>(false);

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-md flex flex-col justify-between transition-all duration-200 hover:border-slate-500/60 font-mono relative">
      <div>
        {/* Header: Name & Status */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-surface-border/60">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate">{camera.name}</h3>
            <span className="text-[10px] text-slate-400 block truncate">
              {camera.location || camera.camera_id}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {isOnline ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Live Preview Box */}
        <div
          onClick={() => onLive(camera)}
          className="my-3 h-32 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
        >
          <div className="text-center space-y-1">
            <div className="p-2.5 rounded-full bg-slate-900/80 border border-slate-800 inline-block text-slate-400 group-hover:text-white transition-colors">
              <Video className="w-5 h-5" />
            </div>
            <span className="text-[11px] text-slate-400 block font-medium">
              LIVE CAMERA
            </span>
          </div>

          <div className="absolute inset-0 bg-blue-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shadow">
              Open Feed
            </span>
          </div>
        </div>

        {/* Detection counts & AI Status */}
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>{personCount} Person{personCount !== 1 ? 's' : ''}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>{vehicleCount} Vehicle{vehicleCount !== 1 ? 's' : ''}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
            <Radio className={`w-3 h-3 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <span>AI Status: <strong className={isRunning ? 'text-emerald-400' : 'text-slate-500'}>{isRunning ? 'ANALYZING' : 'PAUSED'}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Buttons: [Open] [Stop] [•••] */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-surface-border/60">
        <button
          onClick={() => onLive(camera)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors text-center"
        >
          Open
        </button>

        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            isRunning
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border-emerald-800'
          }`}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>

        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(camera);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(camera);
                  }}
                  className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraCard;
