import { apiClient } from './apiClient';
import { Event, EventFilter } from '../types/event';
import { MOCK_EVENTS } from '../data/mockData';
import { mapApiEventToEvent } from '../utils/mappers';

export const eventsService = {
  /**
   * Fetch events log from backend GET /api/v1/events
   * Maps raw API payloads to Common Event Contract and falls back to mock data if backend is offline.
   */
  async getEvents(filters?: EventFilter): Promise<{ data: Event[]; isLive: boolean }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters?.event_type && filters.event_type !== 'ALL') {
        queryParams.append('event_type', filters.event_type);
      }
      if (filters?.camera_id && filters.camera_id !== 'ALL') {
        queryParams.append('camera_id', filters.camera_id);
      }
      if (filters?.min_confidence) {
        queryParams.append('min_confidence', filters.min_confidence.toString());
      }
      if (filters?.search_query) {
        queryParams.append('search', filters.search_query);
      }

      const queryStr = queryParams.toString();
      const endpoint = `/events${queryStr ? `?${queryStr}` : ''}`;
      
      const { data, isLive } = await apiClient.get<unknown[]>(endpoint);
      const mappedEvents = Array.isArray(data) ? data.map(mapApiEventToEvent) : [];
      return { data: mappedEvents, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for GET /api/v1/events. Using mock development fallback.', error);
      let results = [...MOCK_EVENTS];
      if (filters?.event_type && filters.event_type !== 'ALL') {
        results = results.filter(e => e.event_type === filters.event_type);
      }
      if (filters?.camera_id && filters.camera_id !== 'ALL') {
        results = results.filter(e => e.camera_id === filters.camera_id);
      }
      if (filters?.min_confidence) {
        results = results.filter(e => e.confidence >= filters.min_confidence!);
      }
      if (filters?.search_query) {
        const q = filters.search_query.toLowerCase();
        results = results.filter(e =>
          e.camera_id.toLowerCase().includes(q) ||
          e.event_type.toLowerCase().includes(q) ||
          (e.metadata?.license_plate && String(e.metadata.license_plate).toLowerCase().includes(q))
        );
      }
      return { data: results, isLive: false };
    }
  },

  /**
   * Post new AI event to backend POST /api/v1/events
   */
  async createEvent(event: Omit<Event, 'id'>): Promise<{ data: Event; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.post<Record<string, any>>('/events', event);
      return { data: mapApiEventToEvent(data), isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for POST /api/v1/events.', error);
      const fallbackEvent: Event = {
        ...event,
        id: `EVT-MOCK-${Date.now()}`,
      };
      return { data: fallbackEvent, isLive: false };
    }
  },
};
