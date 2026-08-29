import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Flame,
  Car,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { ThreatDetail } from '../../types';
import { threatsApi, formatApiError } from '../../api';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface ThreatTimelineModalProps {
  threatId: string | number;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const ThreatTimelineModal: React.FC<ThreatTimelineModalProps> = ({
  threatId,
  onClose,
  onStatusUpdated,
}) => {
  const [detail, setDetail] = useState<ThreatDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await threatsApi.getThreatById(threatId);
        if (isMounted) {
          setDetail(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(formatApiError(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [threatId]);

  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED') => {
    if (!detail) return;
    try {
      setUpdating(true);
      const updated = await threatsApi.updateThreatStatus(detail.threat_id, {
        status: newStatus,
        reason: `Status changed to ${newStatus} by operator console`,
      });
      setDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      onStatusUpdated?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'WATCHLIST_MATCH':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'INTRUSION_DETECTED':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'SUSPICIOUS_ACTIVITY':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'ANPR_DETECTED':
      case 'VEHICLE_DETECTED':
        return <Car className="w-4 h-4 text-blue-400" />;
      case 'PERSON_DETECTED':
      default:
        return <UserCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge variant={detail?.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                {detail?.severity || 'THREAT'}
              </Badge>
              <span className="font-mono text-xs font-bold text-slate-400">
                {detail?.threat_id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {detail?.camera_id}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                  detail?.status === 'ACTIVE'
                    ? 'bg-red-950/80 text-red-400 border border-red-800/80'
                    : detail?.status === 'ACKNOWLEDGED'
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                    : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                }`}
              >
                STATUS: {detail?.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{detail?.title}</h2>
            <p className="text-xs text-slate-400">{detail?.reason}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-800/60 rounded-xl animate-pulse" />
              <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
              <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
            </div>
          ) : detail ? (
            <>
              {/* Threat Score & Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">
                    Threat Score
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-400 flex items-baseline gap-1">
                    {detail.score}
                    <span className="text-xs font-normal text-slate-500">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        detail.score >= 85
                          ? 'bg-red-500'
                          : detail.score >= 65
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(detail.score, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">
                    Correlated Events
                  </div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    {detail.event_count}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Across Member 1 CV & Member 2 ANPR
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">
                    Timeline Span
                  </div>
                  <div className="text-xs font-mono text-slate-200 truncate pt-1">
                    {detail.first_event_time.slice(11, 19)} → {detail.last_event_time.slice(11, 19)}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Same-Camera Window Sync
                  </div>
                </div>
              </div>

              {/* Chronological Event Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wide">
                    Correlated Event Timeline
                  </h3>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {detail.timeline.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2">
                      No contributing events recorded.
                    </div>
                  ) : (
                    detail.timeline.map((item, idx) => (
                      <div key={idx} className="relative group">
                        {/* Timeline node icon */}
                        <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow">
                          {getEventIcon(item.event_type)}
                        </div>

                        {/* Timeline Event Card */}
                        <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-1.5 transition-colors">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-200">
                                {item.event_type}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                                Conf: {Math.round(item.confidence * 100)}%
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-400">
                              {item.timestamp.replace('T', ' ').slice(0, 19)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300">{item.description}</p>

                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-mono">
                              {Boolean(item.metadata.plate_number) && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/80 font-bold">
                                  🚗 {String(item.metadata.plate_number)}
                                </span>
                              )}
                              {item.metadata.track_id !== undefined && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                  Track #{String(item.metadata.track_id)}
                                </span>
                              )}
                              {Boolean(item.metadata.fence_zone) && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/80">
                                  Zone: {String(item.metadata.fence_zone)}
                                </span>
                              )}
                              {Boolean(item.metadata.watchlist_status) && (
                                <span className="px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/80 font-bold animate-pulse">
                                  🚨 {String(item.metadata.watchlist_status)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={detail?.status === 'ACKNOWLEDGED' ? 'primary' : 'outline'}
              disabled={updating || detail?.status === 'ACKNOWLEDGED'}
              onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
            >
              Acknowledge
            </Button>
            <Button
              size="sm"
              variant={detail?.status === 'RESOLVED' ? 'secondary' : 'outline'}
              disabled={updating || detail?.status === 'RESOLVED'}
              onClick={() => handleUpdateStatus('RESOLVED')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Resolve Threat
            </Button>
          </div>

          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
