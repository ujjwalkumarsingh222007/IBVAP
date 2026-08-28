import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { StatusBadge } from '../components/common/StatusBadge';
import { CameraDetailModal } from '../components/cameras/CameraDetailModal';

import { camerasService } from '../services/camerasService';
import { Camera } from '../types/camera';
import { Video, Maximize2, Cpu, Activity, MapPin } from 'lucide-react';

export const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [activeCameraModal, setActiveCameraModal] = useState<Camera | null>(null);

  useEffect(() => {
    async function loadCameras() {
      setLoading(true);
      try {
        const data = await camerasService.getCameras();
        setCameras(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCameras();
  }, []);

  const filteredCameras = selectedZone === 'ALL'
    ? cameras
    : cameras.filter(c => c.zone.toLowerCase().includes(selectedZone.toLowerCase()));

  if (loading) return <SkeletonLoader type="video" count={4} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Live Camera Wall & Video Streams"
        subtitle="Multi-channel CCTV/RTSP stream monitoring with automated YOLO & ANPR detection layer"
        icon={<Video size={22} />}
        action={
          <div className="flex items-center gap-2">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Sectors & Zones</option>
              <option value="North">Sector North</option>
              <option value="South">Sector South</option>
              <option value="Inspection">Inspection Hub</option>
              <option value="East">Sector East</option>
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCameras.map((cam) => (
          <Card key={cam.id} className="p-0 overflow-hidden group">
            {/* Stream Player Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center border-b border-slate-800">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d20_1px,transparent_1px),linear-gradient(to_bottom,#1f293d20_1px,transparent_1px)] bg-[size:20px_20px]" />

              <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                <span className="px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[10px] font-mono text-cyan-400 border border-slate-800 font-bold">
                  {cam.id}
                </span>
                <StatusBadge label={cam.status} variant={cam.status === 'ONLINE' ? 'emerald' : 'red'} pulse={cam.status === 'ONLINE'} />
              </div>

              {/* Stream Content Preview Simulation */}
              <div className="text-center p-6">
                <div className="p-3 bg-slate-900/90 rounded-full border border-slate-800 text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 inline-flex transition-all">
                  <Video size={28} />
                </div>
                <p className="text-xs font-mono text-slate-400 mt-2">{cam.resolution} • {cam.fps} FPS</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-xs truncate">{cam.location}</p>
              </div>

              {/* Tactical AI Overlay Bounding Box */}
              {cam.ai_enabled && cam.status === 'ONLINE' && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-cyan-950/90 border border-cyan-500/40 rounded text-[10px] font-mono text-cyan-300">
                  <Cpu size={12} />
                  <span>YOLOv8 Active</span>
                </div>
              )}

              {/* Open Stream Inspector Modal Action */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                <button
                  onClick={() => setActiveCameraModal(cam)}
                  className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition-transform scale-95 group-hover:scale-100 font-mono"
                >
                  <Maximize2 size={14} /> Open Stream Inspector
                </button>
              </div>
            </div>

            {/* Stream Info Footer */}
            <div className="p-4 bg-[#121824] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">{cam.name}</h3>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                  {cam.zone}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1 text-[11px]">
                  <Activity size={12} className="text-emerald-400" /> Hits: <strong className="text-slate-200">{cam.detection_count_today || 0}</strong>
                </span>
                <span className="text-[10px] text-slate-500">
                  {cam.last_detection_time ? new Date(cam.last_detection_time).toLocaleTimeString() : 'No recent hits'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Stream Inspector Modal */}
      {activeCameraModal && (
        <CameraDetailModal
          camera={activeCameraModal}
          onClose={() => setActiveCameraModal(null)}
        />
      )}
    </div>
  );
};
