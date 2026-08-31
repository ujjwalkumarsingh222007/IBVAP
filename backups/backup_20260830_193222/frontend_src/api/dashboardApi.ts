import apiClient from './apiClient';
import { DashboardSummary, SurveillanceEvent } from '../types';

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>('/api/v1/dashboard/summary');
    return response.data;
  },

  getRecentEvents: async (limit = 10): Promise<SurveillanceEvent[]> => {
    const response = await apiClient.get<SurveillanceEvent[]>('/api/v1/dashboard/recent-events', {
      params: { limit },
    });
    return response.data;
  },
};

export default dashboardApi;
