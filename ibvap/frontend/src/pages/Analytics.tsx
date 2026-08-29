import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Radio,
  Filter,
  Camera as CameraIcon,
  PieChart as PieChartIcon,
  RefreshCw,
  Video,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { CameraEventsModal } from '../components/cameras/CameraEventsModal';
import { cameraApi } from '../api';
import { Camera, EventType } from '../types';
import { useAnalytics, TimeRangePreset } from '../hooks/useAnalytics';
import { getSeverityConfig } from '../utils/severity';

const EVENT_TYPE_OPTIONS: { label: string; value: EventType }[] = [
  { label: 'All Event Types', value: 'ALL' },
  { label: 'Watchlist Match (Critical)', value: 'WATCHLIST_MATCH' },
  { label: 'Intrusions (High)', value: 'INTRUSION_DETECTED' },
  { label: 'Suspicious Activity (High)', value: 'SUSPICIOUS_ACTIVITY' },
  { label: 'Vehicles (Medium)', value: 'VEHICLE_DETECTED' },
  { label: 'ANPR Reads (Low)', value: 'ANPR_DETECTED' },
  { label: 'Person Detections (Low)', value: 'PERSON_DETECTED' },
  { label: 'Object Detections (Low)', value: 'OBJECT_DETECTED' },
];

const TIME_RANGE_OPTIONS: { label: string; value: TimeRangePreset }[] = [
  { label: 'Last 1 Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'All Time', value: 'all' },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  WATCHLIST_MATCH: '#ef4444',
  INTRUSION_DETECTED: '#f43f5e',
  SUSPICIOUS_ACTIVITY: '#f97316',
  VEHICLE_DETECTED: '#f59e0b',
  ANPR_DETECTED: '#06b6d4',
  PERSON_DETECTED: '#3b82f6',
  OBJECT_DETECTED: '#8b5cf6',
};

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('24h');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [interval, setInterval] = useState<'hourly' | 'daily'>('hourly');
  const [camerasList, setCamerasList] = useState<Camera[]>([]);
  const [selectedCamForModal, setSelectedCamForModal] = useState<Camera | null>(null);

  // Load cameras for filtering
  useEffect(() => {
    cameraApi
      .getCameras()
      .then((cams) => setCamerasList(cams))
      .catch(() => {});
  }, []);

  const {
    summary,
    trends,
    distribution,
    cameras,
    loading,
    refreshing,
    error,
    lastUpdated,
    isPolling,
    refresh,
    togglePolling,
  } = useAnalytics({
    timeRange,
    cameraId: selectedCamera,
    eventType: selectedEventType,
    interval,
    pollIntervalMs: 5000,
  });

  const handleResetFilters = () => {
    setTimeRange('24h');
    setSelectedCamera('');
    setSelectedEventType('ALL');
    setInterval('hourly');
  };

  const hasActiveFilters =
    timeRange !== '24h' || selectedCamera !== '' || selectedEventType !== 'ALL' || interval !== 'hourly';

  const totalEvents = summary?.total_events || 0;
  const threats = summary?.threats;
  const confStats = summary?.confidence_stats;

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Operational Analytics & Threat Intelligence"
        subtitle="Deep-Dive Event Aggregation, Threat Density Trends & Sensor Grid Intelligence"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Control & Time Range Toolbar */}
      <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[11px] mr-2">Time Window:</span>
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  timeRange === opt.value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Polling & Refresh Actions */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
              <Radio className={`w-3.5 h-3.5 ${isPolling ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-[11px]">Sync: {lastUpdated || 'Connecting...'}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={togglePolling}
            >
              {isPolling ? 'Pause Sync' : 'Resume Sync'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              loading={refreshing}
              onClick={refresh}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync
            </Button>
          </div>
        </div>

        {/* Dynamic Multi-Filter Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold">Filters:</span>
            </div>

            {/* Camera Selector */}
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Camera Nodes</option>
              {camerasList.map((cam) => (
                <option key={cam.camera_id} value={cam.camera_id}>
                  {cam.camera_id} — {cam.name}
                </option>
              ))}
            </select>

            {/* Event Type Selector */}
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Granularity Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setInterval('hourly')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  interval === 'hourly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hourly
              </button>
              <button
                onClick={() => setInterval('daily')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  interval === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily
              </button>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-blue-400 hover:text-blue-300 underline text-xs"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Analytics Telemetry Sync Error"
          message={error}
          onRetry={refresh}
        />
      )}

      {loading && !summary ? (
        <div className="space-y-6">
          <CardSkeleton count={6} />
          <div className="h-72 bg-surface border border-surface-border rounded-xl animate-pulse" />
        </div>
      ) : totalEvents === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-12 h-12 text-slate-500 stroke-[1.5]" />}
          title="No Analytics Data for Selected Range"
          description="There are no surveillance events matching the selected time window and filter criteria."
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filter Parameters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* 6 Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Total Detections */}
            <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Events</span>
                <div className="p-2 bg-blue-950 border border-blue-800 rounded-lg text-blue-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-white">{totalEvents}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Ingested Telemetry</p>
              </div>
            </div>

            {/* Total Threats */}
            <div className="bg-surface border border-rose-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-950/30 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Threat Index</span>
                <div className="p-2 bg-rose-950 border border-rose-700 rounded-lg text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 relative z-10">
                <p className="text-2xl font-bold text-rose-300">{threats?.total_threats || 0}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {totalEvents > 0 ? (((threats?.total_threats || 0) / totalEvents) * 100).toFixed(0) : 0}% of stream
                </p>
              </div>
            </div>

            {/* Critical Watchlist Hits */}
            <div className="bg-surface border border-red-800/90 rounded-xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Critical Hits</span>
                <div className="p-2 bg-red-950 border border-red-700 rounded-lg text-red-400">
                  <Flame className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="mt-2 relative z-10">
                <p className="text-2xl font-bold text-red-300">{threats?.critical || 0}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Hotlist Matches</p>
              </div>
            </div>

            {/* High Severity */}
            <div className="bg-surface border border-amber-800/70 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">High Threats</span>
                <div className="p-2 bg-amber-950 border border-amber-800 rounded-lg text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-amber-300">{threats?.high || 0}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Intrusions & Suspicious</p>
              </div>
            </div>

            {/* Avg Confidence */}
            <div className="bg-surface border border-emerald-800/70 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Avg Confidence</span>
                <div className="p-2 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-emerald-300">
                  {confStats ? (confStats.avg_confidence * 100).toFixed(1) : 0}%
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Range: {confStats ? (confStats.min_confidence * 100).toFixed(0) : 0}%–
                  {confStats ? (confStats.max_confidence * 100).toFixed(0) : 0}%
                </p>
              </div>
            </div>

            {/* Active Monitored Cameras */}
            <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Active Nodes</span>
                <div className="p-2 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400">
                  <CameraIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold text-cyan-300">{cameras?.cameras.length || 0}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Active Surveillance Nodes</p>
              </div>
            </div>
          </div>

          {/* Time-Series Trend Chart (Recharts AreaChart) */}
          <Card
            title={`Surveillance & Threat Time-Series Trends (${interval.toUpperCase()})`}
            subtitle="Chronological progression of total detections, perimeter intrusions, and hotlist matches"
            icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          >
            {trends && trends.trends.length > 0 ? (
              <div className="h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends.trends} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorIntrusions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWatchlist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="bucket"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: '16px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_events"
                      name="Total Detections"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="intrusions"
                      name="Intrusions (High)"
                      stroke="#f43f5e"
                      fillOpacity={1}
                      fill="url(#colorIntrusions)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="watchlist_matches"
                      name="Watchlist Hits (Critical)"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorWatchlist)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No trend data available for current parameters.
              </div>
            )}
          </Card>

          {/* Distribution & Threat Matrix Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Type Distribution Chart */}
            <Card
              title="Event Type Category Distribution"
              subtitle="Breakdown of ingested detections by AI analytics classifier"
              icon={<PieChartIcon className="w-5 h-5 text-purple-400" />}
            >
              {distribution && distribution.distribution.length > 0 ? (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={distribution.distribution}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="event_type"
                        stroke="#64748b"
                        fontSize={10}
                        tickFormatter={(val) => val.replace('_DETECTED', '').replace('_', ' ')}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                        formatter={(val: unknown) => [`${val} detections`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {distribution.distribution.map((entry) => (
                          <Cell
                            key={entry.event_type}
                            fill={EVENT_TYPE_COLORS[entry.event_type] || '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">No distribution records found.</div>
              )}
            </Card>

            {/* Operational Severity Breakdown Matrix */}
            <Card
              title="Threat Severity Matrix & Operational Impact"
              subtitle="Real-time categorization according to perimeter risk policy"
              icon={<ShieldAlert className="w-5 h-5 text-red-400" />}
            >
              <div className="space-y-4 pt-2">
                {/* Critical */}
                <div className="p-3.5 bg-red-950/40 border border-red-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-950 border border-red-700 rounded-lg text-red-400">
                      <Flame className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-300 text-sm">CRITICAL SEVERITY</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700 font-bold">
                          {totalEvents > 0 ? (((threats?.critical || 0) / totalEvents) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Watchlist hits & stolen target vehicles</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">{threats?.critical || 0}</span>
                </div>

                {/* High */}
                <div className="p-3.5 bg-rose-950/30 border border-rose-800/70 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-950 border border-rose-700 rounded-lg text-rose-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-300 text-sm">HIGH THREAT</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold">
                          {totalEvents > 0 ? (((threats?.high || 0) / totalEvents) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Border breaches & perimeter loitering</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">{threats?.high || 0}</span>
                </div>

                {/* Medium */}
                <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-950 border border-amber-700 rounded-lg text-amber-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300 text-sm">MEDIUM THREAT</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold">
                          {totalEvents > 0 ? (((threats?.medium || 0) / totalEvents) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Vehicle detections & checkpoint scans</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">{threats?.medium || 0}</span>
                </div>

                {/* Low */}
                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-950 border border-blue-800 rounded-lg text-blue-400">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-sm">LOW / ROUTINE</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-bold">
                          {totalEvents > 0 ? (((threats?.low || 0) / totalEvents) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Standard person and object telemetry</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-slate-200">{threats?.low || 0}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Camera Activity & Threat Ranking Table */}
          <Card
            title="Perimeter Camera Activity & Threat Density Ranking"
            subtitle="Surveillance camera streams ranked by total detections and threat intensity"
            icon={<Video className="w-5 h-5 text-cyan-400" />}
          >
            {cameras && cameras.cameras.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="pb-3 pl-2">Camera Node</th>
                      <th className="pb-3">Location / Zone</th>
                      <th className="pb-3 text-center">Threat Level</th>
                      <th className="pb-3 text-right">Critical Hits</th>
                      <th className="pb-3 text-right">High Threats</th>
                      <th className="pb-3 text-right">Total Events</th>
                      <th className="pb-3 text-right">Avg Conf</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/40">
                    {cameras.cameras.map((cam) => {
                      const severity =
                        cam.critical_threats > 0
                          ? 'CRITICAL'
                          : cam.high_threats > 0
                          ? 'HIGH'
                          : cam.medium_threats > 0
                          ? 'MEDIUM'
                          : 'LOW';
                      const sevConfig = getSeverityConfig(severity);

                      return (
                        <tr
                          key={cam.camera_id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 pl-2 font-bold text-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="text-cyan-400">{cam.camera_id}</span>
                              <span className="text-slate-400 font-normal">({cam.camera_name})</span>
                            </div>
                          </td>
                          <td className="py-3.5 text-slate-400">{cam.location || 'Unassigned'}</td>
                          <td className="py-3.5 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sevConfig.badgeBg} ${sevConfig.badgeText} border ${sevConfig.badgeBorder}`}
                            >
                              {cam.threat_count} THREATS
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-red-400">
                            {cam.critical_threats}
                          </td>
                          <td className="py-3.5 text-right font-bold text-rose-400">
                            {cam.high_threats}
                          </td>
                          <td className="py-3.5 text-right font-bold text-slate-100">
                            {cam.total_events}
                          </td>
                          <td className="py-3.5 text-right text-emerald-400 font-semibold">
                            {(cam.avg_confidence * 100).toFixed(1)}%
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <button
                              onClick={() => {
                                const matched = camerasList.find((c) => c.camera_id === cam.camera_id);
                                setSelectedCamForModal(
                                  matched || {
                                    id: 0,
                                    camera_id: cam.camera_id,
                                    name: cam.camera_name || cam.camera_id,
                                    location: cam.location,
                                    status: (cam.status as any) || 'ONLINE',
                                    created_at: '',
                                    updated_at: '',
                                  }
                                );
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700 transition-colors text-[11px]"
                            >
                              Inspect Events
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">No camera records found.</div>
            )}
          </Card>
        </div>
      )}

      {/* Camera-Specific Event Telemetry Modal */}
      <CameraEventsModal
        camera={selectedCamForModal}
        onClose={() => setSelectedCamForModal(null)}
      />
    </div>
  );
};

export default Analytics;
