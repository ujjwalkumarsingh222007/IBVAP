import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { alertsService } from '../services/alertsService';
import { Alert } from '../types/alert';
import { getSeverityBadge, getAlertStatusBadge, formatTimestamp } from '../utils/formatters';
import { Bell, ShieldAlert, CheckCircle2, AlertOctagon } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAlerts() {
      setLoading(true);
      try {
        const data = await alertsService.getAlerts();
        setAlerts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAlerts();
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      const updated = await alertsService.acknowledgeAlert(id);
      setAlerts(alerts.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner label="Loading Threat Alerts Feed..." />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Active Security Alerts & Threat Feed"
        subtitle="Automated alerts generated from high-risk events, watchlist hits, and border intrusion detectors"
        icon={<Bell size={22} />}
      />

      <div className="space-y-4">
        {alerts.map((alert) => {
          const sev = getSeverityBadge(alert.severity);
          const stat = getAlertStatusBadge(alert.status);
          return (
            <Card key={alert.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`p-3 rounded-xl ${sev.bg}`}>
                  <AlertOctagon size={22} className={sev.text} />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sev.bg}`}>
                      {alert.severity}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${stat.bg}`}>
                      {alert.status}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-semibold">{alert.camera_id}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100">{alert.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">{alert.description}</p>
                  
                  {alert.acknowledged_by && (
                    <p className="text-[10px] font-mono text-emerald-400 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Acked by: {alert.acknowledged_by}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                <span className="text-[11px] font-mono text-slate-400">{formatTimestamp(alert.timestamp)}</span>
                {alert.status === 'UNACKNOWLEDGED' && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-xs rounded-lg border border-red-500/40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert size={14} /> Acknowledge Alert
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
