import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  Crosshair,
  Copy,
  Check,
  AlertTriangle,
  Flame,
  Camera as CameraIcon,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { EventBadge } from '../common/Badge';
import { eventsApi, formatApiError } from '../../api';
import { SurveillanceEvent } from '../../types';
import { getEventSeverity, getSeverityConfig } from '../../utils/severity';

interface EventDetailModalProps {
  eventId: number | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  eventId,
  onClose,
}) => {
  const [event, setEvent] = useState<SurveillanceEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      return;
    }

    setLoading(true);
    setError(null);
    eventsApi
      .getEventById(eventId)
      .then((data) => setEvent(data))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleCopy = () => {
    if (!event) return;
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const meta = event?.metadata || {};
  const bbox = meta.bbox;
  const bboxArray = Array.isArray(bbox) ? bbox : [];
  const position = meta.position;

  // Metadata field extractions (only display if defined and non-null)
  const trackId = meta.track_id !== undefined && meta.track_id !== null ? meta.track_id : null;
  const className = meta.class_name ? String(meta.class_name) : null;
  const plateNumber = meta.plate_number ? String(meta.plate_number) : null;
  const vehicleId = meta.vehicle_id ? String(meta.vehicle_id) : null;
  const ocrConfidence =
    typeof meta.ocr_confidence === 'number' ? meta.ocr_confidence : null;
  const plateConfidence =
    typeof meta.plate_confidence === 'number' ? meta.plate_confidence : null;
  const watchlistStatus = meta.watchlist_status ? String(meta.watchlist_status) : null;
  const watchlistReason = meta.watchlist_reason ? String(meta.watchlist_reason) : null;
  const validationReason = meta.validation_reason ? String(meta.validation_reason) : null;
  const rawOcrText = meta.raw_ocr_text ? String(meta.raw_ocr_text) : null;

  const severity = event ? getEventSeverity(event.event_type) : 'LOW';
  const sevConfig = getSeverityConfig(severity);

  return (
    <Modal
      isOpen={Boolean(eventId)}
      onClose={onClose}
      title={`Surveillance Telemetry — Event #${eventId || ''}`}
      subtitle="Comprehensive edge detection telemetry & raw metadata inspector"
      maxWidth="lg"
    >
      {loading ? (
        <div className="space-y-4 py-4 animate-pulse">
          <div className="h-16 bg-slate-900 rounded-xl" />
          <div className="h-32 bg-slate-900 rounded-xl" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-xl text-red-300 text-xs font-mono">
          {error}
        </div>
      ) : (
        event && (
          <div className="space-y-5 font-mono text-xs">
            {/* Header info */}
            <div className={`flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 border ${sevConfig.borderColor} rounded-xl shadow-md`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg border ${
                  severity === 'CRITICAL'
                    ? 'bg-red-950 text-red-400 border-red-700'
                    : severity === 'HIGH'
                    ? 'bg-rose-950 text-rose-400 border-rose-700'
                    : 'bg-blue-950 text-blue-400 border-blue-800'
                }`}>
                  {severity === 'CRITICAL' ? (
                    <Flame className="w-5 h-5 animate-pulse" />
                  ) : severity === 'HIGH' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Shield className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">
                      Event #{event.id}
                    </span>
                    <EventBadge eventType={event.event_type} />
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}>
                      {sevConfig.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                    <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
                    Camera: <strong className="text-slate-200">{event.camera_id}</strong>
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">
                  Confidence Score
                </span>
                <span
                  className={`text-base font-bold ${
                    event.confidence >= 0.85
                      ? 'text-emerald-400'
                      : event.confidence >= 0.6
                      ? 'text-blue-400'
                      : 'text-amber-400'
                  }`}
                >
                  {(event.confidence * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Core Identification Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5 mb-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Event Timestamp
                </span>
                <span className="text-slate-200 font-semibold block truncate">
                  {event.timestamp.replace('T', ' ').substring(0, 19)} UTC
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5 mb-1 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-blue-400" /> Event Category
                </span>
                <span className="text-slate-200 font-semibold block">
                  {event.event_type}
                </span>
              </div>
            </div>

            {/* Dynamic Metadata Section - Only fields that exist */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Telemetry & Analytics Metadata
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trackId !== null && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">ByteTrack ID</span>
                    <span className="font-bold text-slate-200 text-xs">#{trackId}</span>
                  </div>
                )}

                {className && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Detected Class</span>
                    <span className="font-bold text-cyan-300 text-xs capitalize">{className}</span>
                  </div>
                )}

                {vehicleId && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Vehicle Identifier</span>
                    <span className="font-bold text-purple-300 text-xs">{vehicleId}</span>
                  </div>
                )}

                {plateNumber && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">License Plate</span>
                    <span className="font-bold text-amber-300 text-xs tracking-wider">{plateNumber}</span>
                  </div>
                )}

                {rawOcrText && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Raw OCR Output</span>
                    <span className="font-bold text-slate-300 text-xs">{rawOcrText}</span>
                  </div>
                )}

                {plateConfidence !== null && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">Plate Detection Confidence</span>
                    <span className="font-bold text-emerald-400 text-xs">{(plateConfidence * 100).toFixed(1)}%</span>
                  </div>
                )}

                {ocrConfidence !== null && (
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase">OCR Confidence</span>
                    <span className="font-bold text-emerald-400 text-xs">{(ocrConfidence * 100).toFixed(1)}%</span>
                  </div>
                )}

                {watchlistStatus && (
                  <div className="p-2.5 bg-red-950/40 rounded-lg border border-red-800/60">
                    <span className="text-red-400 block text-[10px] uppercase font-bold">Watchlist Status</span>
                    <span className="font-bold text-red-300 text-xs uppercase">{watchlistStatus}</span>
                  </div>
                )}
              </div>

              {/* Watchlist Reason Warning Banner */}
              {watchlistReason && (
                <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-lg text-red-200">
                  <span className="text-[10px] uppercase font-bold text-red-400 block mb-0.5">
                    🚨 Watchlist Match Trigger Reason:
                  </span>
                  <p className="text-xs font-semibold">{watchlistReason}</p>
                </div>
              )}

              {/* Validation Notes */}
              {validationReason && (
                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center gap-2 text-slate-300 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Validation: {validationReason}</span>
                </div>
              )}
            </div>

            {/* Bounding Box & Coordinates if present */}
            {bboxArray.length === 4 && (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5 mb-2 text-[11px]">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> Bounding Box Coordinates (x1, y1, x2, y2)
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">X1</span>
                    <span className="font-bold text-slate-200">{bboxArray[0]}</span>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">Y1</span>
                    <span className="font-bold text-slate-200">{bboxArray[1]}</span>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">X2</span>
                    <span className="font-bold text-slate-200">{bboxArray[2]}</span>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">Y2</span>
                    <span className="font-bold text-slate-200">{bboxArray[3]}</span>
                  </div>
                </div>
                {position && (
                  <div className="mt-2 text-right text-[11px] text-slate-400">
                    Centroid Position: ({position.x}, {position.y})
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON Payload with Copy */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Raw Common Event Schema (JSON)</span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied Payload</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 bg-slate-950 rounded-xl text-[11px] text-blue-300 overflow-x-auto border border-slate-800 max-h-52 leading-relaxed">
                {JSON.stringify(event, null, 2)}
              </pre>
            </div>
          </div>
        )
      )}
    </Modal>
  );
};

export default EventDetailModal;
