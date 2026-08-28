import { apiClient } from './apiClient';
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
  async getDashboardStats(): Promise<{ data: DashboardStatistics; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<DashboardStatistics>('/analytics/dashboard');
      return { data, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for /analytics/dashboard. Using mock development fallback.', error);
      return { data: MOCK_DASHBOARD_STATS, isLive: false };
    }
  },

  /**
   * Fetch hourly detection distribution trends
   */
  async getHourlyTrends(): Promise<{ data: HourlyDetectionTrend[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<HourlyDetectionTrend[]>('/analytics/hourly');
      return { data: Array.isArray(data) ? data : MOCK_HOURLY_TRENDS, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for /analytics/hourly.', error);
      return { data: MOCK_HOURLY_TRENDS, isLive: false };
    }
  },

  /**
   * Fetch event type distribution pie data
   */
  async getEventTypeDistribution(): Promise<{ data: EventTypeDistribution[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<EventTypeDistribution[]>('/analytics/event-types');
      return { data: Array.isArray(data) ? data : MOCK_EVENT_TYPE_DISTRIBUTION, isLive };
    } catch (error) {
      return { data: MOCK_EVENT_TYPE_DISTRIBUTION, isLive: false };
    }
  },

  /**
   * Fetch camera event breakdown bar data
   */
  async getCameraEventBreakdown(): Promise<{ data: CameraEventBreakdown[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<CameraEventBreakdown[]>('/analytics/camera-breakdown');
      return { data: Array.isArray(data) ? data : MOCK_CAMERA_EVENT_BREAKDOWN, isLive };
    } catch (error) {
      return { data: MOCK_CAMERA_EVENT_BREAKDOWN, isLive: false };
    }
  },

  /**
   * Fetch alert severity distribution data
   */
  async getAlertSeverityDistribution(): Promise<{ data: AlertSeverityDistribution[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<AlertSeverityDistribution[]>('/analytics/alert-severities');
      return { data: Array.isArray(data) ? data : MOCK_ALERT_SEVERITY_DISTRIBUTION, isLive };
    } catch (error) {
      return { data: MOCK_ALERT_SEVERITY_DISTRIBUTION, isLive: false };
    }
  },

  /**
   * Fetch threat distribution breakdown
   */
  async getThreatDistribution(): Promise<{ data: ThreatDistribution[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<ThreatDistribution[]>('/analytics/threats');
      return { data: Array.isArray(data) ? data : MOCK_THREAT_DISTRIBUTION, isLive };
    } catch (error) {
      return { data: MOCK_THREAT_DISTRIBUTION, isLive: false };
    }
  },
};
