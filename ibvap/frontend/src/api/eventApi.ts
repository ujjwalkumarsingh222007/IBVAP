import apiClient from './apiClient';
import { SurveillanceEventPayload, DashboardSummary } from '../types';

export interface EventFilterParams {
  event_type?: string;
  camera_id?: string;
  confidence_min?: number;
  confidence_max?: number;
  limit?: number;
  offset?: number;
}

export const eventApi = {
  getEvents: async (params?: EventFilterParams): Promise<SurveillanceEventPayload[]> => {
    const response = await apiClient.get<SurveillanceEventPayload[]>('/events', { params });
    return response.data;
  },

  getRecentEvents: async (limit = 10): Promise<SurveillanceEventPayload[]> => {
    const response = await apiClient.get<SurveillanceEventPayload[]>('/dashboard/recent-events', {
      params: { limit },
    });
    return response.data;
  },

  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },

  getEventStats: async (): Promise<Record<string, number>> => {
    const response = await apiClient.get<Record<string, number>>('/events/stats');
    return response.data;
  },
};
