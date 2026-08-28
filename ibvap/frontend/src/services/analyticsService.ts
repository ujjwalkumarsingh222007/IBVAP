import { apiFetch } from './api';
import {
  DashboardStatistics,
  HourlyDetectionTrend,
  EventTypeDistribution,
  CameraEventBreakdown,
  AlertSeverityDistribution,
  ThreatDistribution,
} from '../types/analytics';
import {
  MOCK_DASHBOARD_STATS,
  MOCK_HOURLY_TRENDS,
  MOCK_EVENT_TYPE_DISTRIBUTION,
  MOCK_CAMERA_EVENT_BREAKDOWN,
  MOCK_ALERT_SEVERITY_DISTRIBUTION,
  MOCK_THREAT_DISTRIBUTION,
} from '../data/mockData';

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
   * Fetch event type distribution pie data
   */
  async getEventTypeDistribution(): Promise<EventTypeDistribution[]> {
    try {
      return await apiFetch<EventTypeDistribution[]>('/analytics/event-types');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/event-types.', error);
      return MOCK_EVENT_TYPE_DISTRIBUTION;
    }
  },

  /**
   * Fetch camera event breakdown bar data
   */
  async getCameraEventBreakdown(): Promise<CameraEventBreakdown[]> {
    try {
      return await apiFetch<CameraEventBreakdown[]>('/analytics/camera-breakdown');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/camera-breakdown.', error);
      return MOCK_CAMERA_EVENT_BREAKDOWN;
    }
  },

  /**
   * Fetch alert severity distribution data
   */
  async getAlertSeverityDistribution(): Promise<AlertSeverityDistribution[]> {
    try {
      return await apiFetch<AlertSeverityDistribution[]>('/analytics/alert-severities');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /analytics/alert-severities.', error);
      return MOCK_ALERT_SEVERITY_DISTRIBUTION;
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
