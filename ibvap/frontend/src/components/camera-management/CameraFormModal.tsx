import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraStatus } from '../../types/camera';

interface CameraFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (camera: Partial<Camera>) => void;
  initialData?: Camera | null;
}

export const CameraFormModal: React.FC<CameraFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [zone, setZone] = useState('Sector North');
  const [resolution, setResolution] = useState('1920x1080');
  const [fps, setFps] = useState<number>(30);
  const [status, setStatus] = useState<CameraStatus>('ONLINE');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setLocation(initialData.location);
      setStreamUrl(initialData.stream_url);
      setZone(initialData.zone);
      setResolution(initialData.resolution);
      setFps(initialData.fps);
      setStatus(initialData.status);
      setAiEnabled(initialData.ai_enabled);
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setLocation('');
      setStreamUrl('');
      setZone('Sector North');
      setResolution('1920x1080');
      setFps(30);
      setStatus('ONLINE');
      setAiEnabled(true);
      setNotes('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !streamUrl) return;
    onSave({
      ...(initialData ? { id: initialData.id } : {}),
      name,
      location,
      stream_url: streamUrl,
      zone,
      resolution,
      fps,
      status,
      ai_enabled: aiEnabled,
      notes,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Camera Stream Configuration (${initialData.id})` : 'Register New IP CCTV / RTSP Stream'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Camera Stream Name</label>
          <input
            type="text"
            placeholder="e.g. Checkpoint Delta Main Gate"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">RTSP / CCTV Stream URL</label>
          <input
            type="text"
            placeholder="rtsp://admin:pass@192.168.10.108:554/live/stream1"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-xs font-mono text-slate-400 mb-1">Location</label>
            <input
              type="text"
              placeholder="e.g. Border Post Alpha-1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="1920x1080">1080p FHD</option>
              <option value="3840x2160">4K UHD</option>
              <option value="1280x720">720p HD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">FPS Limit</label>
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CameraStatus)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="DEGRADED">Degraded</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="aiEnabled"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="rounded border-slate-800 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
          />
          <label htmlFor="aiEnabled" className="text-xs font-mono text-slate-300">
            Enable YOLOv8 & ANPR Computer Vision Analysis Pipeline
          </label>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Camera Notes</label>
          <textarea
            placeholder="Configuration or maintenance notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 h-16"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-mono rounded-lg border border-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs font-mono rounded-lg shadow-md shadow-cyan-500/20"
          >
            {initialData ? 'Update Camera' : 'Register Stream'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
