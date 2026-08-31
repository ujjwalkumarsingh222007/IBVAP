import React, { useState, useCallback } from 'react';
import { Plus, Video, ShieldCheck } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { CameraCard } from '../components/cameras/CameraCard';
import { CameraModal } from '../components/cameras/CameraModal';
import { DeleteConfirmModal } from '../components/cameras/DeleteConfirmModal';
import { LiveCameraPreview } from '../components/cameras/LiveCameraPreview';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { cameraApi, eventsApi, formatApiError } from '../api';
import { Camera, CameraCreateInput, CameraUpdateInput, SurveillanceEvent } from '../types';
import { usePolling, useAuth } from '../hooks';

export const Cameras: React.FC = () => {
  const { isAdmin, role } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Delete modal state
  const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Live Webcam Preview Modal
  const [cameraForLive, setCameraForLive] = useState<Camera | null>(null);

  const fetchCamerasAndEvents = useCallback(async () => {
    try {
      const [camData, evData] = await Promise.all([
        cameraApi.getCameras(),
        eventsApi.getEvents({ limit: 50 }).catch(() => []),
      ]);
      setCameras(camData);
      setEvents(evData);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, refresh } = usePolling(fetchCamerasAndEvents, {
    intervalMs: 5000,
    enabled: true,
    pauseWhenHidden: true,
    immediate: true,
  });

  const handleOpenAddModal = () => {
    if (!isAdmin) return;
    setSelectedCamera(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (camera: Camera) => {
    if (!isAdmin) return;
    setSelectedCamera(camera);
    setIsModalOpen(true);
  };

  const handleSaveCamera = async (data: CameraCreateInput | CameraUpdateInput) => {
    if (!isAdmin) return;
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
    if (!isAdmin || !cameraToDelete) return;
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

  const getDetections = (camId: string) => {
    const camEvents = events.filter((e) => e.camera_id === camId);
    const personCount = camEvents.filter(
      (e) => e.event_type === 'PERSON_DETECTED' || e.event_type === 'INTRUSION_DETECTED'
    ).length;
    const vehicleCount = camEvents.filter(
      (e) => e.event_type === 'VEHICLE_DETECTED' || e.event_type === 'ANPR_DETECTED' || e.event_type === 'WATCHLIST_MATCH'
    ).length;
    return { personCount, vehicleCount };
  };

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Cameras"
        subtitle="Manage surveillance streams, video sensors, and live monitoring"
        onRefresh={refresh}
        isRefreshing={refreshing}
        action={
          isAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Camera
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Role: {role}</span>
            </div>
          )
        }
      />

      {error && (
        <ErrorMessage
          title="Camera Connection Error"
          message={error}
          onRetry={refresh}
        />
      )}

      {loading && cameras.length === 0 ? (
        <CardSkeleton count={6} />
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={<Video className="w-12 h-12 text-slate-500 stroke-[1.5]" />}
          title="No Cameras Added"
          description={
            isAdmin
              ? "Click 'Add Camera' to register a webcam or video stream for AI monitoring."
              : 'No cameras registered.'
          }
          action={
            isAdmin ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddModal}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Camera
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cameras.map((camera) => {
            const { personCount, vehicleCount } = getDetections(camera.camera_id);
            return (
              <CameraCard
                key={camera.camera_id}
                camera={camera}
                isAdmin={isAdmin}
                onEdit={handleOpenEditModal}
                onDelete={(cam) => setCameraToDelete(cam)}
                onLive={(cam) => setCameraForLive(cam)}
                personCount={personCount}
                vehicleCount={vehicleCount}
              />
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isAdmin && (
        <CameraModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSaveCamera}
          camera={selectedCamera}
          loading={modalLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isAdmin && (
        <DeleteConfirmModal
          isOpen={Boolean(cameraToDelete)}
          onClose={() => setCameraToDelete(null)}
          onConfirm={handleDeleteCamera}
          camera={cameraToDelete}
          loading={deleteLoading}
        />
      )}

      {/* Real-Time Live Webcam Preview Modal */}
      <LiveCameraPreview
        camera={cameraForLive}
        onClose={() => setCameraForLive(null)}
      />
    </div>
  );
};

export default Cameras;
