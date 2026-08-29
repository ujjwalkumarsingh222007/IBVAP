import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { KPICards } from '../components/dashboard/KPICards';
import { AnalyticsCharts } from '../components/dashboard/AnalyticsCharts';
import { RecentEventsTable } from '../components/dashboard/RecentEventsTable';
import { EventTimeline } from '../components/events/EventTimeline';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useDashboardSummary } from '../hooks';
import { Radio, Clock, BarChart3 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    summary,
    recentEvents,
    newlyDetectedIds,
    loading,
    refreshing,
    error,
    isPolling,
    lastUpdated,
    refresh,
    togglePolling,
  } = useDashboardSummary({ pollIntervalMs: 3500, recentLimit: 15 });

  const [activeViewTab, setActiveViewTab] = useState<'overview' | 'timeline'>('overview');

  return (
    <div className="space-y-6">
      <Header
        title="Surveillance Command Center"
        subtitle="Real-Time Border AI Threat Intelligence, Perimeter Telemetry & Active Sensor Grid"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Live Polling Status Strip */}
      <div className="bg-surface border border-surface-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isPolling
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <Radio className={`w-4 h-4 ${isPolling ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-100 font-mono">
                {isPolling ? 'LIVE SURVEILLANCE ACTIVE' : 'LIVE POLLING PAUSED'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                Sync: 3.5s
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Last synced: {lastUpdated || 'Connecting to gateway...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch tabs between overview and timeline */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setActiveViewTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors ${
                activeViewTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Overview & Feeds
            </button>
            <button
              onClick={() => setActiveViewTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors ${
                activeViewTab === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Event Timeline
            </button>
          </div>

          <button
            onClick={togglePolling}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {isPolling ? 'Pause' : 'Resume'}
          </button>
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
          <CardSkeleton count={8} />
          <div className="h-64 bg-surface border border-surface-border rounded-xl animate-pulse" />
        </div>
      ) : (
        summary && (
          <div className="space-y-6">
            {/* 8 Metric KPI Cards Grid */}
            <KPICards summary={summary} />

            {activeViewTab === 'overview' ? (
              <>
                {/* Analytics Visualizations */}
                <AnalyticsCharts summary={summary} />

                {/* Real-time Surveillance Detections Table with New Event Flashing */}
                <RecentEventsTable
                  events={recentEvents}
                  loading={refreshing}
                  newlyDetectedIds={newlyDetectedIds}
                />
              </>
            ) : (
              /* Event Chronological Timeline with Interactive Filters */
              <EventTimeline initialLimit={30} autoPoll={isPolling} />
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Dashboard;
