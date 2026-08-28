import { apiClient } from './apiClient';
import { Alert } from '../types/alert';
import { MOCK_ALERTS } from '../data/mockData';
import { mapApiAlertToAlert } from '../utils/mappers';

let inMemoryAlerts = [...MOCK_ALERTS];

export const alertsService = {
  /**
   * Fetch active surveillance alerts GET /api/v1/alerts
   */
  async getAlerts(): Promise<{ data: Alert[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<unknown[]>('/alerts');
      const mappedAlerts = Array.isArray(data) ? data.map(mapApiAlertToAlert) : [];
      return { data: mappedAlerts, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for GET /api/v1/alerts. Using mock development fallback.', error);
      return { data: inMemoryAlerts, isLive: false };
    }
  },

  /**
   * Acknowledge alert status
   */
  async acknowledgeAlert(id: string): Promise<{ data: Alert; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.patch<Record<string, any>>(`/alerts/${id}/acknowledge`);
      return { data: mapApiAlertToAlert(data), isLive };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for alert ack ${id}. Local state updated.`, error);
      inMemoryAlerts = inMemoryAlerts.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'INVESTIGATING',
              acknowledged_by: 'Officer J. Miller (Control Room)',
              acknowledged_at: new Date().toISOString(),
            }
          : a
      );
      return { data: inMemoryAlerts.find(a => a.id === id)!, isLive: false };
    }
  },

  /**
   * Resolve alert status
   */
  async resolveAlert(id: string, notes?: string): Promise<{ data: Alert; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.patch<Record<string, any>>(`/alerts/${id}/resolve`, { resolution_notes: notes });
      return { data: mapApiAlertToAlert(data), isLive };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for alert resolve ${id}.`, error);
      inMemoryAlerts = inMemoryAlerts.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'RESOLVED',
              resolved_by: 'Officer J. Miller',
              resolved_at: new Date().toISOString(),
              resolution_notes: notes || 'Resolved via Control Room Operator Panel.',
            }
          : a
      );
      return { data: inMemoryAlerts.find(a => a.id === id)!, isLive: false };
    }
  },

  /**
   * Dismiss alert status
   */
  async dismissAlert(id: string): Promise<{ data: Alert; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.patch<Record<string, any>>(`/alerts/${id}/dismiss`);
      return { data: mapApiAlertToAlert(data), isLive };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for alert dismiss ${id}.`, error);
      inMemoryAlerts = inMemoryAlerts.map(a =>
        a.id === id ? { ...a, status: 'DISMISSED' } : a
      );
      return { data: inMemoryAlerts.find(a => a.id === id)!, isLive: false };
    }
  },
};
