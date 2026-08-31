import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Cctv, RefreshCw, X, AlertCircle, LayoutGrid, Grid2X2, Square } from 'lucide-react';
import { cameraApi } from '../api/cameraApi';
import { Camera, CameraCreatePayload } from '../types';
import { CameraCard } from '../components/camera/CameraCard';

export const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [gridCols, setGridCols] = useState<1 | 2 | 3 | 4>(3);

  // Form states
  const [name, setName] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cameraApi.getCameras();
      setCameras(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cameraId.trim()) {
      setFormError('Camera Name and Camera ID are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: CameraCreatePayload = {
        camera_id: cameraId.trim().toUpperCase(),
        name: name.trim(),
        location: location.trim() || undefined,
        status: 'ONLINE',
      };
      await cameraApi.createCamera(payload);
      setIsAddModalOpen(false);
      setName('');
      setCameraId('');
      setLocation('');
      fetchCameras();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add camera');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCamera = async (cId: string) => {
    if (!window.confirm(`Are you sure you want to decommission camera node '${cId}'?`)) return;
    try {
      await cameraApi.deleteCamera(cId);
      fetchCameras();
    } catch (err: any) {
      alert(err.message || 'Failed to delete camera');
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Top Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              SURVEILLANCE CAMERA WALL
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-bold">
              {cameras.length} NODES
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Real-time multi-channel optical monitoring, RTSP endpoints & perimeter sensors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Grid Layout Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-surface-subtle border border-surface-border p-1 rounded">
            <button
              onClick={() => setGridCols(1)}
              className={`p-1 rounded ${gridCols === 1 ? 'bg-tactical-blue text-white' : 'text-slate-400 hover:text-white'}`}
              title="1 Column (Large View)"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGridCols(2)}
              className={`p-1 rounded ${gridCols === 2 ? 'bg-tactical-blue text-white' : 'text-slate-400 hover:text-white'}`}
              title="2 Columns (2x2 Quad View)"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGridCols(3)}
              className={`p-1 rounded ${gridCols === 3 ? 'bg-tactical-blue text-white' : 'text-slate-400 hover:text-white'}`}
              title="3 Columns (3x2 Matrix)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={fetchCameras}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded bg-tactical-blue hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-tactical cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Camera Node
          </button>
        </div>
      </div>

      {/* Cameras Grid */}
      {cameras.length === 0 && !loading ? (
        <div className="p-12 text-center rounded-lg border border-surface-border bg-surface text-tactical-slate">
          <Cctv className="w-10 h-10 mx-auto text-tactical-slate/50 mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">NO OPTICAL SENSORS CONFIGURED</h3>
          <p className="text-xs text-tactical-slate mt-1 max-w-sm mx-auto">
            Click 'Register Camera Node' to configure a USB webcam or network RTSP surveillance feed.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 bg-tactical-blue hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
          >
            Register Primary Node
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            gridCols === 1
              ? 'grid-cols-1'
              : gridCols === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : gridCols === 4
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {cameras.map((cam) => (
            <CameraCard
              key={cam.camera_id}
              camera={cam}
              onDelete={handleDeleteCamera}
            />
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
          <div className="bg-surface border border-surface-border rounded-lg w-full max-w-md overflow-hidden shadow-tactical">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Cctv className="w-4 h-4 text-tactical-blue" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  REGISTER NEW OPTICAL NODE
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCamera} className="p-4 space-y-3">
              {formError && (
                <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-tactical-slate uppercase mb-1">
                  CAMERA IDENTIFIER (ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CAM-02"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-tactical-slate uppercase mb-1">
                  FRIENDLY DISPLAY NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. West Perimeter Optical Gateway"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-tactical-slate uppercase mb-1">
                  SECURITY SECTOR / LOCATION
                </label>
                <input
                  type="text"
                  placeholder="e.g. Building B - North Corridor"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 text-xs transition-colors border border-surface-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-tactical-blue hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-tactical"
                >
                  {isSubmitting ? 'Registering...' : 'Confirm Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
