import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Filter,
  RefreshCw,
  User,
  Car,
  Image as ImageIcon,
} from 'lucide-react';
import { eventApi } from '../api/eventApi';
import { cameraApi } from '../api/cameraApi';
import { SurveillanceEventPayload, Camera, EvidenceItem } from '../types';
import { EvidenceModal } from '../components/alerts/EvidenceModal';
import { formatFullDateTime } from '../utils/formatters';

export const Events: React.FC = () => {
  const [events, setEvents] = useState<SurveillanceEventPayload[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (selectedCamera) params.camera_id = selectedCamera;
      if (selectedType) params.event_type = selectedType;

      const [evData, camData] = await Promise.allSettled([
        eventApi.getEvents(params),
        cameraApi.getCameras(),
      ]);

      if (evData.status === 'fulfilled') setEvents(evData.value);
      if (camData.status === 'fulfilled') setCameras(camData.value);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedCamera, selectedType]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleInspectEvent = (ev: SurveillanceEventPayload) => {
    const isVeh = ev.event_type.includes('VEHICLE') || ev.event_type.includes('ANPR');
    const item: EvidenceItem = {
      id: ev.id || 1,
      event_id: ev.id || null,
      camera_id: ev.camera_id,
      timestamp: ev.timestamp || ev.created_at || new Date().toISOString(),
      detection_type: isVeh ? 'vehicle' : 'person',
      status: (ev.metadata?.status as any) || 'UNKNOWN',
      confidence: ev.confidence,
      reason: ev.metadata?.reason || ev.event_type,
      image_path: ev.metadata?.image_path || ev.metadata?.evidence_path,
      crop_image_path: ev.metadata?.crop_image_path,
      person_id: ev.metadata?.person_name || ev.metadata?.person_id,
      plate_number: ev.metadata?.plate_number,
      vehicle_id: ev.metadata?.vehicle_id,
    };
    setSelectedEvidence(item);
  };

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* 1. Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              SURVEILLANCE EVENT AUDIT LOGS
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-bold">
              {events.length} LOGGED
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Chronological forensic audit log of biometric matches, ANPR plate scans, and perimeter intrusions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchEvents}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Refresh event log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="p-3 rounded-lg bg-surface border border-surface-border flex flex-wrap items-center justify-between gap-3 shadow-tactical">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-tactical-slate font-bold uppercase mr-1">
            <Filter className="w-3.5 h-3.5 text-tactical-blue" />
            <span>FILTER:</span>
          </div>

          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="px-2.5 py-1 bg-surface-subtle border border-surface-border rounded text-xs text-white focus:outline-none focus:border-tactical-blue"
          >
            <option value="">ALL OPTICAL SENSORS</option>
            {cameras.map((c) => (
              <option key={c.camera_id} value={c.camera_id}>
                {c.camera_id} — {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1 bg-surface-subtle border border-surface-border rounded text-xs text-white focus:outline-none focus:border-tactical-blue"
          >
            <option value="">ALL EVENT CATEGORIES</option>
            <option value="PERSON_DETECTED">Person Detections</option>
            <option value="VEHICLE_DETECTED">Vehicle Detections</option>
            <option value="ANPR_DETECTED">ANPR License Plates</option>
            <option value="INTRUSION_DETECTED">Perimeter Intrusions</option>
            <option value="WATCHLIST_MATCH">Watchlist Matches</option>
            <option value="UNKNOWN_PERSON">Unknown Person Events</option>
            <option value="FLAGGED_PERSON">Flagged Person Events</option>
          </select>
        </div>

        {(selectedCamera || selectedType) && (
          <button
            onClick={() => {
              setSelectedCamera('');
              setSelectedType('');
            }}
            className="text-[11px] text-tactical-slate hover:text-white underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 3. Dense Tactical Events Table */}
      <div className="bg-surface border border-surface-border rounded-lg overflow-hidden shadow-tactical">
        {events.length === 0 && !loading ? (
          <div className="p-12 text-center text-tactical-slate">
            <Clock className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <div className="text-xs font-semibold">NO EVENTS RECORDED</div>
            <div className="text-[10px] text-tactical-slate/70 mt-0.5">
              Live surveillance streams will automatically stream verified events here.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-subtle text-tactical-slate text-[10px] uppercase">
                  <th className="py-2.5 px-3">TIMESTAMP</th>
                  <th className="py-2.5 px-3">CAMERA</th>
                  <th className="py-2.5 px-3">CATEGORY</th>
                  <th className="py-2.5 px-3">TARGET IDENTITY / DETAILS</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">CONFIDENCE</th>
                  <th className="py-2.5 px-3 text-right">EVIDENCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {events.map((ev, idx) => {
                  const isPerson = ev.event_type.includes('PERSON');
                  const isVehicle = ev.event_type.includes('VEHICLE') || ev.event_type.includes('ANPR');
                  const statusStr = ev.metadata?.status || 'UNKNOWN';
                  const isKnown = statusStr === 'KNOWN';
                  const isFlagged = statusStr === 'FLAGGED';
                  const targetName = ev.metadata?.person_name || ev.metadata?.plate_number || ev.event_type;

                  return (
                    <tr
                      key={ev.id || idx}
                      className="hover:bg-surface-subtle/70 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                        {formatFullDateTime(ev.timestamp || ev.created_at)}
                      </td>

                      {/* Camera */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-tactical-blue">
                        {ev.camera_id}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isPerson ? (
                            <User className="w-3.5 h-3.5 text-blue-400" />
                          ) : isVehicle ? (
                            <Car className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-tactical-slate" />
                          )}
                          <span className="text-[11px] font-bold text-slate-200 uppercase">
                            {ev.event_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Target Identity */}
                      <td className="py-2.5 px-3 truncate max-w-sm text-slate-200 font-semibold">
                        {targetName}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isKnown
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : isFlagged
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {statusStr}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-tactical-slate text-[11px]">
                        {ev.confidence ? `${Math.round(ev.confidence * 100)}%` : '—'}
                      </td>

                      {/* Inspect Evidence Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleInspectEvent(ev)}
                          className="px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-elevated text-tactical-blue hover:text-white border border-surface-border text-[10px] font-bold flex items-center gap-1 ml-auto"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Forensics
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forensic Evidence Viewer Modal */}
      {selectedEvidence && (
        <EvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
};
