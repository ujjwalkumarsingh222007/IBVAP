import { apiClient } from './apiClient';
import { Detection } from '../types/detection';
import { MOCK_DETECTIONS } from '../data/mockData';
import { mapApiDetectionToDetection } from '../utils/mappers';

export const detectionsService = {
  /**
   * Fetch object detections feed GET /api/v1/detections
   */
  async getDetections(): Promise<{ data: Detection[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<unknown[]>('/detections');
      const mappedDetections = Array.isArray(data) ? data.map(mapApiDetectionToDetection) : [];
      return { data: mappedDetections, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for GET /api/v1/detections. Using mock development fallback.', error);
      return { data: MOCK_DETECTIONS, isLive: false };
    }
  },
};
