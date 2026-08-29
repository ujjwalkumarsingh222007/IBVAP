import { useState, useCallback, useMemo } from 'react';
import { analyticsApi, formatApiError } from '../api';
import {
  AnalyticsCameras,
  AnalyticsDistribution,
  AnalyticsQueryParams,
  AnalyticsSummary,
  AnalyticsTrends,
} from '../types';
import { usePolling } from './usePolling';

export type TimeRangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | 'all' | 'custom';

export interface UseAnalyticsOptions {
  timeRange?: TimeRangePreset;
  customStartTime?: string;
  customEndTime?: string;
  cameraId?: string;
  eventType?: string;
  interval?: 'hourly' | 'daily';
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const {
    timeRange = '24h',
    customStartTime,
    customEndTime,
    cameraId = '',
    eventType = 'ALL',
    interval = 'hourly',
    pollIntervalMs = 5000,
    enabled = true,
  } = options;

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [distribution, setDistribution] = useState<AnalyticsDistribution | null>(null);
  const [cameras, setCameras] = useState<AnalyticsCameras | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Compute active start_time & end_time based on selected preset
  const queryParams: AnalyticsQueryParams = useMemo(() => {
    const params: AnalyticsQueryParams = {
      interval,
    };

    if (cameraId.trim()) params.camera_id = cameraId.trim();
    if (eventType && eventType !== 'ALL') params.event_type = eventType;

    const now = new Date();

    if (timeRange === 'custom') {
      if (customStartTime) params.start_time = customStartTime;
      if (customEndTime) params.end_time = customEndTime;
      return params;
    }

    if (timeRange === 'all') {
      return params;
    }

    let pastMs = 0;
    if (timeRange === '1h') pastMs = 60 * 60 * 1000;
    else if (timeRange === '6h') pastMs = 6 * 60 * 60 * 1000;
    else if (timeRange === '24h') pastMs = 24 * 60 * 60 * 1000;
    else if (timeRange === '7d') pastMs = 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === '30d') pastMs = 30 * 24 * 60 * 60 * 1000;

    const startDate = new Date(now.getTime() - pastMs);
    params.start_time = startDate.toISOString();
    params.end_time = now.toISOString();

    return params;
  }, [timeRange, customStartTime, customEndTime, cameraId, eventType, interval]);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const [sumData, trendsData, distData, camsData] = await Promise.all([
        analyticsApi.getSummary(queryParams),
        analyticsApi.getTrends(queryParams),
        analyticsApi.getDistribution(queryParams),
        analyticsApi.getCameras(queryParams),
      ]);

      setSummary(sumData);
      setTrends(trendsData);
      setDistribution(distData);
      setCameras(camsData);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  const { refreshing, lastUpdated, refresh, isPolling, togglePolling } =
    usePolling(fetchAnalyticsData, {
      intervalMs: pollIntervalMs,
      enabled,
      pauseWhenHidden: true,
      immediate: true,
    });

  return {
    summary,
    trends,
    distribution,
    cameras,
    loading,
    refreshing,
    error,
    lastUpdated,
    isPolling,
    queryParams,
    refresh,
    togglePolling,
  };
}

export default useAnalytics;
