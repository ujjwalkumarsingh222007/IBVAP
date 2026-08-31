import { apiClient } from './apiClient';
import {
  AnalyticsCameras,
  AnalyticsDistribution,
  AnalyticsQueryParams,
  AnalyticsSummary,
  AnalyticsTrends,
} from '../types';

export const analyticsApi = {
  /**
   * Fetch high-level analytics summary and threat counts.
   */
  async getSummary(params?: AnalyticsQueryParams): Promise<AnalyticsSummary> {
    const response = await apiClient.get<AnalyticsSummary>(
      '/api/v1/analytics/summary',
      { params }
    );
    return response.data;
  },

  /**
   * Fetch time-series event and threat trend buckets.
   */
  async getTrends(params?: AnalyticsQueryParams): Promise<AnalyticsTrends> {
    const response = await apiClient.get<AnalyticsTrends>(
      '/api/v1/analytics/trends',
      { params }
    );
    return response.data;
  },

  /**
   * Fetch event category distribution and threat percentages.
   */
  async getDistribution(
    params?: AnalyticsQueryParams
  ): Promise<AnalyticsDistribution> {
    const response = await apiClient.get<AnalyticsDistribution>(
      '/api/v1/analytics/distribution',
      { params }
    );
    return response.data;
  },

  /**
   * Fetch ranked camera activity and threat density.
   */
  async getCameras(params?: AnalyticsQueryParams): Promise<AnalyticsCameras> {
    const response = await apiClient.get<AnalyticsCameras>(
      '/api/v1/analytics/cameras',
      { params }
    );
    return response.data;
  },
};

export default analyticsApi;
