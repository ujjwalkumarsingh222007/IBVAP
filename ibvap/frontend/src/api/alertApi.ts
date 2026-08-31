import apiClient from './apiClient';
import { CorrelatedThreat } from '../types';

export const alertApi = {
  getThreats: async (params?: { camera_id?: string; severity?: string; status?: string; limit?: number }): Promise<CorrelatedThreat[]> => {
    const response = await apiClient.get<CorrelatedThreat[]>('/threats', { params });
    return response.data;
  },

  getActiveThreats: async (cameraId?: string, limit = 20): Promise<CorrelatedThreat[]> => {
    const response = await apiClient.get<CorrelatedThreat[]>('/threats/active', {
      params: { camera_id: cameraId, limit },
    });
    return response.data;
  },

  getThreatStats: async () => {
    const response = await apiClient.get('/threats/stats');
    return response.data;
  },

  updateThreatStatus: async (threatId: string | number, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED', reason?: string) => {
    const response = await apiClient.patch(`/threats/${threatId}/status`, { status, reason });
    return response.data;
  },
};
