import { apiFetch } from './api';
import { DashboardStatistics, HourlyDetectionTrend, ThreatDistribution } from '../types/analytics';
import { MOCK_DASHBOARD_STATS, MOCK_HOURLY_TRENDS, MOCK_THREAT_DISTRIBUTION } from '../data/mockData';

export const analyticsService = {
  /**
   * Fetch dashboard statistics summary
   */
  async getDashboardStats(): Promise<DashboardStatistics> {
    try {
      return await apiFetch<DashboardStatistics>('/analytics/dashboard');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/dashboard. Using fallback UI mock data.', error);
      return MOCK_DASHBOARD_STATS;
    }
  },

  /**
   * Fetch hourly detection distribution trends
   */
  async getHourlyTrends(): Promise<HourlyDetectionTrend[]> {
    try {
      return await apiFetch<HourlyDetectionTrend[]>('/analytics/hourly');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/hourly. Using fallback UI mock data.', error);
      return MOCK_HOURLY_TRENDS;
    }
  },

  /**
   * Fetch threat distribution breakdown
   */
  async getThreatDistribution(): Promise<ThreatDistribution[]> {
    try {
      return await apiFetch<ThreatDistribution[]>('/analytics/threats');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/threats. Using fallback UI mock data.', error);
      return MOCK_THREAT_DISTRIBUTION;
    }
  },
};
