import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePollingOptions {
  intervalMs?: number;
  enabled?: boolean;
  pauseWhenHidden?: boolean;
  immediate?: boolean;
}

export interface UsePollingReturn {
  isPolling: boolean;
  refreshing: boolean;
  lastUpdated: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  setIsPolling: (active: boolean) => void;
  togglePolling: () => void;
}

/**
 * Enterprise-grade polling hook.
 *
 * Features:
 * - Tab visibility detection: pauses on tab blur, resumes on focus
 * - Race-condition prevention: suppresses duplicate / overlapping fetch cycles
 * - Memory-leak safe: cleanly disposes intervals & cancels post-unmount state updates
 * - Manual trigger & pause/resume controls
 */
export function usePolling(
  callback: () => Promise<void>,
  options: UsePollingOptions = {}
): UsePollingReturn {
  const {
    intervalMs = 4000,
    enabled = true,
    pauseWhenHidden = true,
    immediate = true,
  } = options;

  const [isPolling, setIsPolling] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    setIsPolling(enabled);
  }, [enabled]);

  const executeCallback = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    if (!isMountedRef.current) return;

    isFetchingRef.current = true;
    if (isManual && isMountedRef.current) {
      setRefreshing(true);
    }

    try {
      await callbackRef.current();
      if (isMountedRef.current) {
        setLastUpdated(new Date().toLocaleTimeString());
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Polling operation failed');
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    await executeCallback(true);
  }, [executeCallback]);

  const togglePolling = useCallback(() => {
    setIsPolling((prev) => !prev);
  }, []);

  // Polling loop management
  useEffect(() => {
    isMountedRef.current = true;

    if (immediate && isPolling) {
      executeCallback(false);
    }

    if (!isPolling || intervalMs <= 0) {
      return () => {
        isMountedRef.current = false;
      };
    }

    const startTimer = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        if (pauseWhenHidden && document.hidden) {
          return;
        }
        executeCallback(false);
      }, intervalMs);
    };

    startTimer();

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (!pauseWhenHidden) return;
      if (!document.hidden && isPolling) {
        // Trigger immediate catch-up sync when tab is revisited
        executeCallback(false);
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, isPolling, pauseWhenHidden, immediate, executeCallback]);

  return {
    isPolling,
    refreshing,
    lastUpdated,
    error,
    refresh,
    setIsPolling,
    togglePolling,
  };
}
