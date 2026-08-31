import apiClient from './apiClient';
import { SystemHealth } from '../types';

export const healthApi = {
  getHealth: async (): Promise<SystemHealth> => {
    try {
      const response = await apiClient.get<SystemHealth>('/health');
      return response.data;
    } catch {
      // Direct alias fallback if /api/v1/health is routed to /health
      const fallback = await apiClient.get<SystemHealth>('/health', { baseURL: '' });
      return fallback.data;
    }
  },
};
