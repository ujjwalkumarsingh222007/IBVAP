import React from 'react';
import { Camera } from '../../types/camera';
import { getCameraStatusBadge } from '../../utils/formatters';
import { Video, Maximize2, Cpu } from 'lucide-react';

interface CameraStatusGridProps {
  cameras: Camera[];
  onSelectCamera?: (camera: Camera) => void;
}

export const CameraStatusGrid: React.FC<CameraStatusGridProps> = ({ cameras, onSelectCamera }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cameras.slice(0, 4).map((cam) => {
        const badge = getCameraStatusBadge(cam.status);
        return (
          <div
            key={cam.id}
            onClick={() => onSelectCamera?.(cam)}
            className="group relative bg-[#0d121d] border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all duration-200 cursor-pointer"
          >
            {/* Stream Mockup Box */}
            <div className="relative aspect-video bg-black/60 flex items-center justify-center border-b border-slate-800 overflow-hidden">
              {/* Grid Lines Pattern for Tactical Surveillance feel */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:16px_16px]" />

              {/* Status Header Overlay */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[10px] font-mono text-cyan-400 border border-slate-800">
                  <Video size={12} />
                  <span>{cam.id}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${badge.bg}`}>
                  {cam.status}
                </span>
              </div>

              {/* Tactical Camera Feed Graphics */}
              <div className="text-center p-4">
                <div className="inline-flex p-3 rounded-full bg-slate-900/80 border border-slate-800 text-slate-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all">
                  <Video size={24} />
                </div>
                <p className="text-xs font-mono text-slate-400 mt-2">{cam.resolution} • {cam.fps} FPS</p>
              </div>

              {/* Bounding Box Mock Overlay for AI demonstration */}
              {cam.status === 'ONLINE' && cam.ai_enabled && (
                <div className="absolute inset-x-8 inset-y-6 border border-cyan-500/40 rounded pointer-events-none flex items-start justify-start p-1">
                  <span className="text-[9px] font-mono bg-cyan-500 text-black font-bold px-1 rounded">
                    AI TARGET LOCKED 0.96
                  </span>
                </div>
              )}

              {/* Hover Fullscreen overlay icon */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="px-3 py-1.5 bg-cyan-500 text-black text-xs font-semibold rounded-lg shadow-lg flex items-center gap-1.5">
                  <Maximize2 size={14} /> Open Live Feed
                </span>
              </div>
            </div>

            {/* Camera Details Bottom */}
            <div className="p-3 bg-[#121824] flex items-center justify-between text-xs">
              <div>
                <h4 className="font-semibold text-slate-200 line-clamp-1">{cam.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{cam.location}</p>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Cpu size={11} />
                <span>YOLOv8 + ANPR</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
