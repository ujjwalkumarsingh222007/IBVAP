import apiClient from './apiClient';
import { EvidenceItem } from '../types';

export const evidenceApi = {
  getEvidenceList: async (params?: {
    camera_id?: string;
    detection_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<EvidenceItem[]> => {
    const response = await apiClient.get<EvidenceItem[]>('/evidence', { params });
    return response.data;
  },

  getEvidenceCount: async (params?: {
    camera_id?: string;
    detection_type?: string;
    status?: string;
  }): Promise<{ count: number }> => {
    const response = await apiClient.get<{ count: number }>('/evidence/count', { params });
    return response.data;
  },

  getEvidenceDetail: async (evidenceId: number): Promise<EvidenceItem> => {
    const response = await apiClient.get<EvidenceItem>(`/evidence/${evidenceId}`);
    return response.data;
  },

  deleteEvidence: async (evidenceId: number): Promise<{ status: string; message: string }> => {
    const response = await apiClient.delete<{ status: string; message: string }>(`/evidence/${evidenceId}`);
    return response.data;
  },
};
