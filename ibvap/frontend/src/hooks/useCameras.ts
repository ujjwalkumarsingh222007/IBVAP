import { useState, useEffect, useCallback } from 'react';
import { cameraApi, formatApiError } from '../api';
import { Camera, CameraCreateInput, CameraUpdateInput } from '../types';

export const useCameras = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCameras = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const data = await cameraApi.getCameras();
      setCameras(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const addCamera = async (data: CameraCreateInput): Promise<boolean> => {
    setActionLoading(true);
    setError(null);
    try {
      const created = await cameraApi.createCamera(data);
      setCameras((prev) => [...prev, created]);
      return true;
    } catch (err) {
      setError(formatApiError(err));
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const updateCamera = async (cameraId: string | number, data: CameraUpdateInput): Promise<boolean> => {
    setActionLoading(true);
    setError(null);
    try {
      const idStr = String(cameraId);
      const updated = await cameraApi.updateCamera(idStr, data);
      setCameras((prev) => prev.map((cam) => (cam.camera_id === idStr || cam.id === Number(cameraId) ? updated : cam)));
      return true;
    } catch (err) {
      setError(formatApiError(err));
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCamera = async (cameraId: string | number): Promise<boolean> => {
    setActionLoading(true);
    setError(null);
    try {
      const idStr = String(cameraId);
      await cameraApi.deleteCamera(idStr);
      setCameras((prev) => prev.filter((cam) => cam.camera_id !== idStr && cam.id !== Number(cameraId)));
      return true;
    } catch (err) {
      setError(formatApiError(err));
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    cameras,
    loading,
    refreshing,
    actionLoading,
    error,
    addCamera,
    updateCamera,
    deleteCamera,
    refresh: () => fetchCameras(true),
  };
};
