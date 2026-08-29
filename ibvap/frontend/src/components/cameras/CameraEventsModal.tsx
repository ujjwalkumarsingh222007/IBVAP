import React, { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Clock,
  Eye,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { EventBadge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { EventDetailModal } from '../events/EventDetailModal';
import { eventsApi, formatApiError } from '../../api';
import { Camera, SurveillanceEvent } from '../../types';
import { getEventSeverity, getSeverityConfig } from '../../utils/severity';

interface CameraEventsModalProps {
  camera: Camera | null;
  onClose: () => void;
}

export const CameraEventsModal: React.FC<CameraEventsModalProps> = ({
  camera,
  onClose,
}) => {
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const fetchCameraEvents = useCallback(async (isManual = false) => {
    if (!camera) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await eventsApi.getEvents({
        camera_id: camera.camera_id,
        limit: 30,
      });

      // Sort newest first
      data.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA || b.id - a.id;
      });

      setEvents(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [camera]);

  useEffect(() => {
    if (camera) {
      fetchCameraEvents();
    } else {
      setEvents([]);
    }
  }, [camera, fetchCameraEvents]);

  if (!camera) return null;

  return (
    <Modal
      isOpen={Boolean(camera)}
      onClose={onClose}
      title={`Camera Telemetry: ${camera.name} (${camera.camera_id})`}
      subtitle="Event Monitoring Mode — Ingested edge detections for this registered camera node"
      maxWidth="lg"
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Camera Info Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950 border border-blue-800 rounded-lg text-blue-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">
                  {camera.camera_id}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-bold uppercase">
                  Event Monitoring
                </span>
              </div>
              <p className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {camera.location || 'Location unassigned'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase">Telemetry Count</span>
              <span className="text-sm font-bold text-cyan-400">{events.length} Recent Events</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={refreshing}
              onClick={() => fetchCameraEvents(true)}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Events Feed */}
        {loading ? (
          <div className="space-y-3 py-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-900 rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No Detections for this Camera"
            description={`Camera ${camera.camera_id} has not logged any surveillance events yet.`}
          />
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {events.map((ev) => {
              const severity = getEventSeverity(ev.event_type);
              const sevConfig = getSeverityConfig(severity);
              const plateNum = ev.metadata?.plate_number;
              const trackId = ev.metadata?.track_id;

              return (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-slate-300 shrink-0">#{ev.id}</span>
                    <EventBadge eventType={ev.event_type} />
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                    >
                      {sevConfig.label}
                    </span>

                    {plateNum && (
                      <span className="text-amber-300 font-bold text-xs truncate">
                        {plateNum}
                      </span>
                    )}

                    {trackId !== undefined && (
                      <span className="text-purple-300 text-xs truncate">
                        Track #{trackId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>

                    <button
                      onClick={() => setSelectedEventId(ev.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nested detail inspector */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </Modal>
  );
};

export default CameraEventsModal;
