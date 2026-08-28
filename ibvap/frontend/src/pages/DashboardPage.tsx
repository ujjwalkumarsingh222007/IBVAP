import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentEventsList } from '../components/dashboard/RecentEventsList';
import { CameraStatusGrid } from '../components/dashboard/CameraStatusGrid';
import { DetectionStatsChart } from '../components/dashboard/DetectionStatsChart';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

import { analyticsService } from '../services/analyticsService';
import { camerasService } from '../services/camerasService';
import { eventsService } from '../services/eventsService';

import { DashboardStatistics, HourlyDetectionTrend } from '../types/analytics';
import { Camera } from '../types/camera';
import { Event } from '../types/event';

import { Video, Activity, Bell, ShieldAlert, LayoutDashboard, RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trends, setTrends] = useState<HourlyDetectionTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, camerasData, eventsData, trendsData] = await Promise.all([
        analyticsService.getDashboardStats(),
        camerasService.getCameras(),
        eventsService.getEvents(),
        analyticsService.getHourlyTrends(),
      ]);
      setStats(statsData);
      setCameras(camerasData);
      setEvents(eventsData);
      setTrends(trendsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !stats) {
    return <LoadingSpinner label="Initializing IBVAP Command Dashboard..." />;
  }

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

      {/* Top 4 Dashboard Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Active Cameras"
          value={`${stats.active_cameras}/${stats.total_cameras}`}
          subtitle="RTSP / CCTV streams broadcasting"
          trend="100% Signal"
          trendType="positive"
          accentColor="cyan"
          icon={<Video size={20} />}
        />

        <MetricCard
          title="Total Detections"
          value={stats.total_detections_today.toLocaleString()}
          subtitle="YOLO / ANPR object hits today"
          trend={`+${stats.detections_change_percent}%`}
          trendType="positive"
          accentColor="emerald"
          icon={<Activity size={20} />}
        />

        <MetricCard
          title="Active Alerts"
          value={stats.active_alerts}
          subtitle={`${stats.critical_alerts} critical priority alerts`}
          trend={`${stats.critical_alerts} Critical`}
          trendType="negative"
          accentColor="red"
          icon={<Bell size={20} />}
        />

        <MetricCard
          title="Watchlist Matches"
          value={stats.watchlist_matches_today}
          subtitle="License plate / POI hits"
          trend="Action Needed"
          trendType="negative"
          accentColor="amber"
          icon={<ShieldAlert size={20} />}
        />
      </div>

      {/* Main Grid Section: Camera Status & Detection Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Status Grid Area (2 cols) */}
        <div className="lg:col-span-2">
          <Card
            title="Live Camera Stream Grid"
            subtitle="Primary tactical RTSP surveillance feeds with AI object detection overlays"
            icon={<Video size={18} />}
          >
            <CameraStatusGrid cameras={cameras} />
          </Card>
        </div>

        {/* Recent Events Feed Area (1 col) */}
        <div className="lg:col-span-1">
          <Card
            title="Recent AI Events Stream"
            subtitle="Live feed of incoming computer vision events"
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
          title={`Event Details — ${selectedEvent.event_type}`}
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
