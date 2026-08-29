import React, { useState, useCallback } from 'react';
import { Plus, Video } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { CameraCard } from '../components/cameras/CameraCard';
import { CameraModal } from '../components/cameras/CameraModal';
import { DeleteConfirmModal } from '../components/cameras/DeleteConfirmModal';
import { CameraEventsModal } from '../components/cameras/CameraEventsModal';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { cameraApi, formatApiError } from '../api';
import { Camera, CameraCreateInput, CameraUpdateInput } from '../types';
import { usePolling } from '../hooks';

export const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Delete modal state
  const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Camera Events Monitoring Modal
  const [cameraForEvents, setCameraForEvents] = useState<Camera | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      const data = await cameraApi.getCameras();
      setCameras(data);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, lastUpdated, refresh } = usePolling(fetchCameras, {
    intervalMs: 5000,
    enabled: true,
    pauseWhenHidden: true,
    immediate: true,
  });

  const handleOpenAddModal = () => {
    setSelectedCamera(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (camera: Camera) => {
    setSelectedCamera(camera);
    setIsModalOpen(true);
  };

  const handleSaveCamera = async (data: CameraCreateInput | CameraUpdateInput) => {
    setModalLoading(true);
    try {
      if (selectedCamera) {
        await cameraApi.updateCamera(selectedCamera.camera_id, data as CameraUpdateInput);
      } else {
        await cameraApi.createCamera(data as CameraCreateInput);
      }
      setIsModalOpen(false);
      await refresh();
    } catch (err) {
      throw new Error(formatApiError(err));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteCamera = async () => {
    if (!cameraToDelete) return;
    setDeleteLoading(true);
    try {
      await cameraApi.deleteCamera(cameraToDelete.camera_id);
      setCameraToDelete(null);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const activeCamerasCount = cameras.filter((c) => c.status === 'ONLINE').length;

  return (
    <div className="space-y-6">
      <Header
        title="Surveillance Camera Network"
        subtitle="Registered Perimeter Nodes, Optical Sensors & Event Monitoring Streams"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Control & Inventory Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Total Cameras:</span>
            <strong className="text-base text-slate-100">{cameras.length}</strong>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Online Active:</span>
            <strong className="text-base text-emerald-400">{activeCamerasCount}</strong>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Telemetry sync: {lastUpdated || 'Connecting...'}
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAddModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Add Camera Node
        </Button>
      </div>

      {error && (
        <ErrorMessage
          title="Camera Registry Sync Error"
          message={error}
          onRetry={refresh}
        />
      )}

      {loading && cameras.length === 0 ? (
        <CardSkeleton count={6} />
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={<Video className="w-12 h-12 text-slate-500 stroke-[1.5]" />}
          title="No Cameras Registered"
          description="Click 'Add Camera Node' to configure edge camera streams for IBVAP event monitoring."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Add First Camera
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cameras.map((camera) => (
            <CameraCard
              key={camera.camera_id}
              camera={camera}
              onEdit={handleOpenEditModal}
              onDelete={(cam) => setCameraToDelete(cam)}
              onViewEvents={(cam) => setCameraForEvents(cam)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <CameraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveCamera}
        camera={selectedCamera}
        loading={modalLoading}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(cameraToDelete)}
        onClose={() => setCameraToDelete(null)}
        onConfirm={handleDeleteCamera}
        camera={cameraToDelete}
        loading={deleteLoading}
      />

      {/* Camera-Specific Event Monitoring Modal */}
      <CameraEventsModal
        camera={cameraForEvents}
        onClose={() => setCameraForEvents(null)}
      />
    </div>
  );
};

export default Cameras;
