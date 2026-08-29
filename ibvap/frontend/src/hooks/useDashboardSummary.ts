import { useState, useCallback, useRef } from 'react';
import { dashboardApi, formatApiError } from '../api';
import { DashboardSummary, SurveillanceEvent } from '../types';
import { usePolling } from './usePolling';

export interface UseDashboardSummaryOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  recentLimit?: number;
}

export const useDashboardSummary = (options: UseDashboardSummaryOptions | number = 4000) => {
  const pollIntervalMs = typeof options === 'number' ? options : options.pollIntervalMs ?? 4000;
  const enabled = typeof options === 'number' ? true : options.enabled ?? true;
  const recentLimit = typeof options === 'number' ? 20 : options.recentLimit ?? 20;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<SurveillanceEvent[]>([]);
  const [newlyDetectedIds, setNewlyDetectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [summaryData, recentData] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getRecentEvents(recentLimit),
      ]);

      setSummary(summaryData);
      setRecentEvents(recentData);

      // Track newly detected events since previous poll
      if (recentData && recentData.length > 0) {
        const newIds = new Set<number>();
        if (!initialLoadRef.current) {
          recentData.forEach((ev) => {
            if (!seenIdsRef.current.has(ev.id)) {
              newIds.add(ev.id);
            }
          });
        }
        initialLoadRef.current = false;

        // Update seen registry
        recentData.forEach((ev) => seenIdsRef.current.add(ev.id));

        if (newIds.size > 0) {
          setNewlyDetectedIds(newIds);
          // Clear "new" highlight after 4 seconds
          setTimeout(() => {
            setNewlyDetectedIds(new Set());
          }, 4000);
        }
      }

      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [recentLimit]);

  const { isPolling, refreshing, lastUpdated, refresh, togglePolling, setIsPolling } = usePolling(
    fetchDashboardData,
    {
      intervalMs: pollIntervalMs,
      enabled,
      pauseWhenHidden: true,
      immediate: true,
    }
  );

  return {
    summary,
    recentEvents,
    newlyDetectedIds,
    loading,
    refreshing,
    error,
    isPolling,
    lastUpdated,
    refresh,
    togglePolling,
    setIsPolling,
  };
};

export default useDashboardSummary;
