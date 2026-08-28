import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { alertsService } from '../services/alertsService';
import { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import { getSeverityBadge, getAlertStatusBadge, formatTimestamp } from '../utils/formatters';
import { Bell, ShieldAlert, CheckCircle2, AlertOctagon, XCircle, FileText } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [activeAlertModal, setActiveAlertModal] = useState<Alert | null>(null);

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

  const handleResolve = async (id: string) => {
    try {
      const updated = await alertsService.resolveAlert(id, 'Resolved via Control Room Operator Panel');
      setAlerts(alerts.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const updated = await alertsService.dismissAlert(id);
      setAlerts(alerts.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAlerts = selectedSeverity === 'ALL'
    ? alerts
    : alerts.filter(a => a.severity === selectedSeverity);

  if (loading) return <SkeletonLoader type="card" count={3} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Active Security Alerts & Threat Feed"
        subtitle="Automated alerts generated from high-risk events, watchlist hits, and border intrusion detectors"
        icon={<Bell size={22} />}
      />

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 pb-2">
        <span className="text-xs text-slate-400 font-mono">Severity:</span>
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setSelectedSeverity(sev)}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
              selectedSeverity === sev
                ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                : 'bg-[#121824] text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredAlerts.map((alert) => {
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
                      <CheckCircle2 size={12} /> Acked: {alert.acknowledged_by}
                    </p>
                  )}

                  {alert.resolution_notes && (
                    <p className="text-[10px] font-mono text-slate-400 mt-1 italic">
                      Resolution Note: "{alert.resolution_notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Alert Actions Controls */}
              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                <span className="text-[11px] font-mono text-slate-400">{formatTimestamp(alert.timestamp)}</span>
                
                <div className="flex items-center gap-1.5 flex-wrap">
                  {alert.status === 'UNACKNOWLEDGED' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-xs rounded-lg border border-red-500/40 transition-colors flex items-center gap-1"
                    >
                      <ShieldAlert size={13} /> Acknowledge
                    </button>
                  )}

                  {(alert.status === 'UNACKNOWLEDGED' || alert.status === 'INVESTIGATING') && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-xs rounded-lg border border-emerald-500/40 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Mark Resolved
                    </button>
                  )}

                  {alert.status !== 'DISMISSED' && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-mono text-xs rounded-lg border border-slate-800 transition-colors"
                      title="Dismiss alert"
                    >
                      <XCircle size={13} />
                    </button>
                  )}

                  <button
                    onClick={() => setActiveAlertModal(alert)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 font-mono text-xs rounded-lg border border-slate-800 transition-colors"
                    title="View alert details"
                  >
                    <FileText size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Alert Details Modal */}
      {activeAlertModal && (
        <Modal
          isOpen={!!activeAlertModal}
          onClose={() => setActiveAlertModal(null)}
          title={`Alert Details (${activeAlertModal.id})`}
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <div className="text-cyan-400 font-bold">{activeAlertModal.title}</div>
              <div className="text-slate-400">{activeAlertModal.description}</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300">
              <div>Camera ID: <span className="text-cyan-400">{activeAlertModal.camera_id}</span></div>
              <div>Event Type: <span className="text-emerald-400">{activeAlertModal.event_type}</span></div>
              <div>Severity: <span className="text-red-400">{activeAlertModal.severity}</span></div>
              <div>Status: <span className="text-amber-400">{activeAlertModal.status}</span></div>
              <div>Timestamp: <span className="text-slate-400">{formatTimestamp(activeAlertModal.timestamp)}</span></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
