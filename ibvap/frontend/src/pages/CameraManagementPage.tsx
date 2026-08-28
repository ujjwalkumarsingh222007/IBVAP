import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { StatusBadge } from '../components/common/StatusBadge';
import { CameraFormModal } from '../components/camera-management/CameraFormModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { camerasService } from '../services/camerasService';
import { Camera } from '../types/camera';
import { Settings, Plus, Cpu, Edit, Trash2, Power, Search, Lock } from 'lucide-react';

export const CameraManagementPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null);

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

  const handleSaveCamera = async (data: Partial<Camera>) => {
    try {
      if (editingCamera) {
        const updated = await camerasService.updateCamera(editingCamera.id, data);
        setCameras(cameras.map(c => c.id === editingCamera.id ? updated : c));
      } else {
        const created = await camerasService.addCamera(data as any);
        setCameras([created, ...cameras]);
      }
      setIsFormModalOpen(false);
      setEditingCamera(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const updated = await camerasService.toggleCameraStatus(id);
      setCameras(cameras.map(c => c.id === id ? updated : c));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCamera = async () => {
    if (!deletingCamera) return;
    try {
      await camerasService.deleteCamera(deletingCamera.id);
      setCameras(cameras.filter(c => c.id !== deletingCamera.id));
      setDeletingCamera(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCameras = cameras.filter((cam) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cam.id.toLowerCase().includes(q) ||
      cam.name.toLowerCase().includes(q) ||
      cam.location.toLowerCase().includes(q) ||
      cam.zone.toLowerCase().includes(q)
    );
  });

  if (loading) return <SkeletonLoader type="table-row" count={5} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="RTSP / CCTV Camera Stream Management"
        subtitle="Register, configure, and inspect IP video feeds integrated into IBVAP OpenCV & YOLO pipelines"
        icon={<Settings size={22} />}
        action={
          <button
            onClick={() => {
              setEditingCamera(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold font-mono rounded-lg transition-colors shadow-md shadow-cyan-500/20"
          >
            <Plus size={16} />
            <span>Register Stream</span>
          </button>
        }
      />

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search by camera name, ID, location, or zone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#121824] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Camera ID / Name</th>
                <th className="py-3 px-4">Configured Stream URL</th>
                <th className="py-3 px-4">Zone / Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Resolution / FPS</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {filteredCameras.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-cyan-400">{cam.id}</div>
                    <div className="text-[11px] text-slate-200 font-sans font-semibold">{cam.name}</div>
                  </td>

                  <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mr-1">
                      <Lock size={10} />
                    </span>
                    {cam.stream_url.replace(/:[^:@]+@/, ':****@')}
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

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(cam.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          cam.status === 'ONLINE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-200'
                        }`}
                        title="Toggle stream status"
                      >
                        <Power size={14} />
                      </button>

                      <button
                        onClick={() => {
                          setEditingCamera(cam);
                          setIsFormModalOpen(true);
                        }}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 rounded-lg border border-slate-800 transition-colors"
                        title="Edit configuration"
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        onClick={() => setDeletingCamera(cam)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg border border-slate-800 transition-colors"
                        title="Delete camera stream"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Camera Add / Edit Form Modal */}
      {isFormModalOpen && (
        <CameraFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSave={handleSaveCamera}
          initialData={editingCamera}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCamera && (
        <ConfirmModal
          isOpen={!!deletingCamera}
          onClose={() => setDeletingCamera(null)}
          onConfirm={handleDeleteCamera}
          title={`Remove Camera Stream (${deletingCamera.id})`}
          message={`Are you sure you want to unregister camera stream "${deletingCamera.name}"? This action cannot be undone.`}
          confirmLabel="Remove Stream"
          isDangerous={true}
        />
      )}
    </div>
  );
};
