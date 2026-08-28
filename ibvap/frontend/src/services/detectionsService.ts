import { apiFetch } from './api';
import { Detection } from '../types/detection';
import { MOCK_DETECTIONS } from '../data/mockData';

export const detectionsService = {
  /**
   * Fetch object detections feed GET /api/v1/detections
   */
  async getDetections(): Promise<Detection[]> {
    try {
      return await apiFetch<Detection[]>('/detections');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/detections. Using fallback UI mock data.', error);
      return MOCK_DETECTIONS;
    }
  },
};
