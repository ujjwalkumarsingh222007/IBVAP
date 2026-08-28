import { apiClient } from './apiClient';
import { Camera, CreateCameraInput, UpdateCameraInput } from '../types/camera';
import { MOCK_CAMERAS } from '../data/mockData';
import { mapApiCameraToCamera } from '../utils/mappers';

let inMemoryCameras = [...MOCK_CAMERAS];

export const camerasService = {
  /**
   * Fetch camera streams list GET /api/v1/cameras
   */
  async getCameras(): Promise<{ data: Camera[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<unknown[]>('/cameras');
      const mappedCameras = Array.isArray(data) ? data.map(mapApiCameraToCamera) : [];
      return { data: mappedCameras, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for GET /api/v1/cameras. Using mock development fallback.', error);
      return { data: inMemoryCameras, isLive: false };
    }
  },

  /**
   * Add new camera stream POST /api/v1/cameras
   */
  async addCamera(input: CreateCameraInput): Promise<{ data: Camera; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.post<Record<string, any>>('/cameras', input);
      return { data: mapApiCameraToCamera(data), isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for POST /api/v1/cameras.', error);
      const newCam: Camera = {
        id: `CAM-0${inMemoryCameras.length + 1}`,
        name: input.name,
        location: input.location,
        stream_url: input.stream_url.replace(/:[^:@]+@/, ':****@'),
        status: 'ONLINE',
        fps: input.fps || 30,
        resolution: input.resolution || '1920x1080',
        zone: input.zone,
        last_ping: new Date().toISOString(),
        ai_enabled: input.ai_enabled ?? true,
        detection_count_today: 0,
        notes: input.notes,
      };
      inMemoryCameras = [newCam, ...inMemoryCameras];
      return { data: newCam, isLive: false };
    }
  },

  /**
   * Update camera stream PATCH /api/v1/cameras/:id
   */
  async updateCamera(id: string, input: UpdateCameraInput): Promise<{ data: Camera; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.patch<Record<string, any>>(`/cameras/${id}`, input);
      return { data: mapApiCameraToCamera(data), isLive };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for PATCH /api/v1/cameras/${id}.`, error);
      inMemoryCameras = inMemoryCameras.map(c => c.id === id ? { ...c, ...input } : c);
      const updated = inMemoryCameras.find(c => c.id === id)!;
      return { data: updated, isLive: false };
    }
  },

  /**
   * Delete camera stream DELETE /api/v1/cameras/:id
   */
  async deleteCamera(id: string): Promise<{ success: boolean; isLive: boolean }> {
    try {
      await apiClient.del(`/cameras/${id}`);
      return { success: true, isLive: true };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for DELETE /api/v1/cameras/${id}.`, error);
      inMemoryCameras = inMemoryCameras.filter(c => c.id !== id);
      return { success: true, isLive: false };
    }
  },

  /**
   * Toggle camera online/offline
   */
  async toggleCameraStatus(id: string): Promise<{ data: Camera; isLive: boolean }> {
    const existing = inMemoryCameras.find(c => c.id === id);
    const newStatus = existing?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    return this.updateCamera(id, { status: newStatus });
  },
};
