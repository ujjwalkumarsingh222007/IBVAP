import React, { useState, useCallback, useMemo } from 'react';
import {
  Car,
  Search,
  CheckCircle2,
  Eye,
  Clock,
  Flame,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
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
  const [filterMode, setFilterMode] = useState<'ALL' | 'NORMAL' | 'WATCHLIST'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchANPREvents = useCallback(async () => {
    try {
      const [anprList, watchlistList] = await Promise.all([
        eventsApi.getEvents({ event_type: 'ANPR_DETECTED', limit: 40 }),
        eventsApi.getEvents({ event_type: 'WATCHLIST_MATCH', limit: 40 }),
      ]);

      const map = new Map<number, SurveillanceEvent>();
      [...anprList, ...watchlistList].forEach((ev) => map.set(ev.id, ev));

      const combined = Array.from(map.values()).sort((a, b) => {
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

  const { refreshing, refresh } = usePolling(fetchANPREvents, {
    intervalMs: 3500,
    enabled: true,
    pauseWhenHidden: true,
    immediate: true,
  });

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const isWatchlist = ev.event_type === 'WATCHLIST_MATCH' || Boolean(ev.metadata?.watchlist_match);
      if (filterMode === 'NORMAL' && isWatchlist) return false;
      if (filterMode === 'WATCHLIST' && !isWatchlist) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlate = ev.metadata?.plate_number?.toLowerCase().includes(q);
        const matchCam = ev.camera_id.toLowerCase().includes(q);
        if (!matchPlate && !matchCam) return false;
      }

      return true;
    });
  }, [events, filterMode, searchQuery]);

  const totalDetections = events.length;
  const watchlistHits = events.filter(
    (e) => e.event_type === 'WATCHLIST_MATCH' || Boolean(e.metadata?.watchlist_match)
  ).length;

  return (
    <div className="space-y-6">
      <Header
        title="ANPR & License Plate Intelligence"
        subtitle="Automatic Number Plate Recognition & Target Watchlist Scanner"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono font-semibold uppercase">Total Plates Read</p>
            <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{totalDetections}</p>
          </div>
          <div className="p-3 bg-cyan-950/80 border border-cyan-800 rounded-xl text-cyan-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono font-semibold uppercase">Watchlist Matches</p>
            <p className="text-2xl font-bold font-mono text-red-400 mt-1">{watchlistHits}</p>
          </div>
          <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-400">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono font-semibold uppercase">Normal Flow</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{totalDetections - watchlistHits}</p>
          </div>
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-surface-border rounded-xl p-3.5 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterMode === 'ALL' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('ALL')}
          >
            All ({events.length})
          </Button>
          <Button
            variant={filterMode === 'NORMAL' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('NORMAL')}
          >
            Normal ({events.length - watchlistHits})
          </Button>
          <Button
            variant={filterMode === 'WATCHLIST' ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('WATCHLIST')}
          >
            🚨 Watchlist ({watchlistHits})
          </Button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by plate number or camera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="ANPR Stream Offline"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Simplified Clean ANPR Table */}
      {loading && events.length === 0 ? (
        <CardSkeleton count={4} />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="No License Plate Detections"
          description="Vehicle plates detected by edge optical OCR will appear here."
        />
      ) : (
        <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/40">
                  <th className="py-3.5 pl-4">License Plate</th>
                  <th className="py-3.5">Camera Node</th>
                  <th className="py-3.5">Time</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Confidence</th>
                  <th className="py-3.5 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {filteredEvents.map((item) => {
                  const isWatchlist = item.event_type === 'WATCHLIST_MATCH' || Boolean(item.metadata?.watchlist_match);
                  const plateNum = item.metadata?.plate_number || 'UNKNOWN';
                  const conf = item.metadata?.plate_confidence ?? item.confidence;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isWatchlist ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-yellow-400 tracking-wider">
                            {plateNum}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 text-slate-300 font-semibold">{item.camera_id}</td>
                      <td className="py-3.5 text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {isWatchlist ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold uppercase animate-pulse">
                            <Flame className="w-3 h-3 text-red-400" />
                            🚨 Watchlist ({item.metadata?.watchlist_status || 'FLAGGED'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-300">
                        <span
                          className={`font-semibold ${
                            conf >= 0.85
                              ? 'text-emerald-400'
                              : conf >= 0.65
                              ? 'text-blue-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {(conf * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-4">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedEventId(item.id)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Direct Telemetry Detail Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  );
};

export default ANPR;
