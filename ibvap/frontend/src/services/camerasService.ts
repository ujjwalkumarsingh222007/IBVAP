import { apiFetch } from './api';
import { Camera, CreateCameraInput, UpdateCameraInput } from '../types/camera';
import { MOCK_CAMERAS } from '../data/mockData';

let inMemoryCameras = [...MOCK_CAMERAS];

export const camerasService = {
  /**
   * Fetch camera streams list GET /api/v1/cameras
   */
  async getCameras(): Promise<Camera[]> {
    try {
      return await apiFetch<Camera[]>('/cameras');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/cameras. Using fallback UI mock data.', error);
      return inMemoryCameras;
    }
  },

  /**
   * Add new camera stream POST /api/v1/cameras
   */
  async addCamera(input: CreateCameraInput): Promise<Camera> {
    try {
      return await apiFetch<Camera>('/cameras', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for POST /api/v1/cameras. Operating on local state.', error);
      const newCam: Camera = {
        id: `CAM-0${inMemoryCameras.length + 1}`,
        name: input.name,
        location: input.location,
        stream_url: input.stream_url,
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
      return newCam;
    }
  },

  /**
   * Update existing camera details PUT/PATCH /api/v1/cameras/:id
   */
  async updateCamera(id: string, input: UpdateCameraInput): Promise<Camera> {
    try {
      return await apiFetch<Camera>(`/cameras/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for PATCH /api/v1/cameras/${id}.`, error);
      inMemoryCameras = inMemoryCameras.map(c => c.id === id ? { ...c, ...input } : c);
      const updated = inMemoryCameras.find(c => c.id === id);
      return updated || inMemoryCameras[0];
    }
  },

  /**
   * Delete camera stream DELETE /api/v1/cameras/:id
   */
  async deleteCamera(id: string): Promise<boolean> {
    try {
      await apiFetch<void>(`/cameras/${id}`, { method: 'DELETE' });
      return true;
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for DELETE /api/v1/cameras/${id}.`, error);
      inMemoryCameras = inMemoryCameras.filter(c => c.id !== id);
      return true;
    }
  },

  /**
   * Toggle camera online/offline or AI enable status
   */
  async toggleCameraStatus(id: string): Promise<Camera> {
    const existing = inMemoryCameras.find(c => c.id === id);
    const newStatus = existing?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    return this.updateCamera(id, { status: newStatus });
  },
};
