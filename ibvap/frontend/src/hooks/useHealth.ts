import { useState, useCallback, useRef } from 'react';
import { healthApi, formatApiError } from '../api';
import { HealthStatus } from '../types';
import { usePolling } from './usePolling';

export interface UseHealthOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
}

export const useHealth = (options: UseHealthOptions | number = 5000) => {
  const pollIntervalMs = typeof options === 'number' ? options : options.pollIntervalMs ?? 5000;
  const enabled = typeof options === 'number' ? true : options.enabled ?? true;

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [lastSuccessfulCheck, setLastSuccessfulCheck] = useState<string>('');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);

  const initialCheckDoneRef = useRef<boolean>(false);

  const checkHealth = useCallback(async () => {
    const timestamp = new Date().toLocaleTimeString();
    setLastChecked(timestamp);

    try {
      const data = await healthApi.getHealth();
      setHealth(data);
      setIsBackendOnline(true);
      setLastSuccessfulCheck(timestamp);
      setError(null);
    } catch (err) {
      setIsBackendOnline(false);
      setError(formatApiError(err));
    } finally {
      initialCheckDoneRef.current = true;
    }
  }, []);

  const { isPolling, refreshing, lastUpdated, refresh, togglePolling } = usePolling(
    checkHealth,
    {
      intervalMs: pollIntervalMs,
      enabled,
      pauseWhenHidden: false, // Keep health monitor checking in background
      immediate: true,
    }
  );

  const isDatabaseConnected = health?.database === 'connected';
  const isHealthy = isBackendOnline && isDatabaseConnected;
  const isDegraded = isBackendOnline && !isDatabaseConnected;
  const isOffline = !isBackendOnline;

  return {
    health,
    loading: !initialCheckDoneRef.current,
    refreshing,
    error,
    lastChecked,
    lastSuccessfulCheck,
    isBackendOnline,
    isDatabaseConnected,
    isHealthy,
    isDegraded,
    isOffline,
    isPolling,
    lastUpdated,
    checkHealth: refresh,
    refresh,
    togglePolling,
  };
};

export default useHealth;
