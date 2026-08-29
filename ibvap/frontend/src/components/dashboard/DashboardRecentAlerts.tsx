import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ArrowRight,
  ShieldAlert,
  Flame,
  AlertTriangle,
  UserX,
  Car,
  CheckCircle2,
} from 'lucide-react';
import { SurveillanceEvent } from '../../types';
import { eventsApi } from '../../api/eventsApi';
import { alertRules } from '../../utils/alertRules';

export const DashboardRecentAlerts: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await eventsApi.getEvents({ limit: 50 });
      // Filter ONLY actual alerts requiring operator attention (Known persons / registered vehicles are excluded)
      const actualAlerts = alertRules.filterAlerts(data);
      setAlerts(actualAlerts.slice(0, 5));
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 5000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  const formatAlertItem = (event: SurveillanceEvent) => {
    const cls = alertRules.classify(event);
    const timeStr = event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    let icon = <Car className="w-4 h-4 text-amber-400" />;
    if (cls.badgeType === 'watchlist') {
      icon = <Flame className="w-4 h-4 text-red-400" />;
    } else if (cls.badgeType === 'flagged') {
      icon = <UserX className="w-4 h-4 text-red-400" />;
    } else if (cls.detectionType === 'Intrusion') {
      icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
    } else if (cls.detectionType === 'Suspicious Activity') {
      icon = <ShieldAlert className="w-4 h-4 text-amber-400" />;
    }

    return {
      title: cls.alertTitle,
      color: cls.alertColor,
      bg: cls.alertBg,
      dot: cls.alertDot,
      icon,
      detail: cls.identity !== '—' && cls.identity !== 'Unknown' ? cls.identity : event.camera_id,
      location: event.camera_id,
      time: timeStr,
    };
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="bg-surface border border-surface-border rounded-xl p-5 shadow space-y-3">
        <div className="h-6 w-36 bg-slate-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-md font-mono space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Recent Alerts
          </h3>
        </div>
        <button
          onClick={() => navigate('/alerts')}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold transition-colors"
        >
          <span>View All Alerts</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-lg border border-surface-border/40 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300 font-semibold">No active alerts</span>
          <span>— All monitored activity is currently normal.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const formatted = formatAlertItem(alert);
            return (
              <div
                key={alert.id}
                onClick={() => navigate('/alerts')}
                className={`p-3 rounded-lg border ${formatted.bg} flex items-center justify-between gap-3 hover:opacity-95 cursor-pointer transition-all`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${formatted.dot} animate-pulse`} />
                    {formatted.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-xs ${formatted.color} truncate`}>
                        {formatted.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/80 text-slate-400 border border-slate-800">
                        {formatted.location}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {formatted.detail}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-400 block font-sans font-medium">
                    {formatted.time}
                  </span>
                  <span className="text-[10px] text-blue-400 hover:underline">
                    Inspect
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardRecentAlerts;
