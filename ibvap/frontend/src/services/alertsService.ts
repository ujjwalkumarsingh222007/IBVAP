import { apiFetch } from './api';
import { Alert } from '../types/alert';
import { MOCK_ALERTS } from '../data/mockData';

export const alertsService = {
  /**
   * Fetch active surveillance alerts GET /api/v1/alerts
   */
  async getAlerts(): Promise<Alert[]> {
    try {
      return await apiFetch<Alert[]>('/alerts');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/alerts. Using fallback UI mock data.', error);
      return MOCK_ALERTS;
    }
  },

  /**
   * Acknowledge alert status PATCH /api/v1/alerts/:id
   */
  async acknowledgeAlert(id: string): Promise<Alert> {
    try {
      return await apiFetch<Alert>(`/alerts/${id}/acknowledge`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for alert ack ${id}.`, error);
      const target = MOCK_ALERTS.find(a => a.id === id);
      return target
        ? { ...target, status: 'INVESTIGATING', acknowledged_by: 'Operator 1' }
        : MOCK_ALERTS[0];
    }
  },
};
