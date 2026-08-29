import React from 'react';
import { KPICards } from '../components/dashboard/KPICards';
import { DashboardCameraGrid } from '../components/dashboard/DashboardCameraGrid';
import { DashboardRecentAlerts } from '../components/dashboard/DashboardRecentAlerts';
import { DashboardRecentEvidence } from '../components/dashboard/DashboardRecentEvidence';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useDashboardSummary } from '../hooks';

export const Dashboard: React.FC = () => {
  const {
    summary,
    loading,
    error,
    refresh,
  } = useDashboardSummary({ pollIntervalMs: 4000, recentLimit: 10 });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Brand & System Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-surface-border/60">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
            IBVAP
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Intelligent Video & Biometric Analysis Platform
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 self-start sm:self-auto font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 font-semibold">System Online</span>
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Surveillance Gateway Offline"
          message={error}
          onRetry={refresh}
        />
      )}

      {loading && !summary ? (
        <div className="space-y-6">
          <CardSkeleton count={4} />
          <div className="h-64 bg-surface border border-surface-border rounded-xl animate-pulse" />
        </div>
      ) : (
        summary && (
          <div className="space-y-6">
            {/* 4 Simple Summary Cards */}
            <KPICards summary={summary} />

            {/* Live Cameras Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Live Cameras
                </h2>
              </div>
              <DashboardCameraGrid />
            </div>

            {/* Recent Alerts Section */}
            <DashboardRecentAlerts />

            {/* Recent Evidence Section */}
            <DashboardRecentEvidence />
          </div>
        )
      )}
    </div>
  );
};

export default Dashboard;
