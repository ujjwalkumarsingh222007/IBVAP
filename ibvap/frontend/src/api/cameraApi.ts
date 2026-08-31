import apiClient from './apiClient';
import { Camera, CameraCreatePayload, CameraUpdatePayload } from '../types';

export const cameraApi = {
  getCameras: async (): Promise<Camera[]> => {
    const response = await apiClient.get<Camera[]>('/cameras');
    return response.data;
  },

  getCamera: async (cameraId: string): Promise<Camera> => {
    const response = await apiClient.get<Camera>(`/cameras/${encodeURIComponent(cameraId)}`);
    return response.data;
  },

  createCamera: async (payload: CameraCreatePayload): Promise<Camera> => {
    const response = await apiClient.post<Camera>('/cameras', payload);
    return response.data;
  },

  updateCamera: async (cameraId: string, payload: CameraUpdatePayload): Promise<Camera> => {
    const response = await apiClient.put<Camera>(`/cameras/${encodeURIComponent(cameraId)}`, payload);
    return response.data;
  },

  deleteCamera: async (cameraId: string): Promise<void> => {
    await apiClient.delete(`/cameras/${encodeURIComponent(cameraId)}`);
  },
};
