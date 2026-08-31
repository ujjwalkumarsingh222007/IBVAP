import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, Flame, X, Eye, Clock, Car } from 'lucide-react';
import { SurveillanceEvent } from '../types';
import { dashboardApi } from '../api';
import { EventDetailModal } from '../components/events/EventDetailModal';

export interface ToastAlert {
  id: string;
  event: SurveillanceEvent;
  createdAt: number;
}

interface AlertNotificationContextType {
  toasts: ToastAlert[];
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  openEventDetails: (eventId: number) => void;
}

const AlertNotificationContext = createContext<AlertNotificationContextType | undefined>(undefined);

export const AlertNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const seenEventIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  // Background poller for threat notifications
  useEffect(() => {
    let mounted = true;

    const pollHighPriorityThreats = async () => {
      try {
        const recent = await dashboardApi.getRecentEvents(15);
        if (!mounted || !recent) return;

        const newThreats: SurveillanceEvent[] = [];

        recent.forEach((ev) => {
          const isHighThreat =
            ev.event_type === 'WATCHLIST_MATCH' ||
            ev.event_type === 'INTRUSION_DETECTED' ||
            ev.event_type === 'SUSPICIOUS_ACTIVITY';

          if (isHighThreat && !seenEventIdsRef.current.has(ev.id)) {
            if (!initialLoadRef.current) {
              newThreats.push(ev);
            }
          }
          seenEventIdsRef.current.add(ev.id);
        });

        initialLoadRef.current = false;

        if (newThreats.length > 0) {
          const newToasts: ToastAlert[] = newThreats.map((ev) => ({
            id: `${ev.id}-${Date.now()}`,
            event: ev,
            createdAt: Date.now(),
          }));

          setToasts((prev) => [...newToasts, ...prev].slice(0, 5)); // Keep max 5 visible
        }
      } catch {
        // Suppress network errors in toast poller
      }
    };

    pollHighPriorityThreats();
    const interval = setInterval(pollHighPriorityThreats, 3500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const openEventDetails = useCallback((eventId: number) => {
    setSelectedEventId(eventId);
  }, []);

  // Auto-dismiss toasts after 7 seconds
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < 7000));
    }, 1000);

    return () => clearInterval(timer);
  }, [toasts]);

  return (
    <AlertNotificationContext.Provider
      value={{
        toasts,
        dismissToast,
        clearAllToasts,
        openEventDetails,
      }}
    >
      {children}

      {/* Non-Blocking Fixed Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => {
          const ev = toast.event;
          const isWatchlist = ev.event_type === 'WATCHLIST_MATCH';
          const isIntrusion = ev.event_type === 'INTRUSION_DETECTED';

          const title = isWatchlist
            ? 'WATCHLIST MATCH'
            : isIntrusion
            ? 'INTRUSION DETECTED'
            : 'SUSPICIOUS ACTIVITY';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl p-4 shadow-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in slide-in-from-right-5 font-mono ${
                isWatchlist
                  ? 'bg-red-950/95 border-red-500 text-red-100 shadow-red-950/60 ring-1 ring-red-500/50'
                  : isIntrusion
                  ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/60'
                  : 'bg-amber-950/95 border-amber-500 text-amber-100 shadow-amber-950/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      isWatchlist
                        ? 'bg-red-900 text-red-200 animate-pulse'
                        : 'bg-amber-900 text-amber-200'
                    }`}
                  >
                    {isWatchlist ? (
                      <Flame className="w-5 h-5" />
                    ) : isIntrusion ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10 uppercase tracking-widest text-red-300">
                        🚨 SECURITY ALERT
                      </span>
                    </div>
                    <h4 className="text-xs font-bold tracking-wide mt-0.5">{title}</h4>
                  </div>
                </div>

                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Threat Details */}
              <div className="mt-2.5 pt-2 border-t border-white/10 text-xs space-y-1">
                {ev.metadata?.plate_number && (
                  <div className="flex items-center justify-between text-yellow-300 font-bold">
                    <span className="flex items-center gap-1 text-[11px] text-white/70">
                      <Car className="w-3 h-3" /> Plate:
                    </span>
                    <span className="tracking-wider">{ev.metadata.plate_number}</span>
                  </div>
                )}
                {ev.metadata?.watchlist_reason && (
                  <div className="text-[10px] text-red-200 bg-red-900/50 p-1.5 rounded border border-red-800/60 font-sans">
                    ⚠️ {ev.metadata.watchlist_reason}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-white/80">
                  <span className="text-white/60">Camera:</span>
                  <span className="font-semibold">{ev.camera_id}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                  <span>Conf: {(ev.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Action */}
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={() => {
                    openEventDetails(ev.id);
                    dismissToast(toast.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors border border-white/20"
                >
                  <Eye className="w-3 h-3" />
                  Inspect Telemetry
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Detail Modal if opened from toast */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </AlertNotificationContext.Provider>
  );
};

export const useAlertNotifications = () => {
  const context = useContext(AlertNotificationContext);
  if (!context) {
    throw new Error('useAlertNotifications must be used within an AlertNotificationProvider');
  }
  return context;
};
