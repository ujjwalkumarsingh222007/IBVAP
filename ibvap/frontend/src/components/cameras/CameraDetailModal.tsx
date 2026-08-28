import React from 'react';
import { Modal } from '../common/Modal';
import { Camera } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { Video, Cpu, MapPin, Activity, Radio, Lock } from 'lucide-react';

interface CameraDetailModalProps {
  camera: Camera | null;
  onClose: () => void;
}

export const CameraDetailModal: React.FC<CameraDetailModalProps> = ({ camera, onClose }) => {
  if (!camera) return null;

  return (
    <Modal
      isOpen={!!camera}
      onClose={onClose}
      title={`Live Stream Inspector — ${camera.name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Stream Simulation Screen */}
        <div className="relative aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d25_1px,transparent_1px),linear-gradient(to_bottom,#1f293d25_1px,transparent_1px)] bg-[size:16px_16px]" />

          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span className="px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[11px] font-mono text-cyan-400 border border-slate-800 font-bold">
              {camera.id}
            </span>
            <StatusBadge label={camera.status} variant={camera.status === 'ONLINE' ? 'emerald' : 'red'} pulse={camera.status === 'ONLINE'} />
          </div>

          <div className="text-center p-6 z-10">
            <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/30 inline-flex mb-2">
              <Video size={32} />
            </div>
            <h4 className="text-sm font-bold text-slate-200">{camera.name}</h4>
            <p className="text-xs font-mono text-slate-400 mt-1">{camera.resolution} @ {camera.fps} FPS</p>
          </div>

          {/* AI Bounding Box Graphic Simulation */}
          {camera.ai_enabled && camera.status === 'ONLINE' && (
            <div className="absolute inset-10 border-2 border-cyan-400/60 rounded flex items-start justify-start p-1.5 bg-cyan-500/5">
              <span className="text-[10px] font-mono bg-cyan-500 text-black font-bold px-1.5 py-0.5 rounded">
                TARGET LOCKED [YOLOv8 + ANPR]
              </span>
            </div>
          )}
        </div>

        {/* Stream Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <MapPin size={12} /> Location
            </div>
            <div className="text-slate-200 font-bold truncate">{camera.location}</div>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Radio size={12} /> Zone
            </div>
            <div className="text-cyan-400 font-bold truncate">{camera.zone}</div>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
              <Activity size={12} /> Today Hits
            </div>
            <div className="text-emerald-400 font-bold">{camera.detection_count_today || 0} Detections</div>
          </div>
        </div>

        {/* RTSP Stream URL Configuration info (credentials masked) */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Lock size={12} /> Configured Stream Source URL:
          </div>
          <div className="text-cyan-300 text-[11px] truncate">
            {camera.stream_url.replace(/:[^:@]+@/, ':****@')}
          </div>
        </div>

        {camera.notes && (
          <p className="text-xs text-slate-400 italic bg-slate-900/50 p-2.5 rounded border border-slate-800">
            "{camera.notes}"
          </p>
        )}
      </div>
    </Modal>
  );
};
