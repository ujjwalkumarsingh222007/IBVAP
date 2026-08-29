import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { EventFilterPanel } from '../components/events/EventFilterPanel';
import { EventTable } from '../components/events/EventTable';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { Pagination } from '../components/events/Pagination';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { eventsApi, cameraApi, formatApiError } from '../api';
import { EventFilters, SurveillanceEvent } from '../types';

export const Events: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCameraId = searchParams.get('camera_id') || undefined;
  const initialEventType = searchParams.get('event_type') || undefined;

  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [camerasList, setCamerasList] = useState<string[]>([]);
  const [filters, setFilters] = useState<EventFilters>({
    limit: 20,
    offset: 0,
    camera_id: initialCameraId,
    event_type: initialEventType,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Load cameras for filter dropdown
  useEffect(() => {
    cameraApi
      .getCameras()
      .then((cams) => setCamerasList(cams.map((c) => c.camera_id)))
      .catch(() => {});
  }, []);

  const fetchEvents = useCallback(
    async (currentFilters: EventFilters, isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [eventData, countData] = await Promise.all([
          eventsApi.getEvents(currentFilters),
          eventsApi.getEventCount(currentFilters),
        ]);
        setEvents(eventData);
        setTotalCount(countData.count);
      } catch (err) {
        setError(formatApiError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchEvents(filters);
  }, [filters, fetchEvents]);

  const handleApplyFilters = (newFilters: EventFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      limit: filters.limit || 20,
      offset: 0,
    });
  };

  const handlePageChange = (newOffset: number) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, offset: 0 }));
  };

  return (
    <div className="space-y-6">
      <Header
        title="Event Explorer & Archive"
        subtitle="Searchable Surveillance Archive, Multi-Filter Query Engine & Metadata Logs"
        onRefresh={() => fetchEvents(filters, true)}
        isRefreshing={refreshing}
      />

      {error && (
        <ErrorMessage
          title="Failed to Load Surveillance Events"
          message={error}
          onRetry={() => fetchEvents(filters, true)}
        />
      )}

      {/* Filter Panel */}
      <EventFilterPanel
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        camerasList={camerasList}
      />

      {/* Events Table */}
      <EventTable
        events={events}
        loading={loading}
        onSelectEvent={(id) => setSelectedEventId(id)}
      />

      {/* Pagination Controls */}
      {!loading && totalCount > 0 && (
        <Pagination
          total={totalCount}
          limit={filters.limit || 20}
          offset={filters.offset || 0}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Event Detail Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
};

export default Events;
