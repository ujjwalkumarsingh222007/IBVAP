import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentEventsList } from '../components/dashboard/RecentEventsList';
import { CameraStatusGrid } from '../components/dashboard/CameraStatusGrid';
import { DetectionStatsChart } from '../components/dashboard/DetectionStatsChart';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

import { analyticsService } from '../services/analyticsService';
import { camerasService } from '../services/camerasService';
import { eventsService } from '../services/eventsService';
import { usePolling } from '../hooks/usePolling';

import { DashboardStatistics, HourlyDetectionTrend } from '../types/analytics';
import { Camera } from '../types/camera';
import { Event } from '../types/event';

import {
  Video,
  Activity,
  Bell,
  ShieldAlert,
  LayoutDashboard,
  RefreshCw,
  Car,
  UserCheck,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trends, setTrends] = useState<HourlyDetectionTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, camerasRes, eventsRes, trendsRes] = await Promise.all([
        analyticsService.getDashboardStats(),
        camerasService.getCameras(),
        eventsService.getEvents(),
        analyticsService.getHourlyTrends(),
      ]);
      setStats(statsRes.data);
      setCameras(camerasRes.data);
      setEvents(eventsRes.data);
      setTrends(trendsRes.data);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Unable to communicate with IBVAP FastAPI Backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Periodic polling every 10 seconds for live operations
  usePolling(fetchDashboardData, 10000);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader type="metric" count={4} />
        <SkeletonLoader type="video" count={2} />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="py-8">
        <ErrorState
          title="Dashboard Connection Warning"
          message={error}
          onRetry={fetchDashboardData}
        />
      </div>
    );
  }

  if (!stats) return <EmptyState title="No Dashboard Analytics Available" description="No cameras or detection stats returned from backend." />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <PageHeader
        title="Surveillance Operations Command"
        subtitle="Real-time CCTV/RTSP analytics, AI detections, and border security threat monitoring"
        icon={<LayoutDashboard size={22} />}
        action={
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded-lg border border-slate-800 transition-colors"
          >
            <RefreshCw size={14} />
            <span>Sync Feeds</span>
          </button>
        }
      />

      {/* 6 Key Dashboard Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Active Cameras"
          value={`${stats.active_cameras}/${stats.total_cameras}`}
          subtitle="Streams broadcasting"
          trend="100% Signal"
          trendType="positive"
          accentColor="cyan"
          icon={<Video size={18} />}
        />

        <MetricCard
          title="Total Detections"
          value={stats.total_detections_today.toLocaleString()}
          subtitle="YOLO / ANPR hits"
          trend={`+${stats.detections_change_percent}%`}
          trendType="positive"
          accentColor="emerald"
          icon={<Activity size={18} />}
        />

        <MetricCard
          title="Active Alerts"
          value={stats.active_alerts}
          subtitle={`${stats.critical_alerts} Critical`}
          trend="Priority"
          trendType="negative"
          accentColor="red"
          icon={<Bell size={18} />}
        />

        <MetricCard
          title="Watchlist Matches"
          value={stats.watchlist_matches_today}
          subtitle="Plate / POI matches"
          trend="Action Needed"
          trendType="negative"
          accentColor="amber"
          icon={<ShieldAlert size={18} />}
        />

        <MetricCard
          title="Vehicles Detected"
          value={stats.vehicles_detected_today.toLocaleString()}
          subtitle="ANPR & YOLO count"
          trend="63% of total"
          trendType="positive"
          accentColor="cyan"
          icon={<Car size={18} />}
        />

        <MetricCard
          title="Persons Detected"
          value={stats.persons_detected_today.toLocaleString()}
          subtitle="Pedestrians & officers"
          trend="29% of total"
          trendType="neutral"
          accentColor="emerald"
          icon={<UserCheck size={18} />}
        />
      </div>

      {/* Main Grid Section: Camera Status & Detection Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Status Grid Area (2 cols) */}
        <div className="lg:col-span-2">
          <Card
            title="Live Camera Stream Grid"
            subtitle="Tactical RTSP feeds with automated AI detection layer"
            icon={<Video size={18} />}
          >
            <CameraStatusGrid cameras={cameras} />
          </Card>
        </div>

        {/* Recent Events Feed Area (1 col) */}
        <div className="lg:col-span-1">
          <Card
            title="Recent AI Events Stream"
            subtitle="Incoming computer vision event stream"
            icon={<Activity size={18} />}
          >
            <RecentEventsList events={events.slice(0, 5)} onSelectEvent={setSelectedEvent} />
          </Card>
        </div>
      </div>

      {/* Analytics Chart Row */}
      <Card
        title="Detection Statistics & Hourly Trend Breakdown"
        subtitle="Distribution of object classes detected by AI models across border sectors"
        icon={<Activity size={18} />}
      >
        <DetectionStatsChart data={trends} />
      </Card>

      {/* Event Details JSON Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Event Payload Inspector — ${selectedEvent.event_type}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-xs font-mono text-cyan-400 font-semibold">{selectedEvent.camera_id}</span>
              <span className="text-xs font-mono text-emerald-400">Confidence: {(selectedEvent.confidence * 100).toFixed(0)}%</span>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Raw Event Contract Payload
              </h4>
              <pre className="p-3 bg-[#0a0d14] rounded-lg text-xs font-mono text-cyan-300 border border-slate-800 overflow-x-auto">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
