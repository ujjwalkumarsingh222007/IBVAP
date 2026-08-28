import { apiFetch } from './api';
import { Event, EventFilter } from '../types/event';
import { MOCK_EVENTS } from '../data/mockData';

export const eventsService = {
  /**
   * Fetch events log from backend GET /api/v1/events
   * Falls back to mock data when backend is unavailable.
   */
  async getEvents(filters?: EventFilter): Promise<Event[]> {
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
      
      const queryStr = queryParams.toString();
      const endpoint = `/events${queryStr ? `?${queryStr}` : ''}`;
      return await apiFetch<Event[]>(endpoint);
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/events. Using fallback UI mock data.', error);
      // Filter mock data locally for demo fidelity
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
      return results;
    }
  },

  /**
   * Post new AI event to backend POST /api/v1/events
   */
  async createEvent(event: Omit<Event, 'id'>): Promise<Event> {
    try {
      return await apiFetch<Event>('/events', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for POST /api/v1/events.', error);
      return {
        ...event,
        id: `EVT-MOCK-${Date.now()}`,
      };
    }
  },
};
