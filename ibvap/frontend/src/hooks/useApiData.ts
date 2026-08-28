import { useState, useEffect, useCallback } from 'react';
import { usePolling } from './usePolling';
import { getBackendConnectivity } from '../services/apiClient';

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  isDemoData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Universal data fetching hook managing loading, error, empty, refetch, and mock fallback indicators.
 */
export function useApiData<T>(
  fetchFn: () => Promise<{ data: T; isLive: boolean } | T>,
  pollIntervalMs: number = 0
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState<boolean>(!getBackendConnectivity());

  const executeFetch = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFn();

      if (result && typeof result === 'object' && 'data' in result && 'isLive' in result) {
        const fetchRes = result as { data: T; isLive: boolean };
        setData(fetchRes.data);
        setIsDemoData(!fetchRes.isLive);
      } else {
        setData(result as T);
        setIsDemoData(!getBackendConnectivity());
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Error communicating with surveillance backend');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  usePolling(executeFetch, pollIntervalMs, pollIntervalMs > 0);

  const isEmpty = Array.isArray(data) ? data.length === 0 : !data;

  return {
    data,
    loading,
    error,
    isEmpty,
    isDemoData,
    refetch: executeFetch,
  };
}
