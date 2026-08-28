import { apiFetch } from './api';
import { Camera, CreateCameraInput } from '../types/camera';
import { MOCK_CAMERAS } from '../data/mockData';

export const camerasService = {
  /**
   * Fetch camera streams list GET /api/v1/cameras
   */
  async getCameras(): Promise<Camera[]> {
    try {
      return await apiFetch<Camera[]>('/cameras');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/cameras. Using fallback UI mock data.', error);
      return MOCK_CAMERAS;
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
      console.warn('[IBVAP API] Backend unreachable for POST /api/v1/cameras.', error);
      return {
        id: `CAM-0${MOCK_CAMERAS.length + 1}`,
        name: input.name,
        location: input.location,
        stream_url: input.stream_url,
        status: 'ONLINE',
        fps: 30,
        resolution: input.resolution || '1920x1080',
        zone: input.zone,
        last_ping: new Date().toISOString(),
        ai_enabled: input.ai_enabled ?? true,
      };
    }
  },
};
