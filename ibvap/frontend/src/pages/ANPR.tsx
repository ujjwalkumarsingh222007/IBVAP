import React, { useState, useCallback, useMemo } from 'react';
import {
  Car,
  Search,
  CheckCircle2,
  AlertOctagon,
  ShieldCheck,
  Eye,
  Camera as CameraIcon,
  Clock,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { eventsApi, formatApiError } from '../api';
import { SurveillanceEvent } from '../types';
import { usePolling } from '../hooks';

export const ANPR: React.FC = () => {
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'STANDARD' | 'WATCHLIST'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchANPREvents = useCallback(async () => {
    try {
      const [anprList, watchlistList] = await Promise.all([
        eventsApi.getEvents({ event_type: 'ANPR_DETECTED', limit: 30 }),
        eventsApi.getEvents({ event_type: 'WATCHLIST_MATCH', limit: 30 }),
      ]);

      const map = new Map<number, SurveillanceEvent>();
      [...anprList, ...watchlistList].forEach((ev) => map.set(ev.id, ev));

      const combined = Array.from(map.values()).sort((a, b) => {
        // Watchlist matches first, then newest timestamp
        const isWatchlistA = a.event_type === 'WATCHLIST_MATCH' || a.metadata?.watchlist_match ? 1 : 0;
        const isWatchlistB = b.event_type === 'WATCHLIST_MATCH' || b.metadata?.watchlist_match ? 1 : 0;
        if (isWatchlistB !== isWatchlistA) return isWatchlistB - isWatchlistA;

        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA || b.id - a.id;
      });

      setEvents(combined);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, refresh } = usePolling(
    fetchANPREvents,
    {
      intervalMs: 3500,
      enabled: true,
      pauseWhenHidden: true,
      immediate: true,
    }
  );

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const isWatchlist = ev.event_type === 'WATCHLIST_MATCH' || Boolean(ev.metadata?.watchlist_match);
      if (filterMode === 'STANDARD' && isWatchlist) return false;
      if (filterMode === 'WATCHLIST' && !isWatchlist) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlate = ev.metadata?.plate_number?.toLowerCase().includes(q);
        const matchRaw = ev.metadata?.raw_ocr_text?.toLowerCase().includes(q);
        const matchVeh = ev.metadata?.vehicle_id?.toLowerCase().includes(q);
        const matchCam = ev.camera_id.toLowerCase().includes(q);
        if (!matchPlate && !matchRaw && !matchVeh && !matchCam) return false;
      }

      return true;
    });
  }, [events, filterMode, searchQuery]);

  const totalDetections = events.length;
  const watchlistHits = events.filter(
    (e) => e.event_type === 'WATCHLIST_MATCH' || Boolean(e.metadata?.watchlist_match)
  ).length;
  const verifiedIndianPlates = events.filter(
    (e) => e.metadata?.validation_passed
  ).length;

  return (
    <div className="space-y-6">
      <Header
        title="ANPR Live Intelligence Hub"
        subtitle="Automatic Number Plate Recognition, Optical Character Verification & Hotlist Scanner (3.5s Sync)"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono font-semibold uppercase">Total Plates Read</p>
            <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{totalDetections}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Continuous ANPR telemetry stream</p>
          </div>
          <div className="p-3 bg-cyan-950/80 border border-cyan-800 rounded-xl text-cyan-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-red-800/70 rounded-xl p-4 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-red-400 font-mono font-bold uppercase">Watchlist Hits</p>
            <p className="text-2xl font-bold font-mono text-red-300 mt-1">{watchlistHits}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Stolen & wanted hotlist matches</p>
          </div>
          <div className="p-3 bg-red-950/90 border border-red-700 rounded-xl text-red-400 relative z-10">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-surface border border-emerald-900/50 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-400 font-mono font-semibold uppercase">Format Validated</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {totalDetections > 0 ? ((verifiedIndianPlates / totalDetections) * 100).toFixed(0) : 100}%
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Indian State/UT RTO structure</p>
          </div>
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterMode === 'ALL' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('ALL')}
          >
            All Plates ({events.length})
          </Button>
          <Button
            variant={filterMode === 'STANDARD' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('STANDARD')}
          >
            Standard ({events.length - watchlistHits})
          </Button>
          <Button
            variant={filterMode === 'WATCHLIST' ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('WATCHLIST')}
          >
            🚨 Watchlist Hits ({watchlistHits})
          </Button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plate (e.g. DL01, MH12), vehicle, camera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="ANPR Live Stream Warning"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Plates Feed */}
      {loading && events.length === 0 ? (
        <CardSkeleton count={4} />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="No ANPR Records Found"
          description="No vehicle license plate records match the selected query criteria."
          action={
            <Button variant="outline" size="sm" onClick={refresh}>
              Refresh ANPR Data
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((item) => {
            const isWatchlist = item.event_type === 'WATCHLIST_MATCH' || Boolean(item.metadata?.watchlist_match);
            const plateNum = item.metadata?.plate_number || 'UNKNOWN';
            const rawOcr = item.metadata?.raw_ocr_text || plateNum;
            const vehicleId = item.metadata?.vehicle_id || 'VEH-AUTO';
            const plateConf = item.metadata?.plate_confidence ?? item.confidence;
            const ocrConf = item.metadata?.ocr_confidence ?? item.confidence;
            const stateReason = item.metadata?.validation_reason || 'Verified Indian Registration';

            return (
              <div
                key={item.id}
                className={`bg-surface border rounded-xl p-5 shadow-lg relative overflow-hidden transition-all duration-200 hover:border-slate-400 flex flex-col justify-between ${
                  isWatchlist
                    ? 'border-red-600/80 bg-red-950/20 shadow-red-950/30'
                    : 'border-surface-border bg-slate-900/60'
                }`}
              >
                {/* Watchlist Top Pulse Glow */}
                {isWatchlist && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 shadow-[0_0_10px_#ef4444]" />
                )}

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      {isWatchlist ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-950 text-red-300 border border-red-700 text-[11px] font-mono font-bold uppercase animate-pulse">
                          <Flame className="w-3.5 h-3.5 text-red-400" />
                          🚨 WATCHLIST MATCH
                        </span>
                      ) : (
                        <Badge variant={item.event_type} />
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      ID #{item.id}
                    </span>
                  </div>

                  {/* Indian HSRP High-Security Registration Plate Visual */}
                  <div className={`my-3 p-3 rounded-lg bg-slate-950 border-2 relative overflow-hidden flex items-center justify-between shadow-inner ${
                    isWatchlist ? 'border-red-600/80 ring-1 ring-red-500/40' : 'border-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-8 bg-blue-700 rounded-sm flex flex-col items-center justify-between py-1 text-[7px] text-white font-bold leading-none">
                        <span>IND</span>
                        <div className="w-2 h-2 rounded-full border border-white/60"></div>
                      </div>
                      <div>
                        <span className="text-xl font-bold font-mono text-yellow-400 tracking-widest drop-shadow">
                          {plateNum}
                        </span>
                        <p className="text-[9px] text-slate-500 font-mono">
                          Raw OCR: <span className="text-slate-400">{rawOcr}</span>
                        </p>
                      </div>
                    </div>

                    {isWatchlist ? (
                      <div className="px-2 py-1 rounded bg-red-950 text-red-300 border border-red-700 text-[10px] font-bold font-mono uppercase animate-pulse text-right">
                        <span>Status: {item.metadata?.watchlist_status || 'STOLEN'}</span>
                      </div>
                    ) : (
                      <div className="text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Metadata Telemetry Grid */}
                  <div className="space-y-2 text-xs font-mono text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CameraIcon className="w-3.5 h-3.5 text-cyan-400" /> Origin Camera:
                      </span>
                      <span className="font-bold text-slate-100">{item.camera_id}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-purple-400" /> Vehicle ID:
                      </span>
                      <span className="font-bold text-purple-300">{vehicleId}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Plate Conf:</span>
                      <span className="text-slate-200 font-semibold">{(plateConf * 100).toFixed(1)}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">OCR Conf:</span>
                      <span className="text-slate-200 font-semibold">{(ocrConf * 100).toFixed(1)}%</span>
                    </div>

                    <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] flex items-center gap-1.5 text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{stateReason}</span>
                    </div>

                    {isWatchlist && item.metadata?.watchlist_reason && (
                      <div className="p-2.5 rounded bg-red-950/80 border border-red-800/80 text-[10px] text-red-200">
                        <span className="font-bold block text-red-400">⚠️ WATCHLIST TRIGGER:</span>
                        <span>{item.metadata.watchlist_reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setSelectedEventId(item.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Telemetry Inspection Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
};

export default ANPR;
