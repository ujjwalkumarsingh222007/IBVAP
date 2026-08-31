import { useState, useEffect, useCallback } from 'react';
import { eventsApi, formatApiError } from '../api';
import { SurveillanceEvent, EventFilters } from '../types';

export const useEvents = (initialFilters: EventFilters = { limit: 20, offset: 0 }) => {
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>(initialFilters);

  const fetchEvents = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const [eventList, countData] = await Promise.all([
        eventsApi.getEvents(filters),
        eventsApi.getEventCount(filters),
      ]);
      setEvents(eventList);
      setTotalCount(countData.count);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const updateFilters = (newFilters: Partial<EventFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      offset: newFilters.offset !== undefined ? newFilters.offset : 0, // Reset to page 0 on filter change
    }));
  };

  const setPage = (offset: number) => {
    setFilters((prev) => ({ ...prev, offset }));
  };

  return {
    events,
    totalCount,
    loading,
    refreshing,
    error,
    filters,
    updateFilters,
    setPage,
    refresh: () => fetchEvents(true),
  };
};
