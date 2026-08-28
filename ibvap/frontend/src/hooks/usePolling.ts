import { useEffect, useRef } from 'react';

/**
 * Custom React hook for periodic background polling with automatic timer cleanup on unmount.
 * Prevents memory leaks and unmounted component state updates.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 10000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      savedCallback.current();
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
