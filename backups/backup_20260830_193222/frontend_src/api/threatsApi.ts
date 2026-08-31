import apiClient from './apiClient';
import { Threat, ThreatDetail, ThreatStats, ThreatStatusUpdateInput, ThreatTimelineItem } from '../types';

export const threatsApi = {
  getThreats: async (params?: {
    camera_id?: string;
    severity?: string;
    status?: string;
    start_time?: string;
    end_time?: string;
    limit?: number;
    skip?: number;
  }): Promise<Threat[]> => {
    const response = await apiClient.get<Threat[]>('/threats', { params });
    return response.data;
  },

  getActiveThreats: async (camera_id?: string, limit: number = 20): Promise<Threat[]> => {
    const response = await apiClient.get<Threat[]>('/threats/active', {
      params: { camera_id, limit },
    });
    return response.data;
  },

  getThreatStats: async (): Promise<ThreatStats> => {
    const response = await apiClient.get<ThreatStats>('/threats/stats');
    return response.data;
  },

  getThreatById: async (threatId: string | number): Promise<ThreatDetail> => {
    const response = await apiClient.get<ThreatDetail>(`/threats/${threatId}`);
    return response.data;
  },

  getThreatTimeline: async (threatId: string | number): Promise<ThreatTimelineItem[]> => {
    const response = await apiClient.get<ThreatTimelineItem[]>(`/threats/${threatId}/timeline`);
    return response.data;
  },

  updateThreatStatus: async (
    threatId: string | number,
    payload: ThreatStatusUpdateInput
  ): Promise<Threat> => {
    const response = await apiClient.patch<Threat>(`/threats/${threatId}/status`, payload);
    return response.data;
  },
};
