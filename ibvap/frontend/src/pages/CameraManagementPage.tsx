import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { camerasService } from '../services/camerasService';
import { Camera } from '../types/camera';
import { Settings, Plus, Video, Cpu, Server, Wifi } from 'lucide-react';

export const CameraManagementPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [zone, setZone] = useState('Sector North');
  const [resolution, setResolution] = useState('1920x1080');

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

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !streamUrl) return;
    try {
      const newCam = await camerasService.addCamera({
        name,
        location: location || 'Border Station Alpha',
        stream_url: streamUrl,
        zone,
        resolution,
        ai_enabled: true,
      });
      setCameras([...cameras, newCam]);
      setIsAddModalOpen(false);
      setName('');
      setStreamUrl('');
      setLocation('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner label="Loading Camera Management Node..." />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="RTSP / CCTV Camera Stream Management"
        subtitle="Register, configure, and inspect IP video feeds integrated into IBVAP OpenCV & YOLO pipelines"
        icon={<Settings size={22} />}
        action={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20"
          >
            <Plus size={16} />
            <span>Register Camera Stream</span>
          </button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Camera ID / Name</th>
                <th className="py-3 px-4">RTSP Stream URL</th>
                <th className="py-3 px-4">Zone / Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Resolution / FPS</th>
                <th className="py-3 px-4">AI Vision Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {cameras.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-cyan-400">{cam.id}</div>
                    <div className="text-[11px] text-slate-200 font-sans font-semibold">{cam.name}</div>
                  </td>

                  <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                    {cam.stream_url}
                  </td>

                  <td className="py-3 px-4">
                    <div className="text-slate-300 font-sans">{cam.zone}</div>
                    <div className="text-[10px] text-slate-500 font-sans">{cam.location}</div>
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge label={cam.status} variant={cam.status === 'ONLINE' ? 'emerald' : 'red'} />
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {cam.resolution} • {cam.fps} FPS
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] border border-emerald-500/20">
                      <Cpu size={11} /> YOLO + ANPR Enabled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Camera Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New CCTV / RTSP Camera Stream"
      >
        <form onSubmit={handleAddCamera} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Camera Stream Name</label>
            <input
              type="text"
              placeholder="e.g. Sector 9 Perimeter Fence Camera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">RTSP Stream URL</label>
            <input
              type="text"
              placeholder="rtsp://admin:pass@192.168.10.108:554/live/stream1"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Zone Tag</label>
            <input
              type="text"
              placeholder="e.g. Sector North"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Physical Location</label>
            <input
              type="text"
              placeholder="e.g. Watchtower Delta-4"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Stream Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="1920x1080">1920x1080 (1080p FHD)</option>
              <option value="3840x2160">3840x2160 (4K UHD)</option>
              <option value="1280x720">1280x720 (720p HD)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-mono rounded-lg border border-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20"
            >
              Register Camera
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
