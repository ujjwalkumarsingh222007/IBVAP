import apiClient from './apiClient';
import { Camera, CameraCreateInput, CameraUpdateInput } from '../types';

export const cameraApi = {
  getCameras: async (): Promise<Camera[]> => {
    const response = await apiClient.get<Camera[]>('/api/v1/cameras');
    return response.data;
  },

  getCameraById: async (cameraId: string): Promise<Camera> => {
    const response = await apiClient.get<Camera>(`/api/v1/cameras/${encodeURIComponent(cameraId)}`);
    return response.data;
  },

  createCamera: async (data: CameraCreateInput): Promise<Camera> => {
    const response = await apiClient.post<Camera>('/api/v1/cameras', data);
    return response.data;
  },

  updateCamera: async (cameraId: string, data: CameraUpdateInput): Promise<Camera> => {
    const response = await apiClient.put<Camera>(
      `/api/v1/cameras/${encodeURIComponent(cameraId)}`,
      data
    );
    return response.data;
  },

  deleteCamera: async (cameraId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/cameras/${encodeURIComponent(cameraId)}`);
  },
};

export default cameraApi;
