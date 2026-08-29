import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Camera as CameraIcon,
  Clock,
  UserX,
  Car,
  AlertTriangle,
  Flame,
  X,
  CheckCircle2,
  Video,
  FileImage,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/common/Button';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { eventsApi, formatApiError } from '../api';
import { SurveillanceEvent } from '../types';
import { usePolling } from '../hooks';
import { alertRules } from '../utils/alertRules';

type CategoryFilter = 'ALL' | 'PERSON' | 'VEHICLE' | 'INTRUSION' | 'WATCHLIST';

export const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const [rawEvents, setRawEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<SurveillanceEvent | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await eventsApi.getEvents({ limit: 100 });
      setRawEvents(data);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, refresh } = usePolling(fetchAlerts, {
    intervalMs: 4000,
    enabled: true,
    pauseWhenHidden: true,
    immediate: true,
  });

  // Filter ONLY actual alerts using alertRules (known people / registered vehicles are strictly excluded)
  const actualAlerts = useMemo(() => {
    return alertRules.filterAlerts(rawEvents);
  }, [rawEvents]);

  const filteredAlerts = useMemo(() => {
    return actualAlerts.filter((ev) => {
      const cls = alertRules.classify(ev);

      if (activeFilter === 'PERSON' && cls.detectionType !== 'Person') return false;
      if (activeFilter === 'VEHICLE' && cls.detectionType !== 'Vehicle') return false;
      if (activeFilter === 'INTRUSION' && cls.detectionType !== 'Intrusion') return false;
      if (activeFilter === 'WATCHLIST' && cls.badgeType !== 'watchlist') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCam = ev.camera_id.toLowerCase().includes(q);
        const matchPlate = ev.metadata?.plate_number ? String(ev.metadata.plate_number).toLowerCase().includes(q) : false;
        const matchTitle = cls.alertTitle.toLowerCase().includes(q);
        if (!matchCam && !matchPlate && !matchTitle) return false;
      }

      return true;
    });
  }, [actualAlerts, activeFilter, searchTerm]);

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Alerts"
        subtitle="Security notifications requiring immediate operator attention"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'PERSON', 'VEHICLE', 'INTRUSION', 'WATCHLIST'] as CategoryFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === f
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f === 'ALL' ? `All (${actualAlerts.length})` : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Alert Feed Error"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Alert Cards Grid */}
      {loading && actualAlerts.length === 0 ? (
        <CardSkeleton count={4} />
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-surface-border rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">No Active Alerts</h3>
            <p className="text-xs text-slate-400 mt-1">
              All monitored activity is currently normal. Known persons and registered vehicles do not trigger alerts.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map((alert) => {
            const cls = alertRules.classify(alert);
            const isWatchlist = cls.badgeType === 'watchlist';
            const isFlaggedPerson = cls.badgeType === 'flagged';
            const timeFormatted = alert.timestamp
              ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Recent';

            let icon = <Car className="w-4 h-4 text-amber-400" />;
            if (isWatchlist) icon = <Flame className="w-4 h-4 text-red-400" />;
            else if (isFlaggedPerson) icon = <UserX className="w-4 h-4 text-red-400" />;
            else if (cls.detectionType === 'Intrusion') icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;

            return (
              <div
                key={alert.id}
                className={`bg-surface border ${cls.alertBg} rounded-xl p-4 shadow-md flex flex-col justify-between transition-all hover:border-slate-400`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${cls.alertDot} animate-pulse`} />
                      {icon}
                      <span className={`text-xs font-bold ${cls.alertColor} uppercase`}>
                        {cls.alertTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      #{alert.id}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">
                    {cls.identity !== '—' && cls.identity !== 'Unknown' ? (
                      <p className="font-semibold text-slate-200">
                        Target: <span className="font-mono text-yellow-300">{cls.identity}</span>
                      </p>
                    ) : (
                      <p className="text-slate-400">
                        {isFlaggedPerson ? 'Unknown person detected' : 'Perimeter event'}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
                      {alert.camera_id}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500 font-sans">
                      <Clock className="w-3 h-3 text-slate-600" />
                      {timeFormatted}
                    </span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/60 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSelectedAlert(alert);
                      setShowTechnicalDetails(false);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (() => {
        const cls = alertRules.classify(selectedAlert);
        const meta = selectedAlert.metadata || {};

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
            <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cls.alertDot} animate-pulse`} />
                  <h3 className="text-sm font-bold text-white uppercase">
                    {cls.alertTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Camera:</span>
                    <span className="text-cyan-400 font-semibold">{selectedAlert.camera_id}</span>
                  </div>

                  {meta.plate_number && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Plate Number:</span>
                      <strong className="text-yellow-400 font-bold">{String(meta.plate_number)}</strong>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-400">Time:</span>
                    <span className="text-slate-300 font-sans">
                      {new Date(selectedAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Confidence:</span>
                    <span className="text-emerald-400 font-semibold">
                      {Math.round(selectedAlert.confidence * 100)}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-bold uppercase ${cls.alertColor}`}>
                      {cls.badgeType === 'watchlist'
                        ? 'WATCHLIST'
                        : cls.badgeType === 'flagged'
                        ? 'UNKNOWN / FLAGGED'
                        : 'ALERT'}
                    </span>
                  </div>

                  {meta.watchlist_reason && (
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Reason:</span>
                      <span className="text-red-300 font-sans">{String(meta.watchlist_reason)}</span>
                    </div>
                  )}
                </div>

                {/* Progressive Disclosure: Technical Details */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium font-sans"
                  >
                    {showTechnicalDetails ? '− Hide Technical Details' : '+ Technical Details (Raw Metadata & Coordinates)'}
                  </button>

                  {showTechnicalDetails && (
                    <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
                      <pre className="text-[11px] text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(selectedAlert.metadata || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedAlert(null);
                      navigate('/evidence');
                    }}
                    icon={<FileImage className="w-3.5 h-3.5" />}
                  >
                    View Evidence
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAlert(null);
                      navigate('/cameras');
                    }}
                    icon={<Video className="w-3.5 h-3.5" />}
                  >
                    View Camera
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedAlert(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Alerts;
