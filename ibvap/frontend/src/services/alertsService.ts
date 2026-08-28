import { apiFetch } from './api';
import { Alert } from '../types/alert';
import { MOCK_ALERTS } from '../data/mockData';

let inMemoryAlerts = [...MOCK_ALERTS];

export const alertsService = {
  /**
   * Fetch active surveillance alerts GET /api/v1/alerts
   */
  async getAlerts(): Promise<Alert[]> {
    try {
      return await apiFetch<Alert[]>('/alerts');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/alerts. Using fallback UI mock data.', error);
      return inMemoryAlerts;
    }
  },

  /**
   * Acknowledge alert status PATCH /api/v1/alerts/:id/acknowledge
   */
  async acknowledgeAlert(id: string): Promise<Alert> {
    try {
      return await apiFetch<Alert>(`/alerts/${id}/acknowledge`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for alert ack ${id}.`, error);
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
      return inMemoryAlerts.find(a => a.id === id)!;
    }
  },

  /**
   * Resolve alert status PATCH /api/v1/alerts/:id/resolve
   */
  async resolveAlert(id: string, notes?: string): Promise<Alert> {
    try {
      return await apiFetch<Alert>(`/alerts/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution_notes: notes }),
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for alert resolve ${id}.`, error);
      inMemoryAlerts = inMemoryAlerts.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'RESOLVED',
              resolved_by: 'Officer J. Miller',
              resolved_at: new Date().toISOString(),
              resolution_notes: notes || 'Threat resolved by sector patrol.',
            }
          : a
      );
      return inMemoryAlerts.find(a => a.id === id)!;
    }
  },

  /**
   * Dismiss alert status PATCH /api/v1/alerts/:id/dismiss
   */
  async dismissAlert(id: string): Promise<Alert> {
    try {
      return await apiFetch<Alert>(`/alerts/${id}/dismiss`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for alert dismiss ${id}.`, error);
      inMemoryAlerts = inMemoryAlerts.map(a =>
        a.id === id ? { ...a, status: 'DISMISSED' } : a
      );
      return inMemoryAlerts.find(a => a.id === id)!;
    }
  },
};
