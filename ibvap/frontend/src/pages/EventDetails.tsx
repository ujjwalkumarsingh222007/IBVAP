import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Video,
  Clock,
  Target,
  Crosshair,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { EventBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { eventsApi, formatApiError } from '../api';
import { SurveillanceEvent } from '../types';

export const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<SurveillanceEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    eventsApi
      .getEventById(Number(id))
      .then((data) => setEvent(data))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopyJson = () => {
    if (!event) return;
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bbox = event?.metadata?.bbox;
  const bboxArray = Array.isArray(bbox) ? bbox : [];
  const position = event?.metadata?.position;

  return (
    <div className="space-y-6">
      <Header
        title={`Event Detail — #${id || ''}`}
        subtitle="Forensic Detection Telemetry, Bounding Box Coordinates & Metadata"
      />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/events')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Events
        </Button>
      </div>

      {error && (
        <ErrorMessage
          title="Event Not Found"
          message={error}
          onRetry={() => navigate('/events')}
        />
      )}

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 bg-surface border border-surface-border rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-surface border border-surface-border rounded-xl" />
            <div className="h-64 bg-surface border border-surface-border rounded-xl" />
          </div>
        </div>
      ) : (
        event && (
          <div className="space-y-6">
            {/* Header Telemetry Card */}
            <div className="bg-surface border border-surface-border rounded-xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border/60">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-blue-400">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-mono text-white">
                        Event #{event.id}
                      </span>
                      <EventBadge eventType={event.event_type} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Category Identifier: <strong className="text-slate-200">{event.event_type}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-mono">
                    <span className="text-xs text-slate-400 block">Detection Confidence</span>
                    <span
                      className={`text-2xl font-bold ${
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
              </div>

              {/* Core Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                    Camera Source
                  </span>
                  <Link
                    to={`/cameras`}
                    className="text-base font-bold text-blue-400 hover:underline"
                  >
                    {event.camera_id}
                  </Link>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Detection Timestamp
                  </span>
                  <span className="text-sm font-semibold text-slate-200 block">
                    {event.timestamp.replace('T', ' ').substring(0, 19)}
                  </span>
                  <span className="text-[11px] text-slate-500">{event.timestamp}</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    ByteTrack ID
                  </span>
                  <span className="text-base font-bold text-slate-100">
                    {event.metadata?.track_id !== undefined
                      ? `#${event.metadata.track_id}`
                      : 'Unassigned'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                    Class Label
                  </span>
                  <span className="text-base font-bold text-purple-300 uppercase">
                    {event.metadata?.class_name || 'Object'}
                  </span>
                </div>
              </div>
            </div>

            {/* Coordinates & Bounding Box Visualizer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bounding Box Visual Box */}
              <Card
                title="Spatial Geometry & Coordinates"
                subtitle="Relative pixel box boundaries on source video frame"
                icon={<Crosshair className="w-4 h-4 text-cyan-400" />}
              >
                <div className="space-y-4 font-mono text-xs">
                  {bboxArray.length === 4 ? (
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">X1 (Left)</span>
                          <span className="font-bold text-slate-200 text-sm">{bboxArray[0]}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Y1 (Top)</span>
                          <span className="font-bold text-slate-200 text-sm">{bboxArray[1]}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">X2 (Right)</span>
                          <span className="font-bold text-slate-200 text-sm">{bboxArray[2]}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Y2 (Bottom)</span>
                          <span className="font-bold text-slate-200 text-sm">{bboxArray[3]}</span>
                        </div>
                      </div>

                      {/* Spatial Detection Target Preview */}
                      <div className="relative h-44 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                        <div className="relative z-10 p-4 border-2 border-dashed border-blue-500/60 bg-blue-950/30 rounded text-center">
                          <span className="text-blue-400 font-bold block">
                            {event.metadata?.class_name || 'Target'} #{event.metadata?.track_id}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            W: {Math.abs(bboxArray[2] - bboxArray[0])}px × H:{' '}
                            {Math.abs(bboxArray[3] - bboxArray[1])}px
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 py-6 text-center">
                      No bounding box coordinates provided in event metadata.
                    </p>
                  )}

                  {position && (
                    <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-slate-300">
                      <span>Centroid Position:</span>
                      <span className="font-bold text-slate-100">
                        X: {position.x}, Y: {position.y}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Raw JSON Payload */}
              <Card
                title="Common Event Contract JSON"
                subtitle="Authoritative payload transmitted over HTTP"
                icon={<Code className="w-4 h-4 text-purple-400" />}
                action={
                  <button
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-mono">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                }
              >
                <pre className="p-4 bg-slate-950 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto border border-slate-800 max-h-72 leading-relaxed">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </Card>
            </div>
          </div>
        )
      )}
    </div>
  );
};
