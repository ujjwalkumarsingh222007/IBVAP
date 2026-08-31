/**
 * evidenceApi.ts — API client for fetching and managing captured surveillance evidence.
 */

import apiClient from './apiClient';
import { EvidenceItem, EvidenceFilterParams } from '../types';

export const evidenceApi = {
  /**
   * Get paginated list of captured evidence.
   */
  getEvidence: async (params?: EvidenceFilterParams): Promise<EvidenceItem[]> => {
    const response = await apiClient.get<EvidenceItem[]>('/api/v1/evidence', {
      params,
    });
    return response.data;
  },

  /**
   * Get total count of captured evidence.
   */
  getEvidenceCount: async (params?: EvidenceFilterParams): Promise<{ count: number }> => {
    const response = await apiClient.get<{ count: number }>('/api/v1/evidence/count', {
      params,
    });
    return response.data;
  },

  /**
   * Get single evidence record by ID.
   */
  getEvidenceDetail: async (id: number): Promise<EvidenceItem> => {
    const response = await apiClient.get<EvidenceItem>(`/api/v1/evidence/${id}`);
    return response.data;
  },

  /**
   * Delete single evidence record and images.
   */
  deleteEvidence: async (id: number): Promise<{ status: string; message: string }> => {
    const response = await apiClient.delete<{ status: string; message: string }>(
      `/api/v1/evidence/${id}`
    );
    return response.data;
  },
};

export default evidenceApi;
