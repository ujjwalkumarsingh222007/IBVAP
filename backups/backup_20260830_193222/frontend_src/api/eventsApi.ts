import apiClient from './apiClient';
import { EventCount, EventFilters, EventStats, SurveillanceEvent } from '../types';

export const eventsApi = {
  getEvents: async (filters: EventFilters = {}): Promise<SurveillanceEvent[]> => {
    const params: Record<string, unknown> = {};
    if (filters.event_type && filters.event_type !== 'ALL') {
      params.event_type = filters.event_type;
    }
    if (filters.camera_id) params.camera_id = filters.camera_id;
    if (filters.confidence_min !== undefined) params.confidence_min = filters.confidence_min;
    if (filters.confidence_max !== undefined) params.confidence_max = filters.confidence_max;
    if (filters.limit !== undefined) params.limit = filters.limit;
    if (filters.offset !== undefined) params.offset = filters.offset;

    const response = await apiClient.get<SurveillanceEvent[]>('/api/v1/events', { params });
    return response.data;
  },

  getEventById: async (id: number): Promise<SurveillanceEvent> => {
    const response = await apiClient.get<SurveillanceEvent>(`/api/v1/events/${id}`);
    return response.data;
  },

  getEventCount: async (filters: EventFilters = {}): Promise<EventCount> => {
    const params: Record<string, unknown> = {};
    if (filters.event_type && filters.event_type !== 'ALL') {
      params.event_type = filters.event_type;
    }
    if (filters.camera_id) params.camera_id = filters.camera_id;
    if (filters.confidence_min !== undefined) params.confidence_min = filters.confidence_min;
    if (filters.confidence_max !== undefined) params.confidence_max = filters.confidence_max;

    const response = await apiClient.get<EventCount>('/api/v1/events/count', { params });
    return response.data;
  },

  getStats: async (): Promise<EventStats> => {
    const response = await apiClient.get<EventStats>('/api/v1/events/stats');
    return response.data;
  },
};

export default eventsApi;
