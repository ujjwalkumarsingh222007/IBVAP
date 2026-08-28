import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { DetectionStatsChart } from '../components/dashboard/DetectionStatsChart';
import { analyticsService } from '../services/analyticsService';
import {
  HourlyDetectionTrend,
  EventTypeDistribution,
  CameraEventBreakdown,
  AlertSeverityDistribution,
} from '../types/analytics';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, Activity, Video, Bell } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [trends, setTrends] = useState<HourlyDetectionTrend[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeDistribution[]>([]);
  const [cameraBreakdown, setCameraBreakdown] = useState<CameraEventBreakdown[]>([]);
  const [alertSeverities, setAlertSeverities] = useState<AlertSeverityDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [trendsRes, eventTypesRes, cameraRes, severitiesRes] = await Promise.all([
          analyticsService.getHourlyTrends(),
          analyticsService.getEventTypeDistribution(),
          analyticsService.getCameraEventBreakdown(),
          analyticsService.getAlertSeverityDistribution(),
        ]);
        setTrends(trendsRes.data);
        setEventTypes(eventTypesRes.data);
        setCameraBreakdown(cameraRes.data);
        setAlertSeverities(severitiesRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) return <SkeletonLoader type="card" count={3} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Surveillance & AI Analytics Dashboard"
        subtitle="Data visualizations for object class frequencies, threat distributions, and peak activity hours"
        icon={<BarChart3 size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Area Chart (2 cols) */}
        <div className="lg:col-span-2">
          <Card
            title="Hourly Detection Volume Trends"
            subtitle="Real-time volume trends over 24-hour monitoring cycle"
            icon={<Activity size={18} />}
          >
            <DetectionStatsChart data={trends} />
          </Card>
        </div>

        {/* Event Type Distribution Pie Chart (1 col) */}
        <div className="lg:col-span-1">
          <Card
            title="Event Type Distribution Ratio"
            subtitle="Breakdown by AI model classification category"
            icon={<PieChartIcon size={18} />}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="type"
                  >
                    {eventTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121824',
                      borderColor: '#1f293d',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {eventTypes.slice(0, 4).map((t) => (
                <div key={t.type} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-slate-300">{t.type}</span>
                  </div>
                  <span className="font-bold text-slate-100">{t.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Row 2: Camera Breakdown Bar Chart & Alert Severity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Breakdown Bar Chart */}
        <Card
          title="Events Volume by Camera Stream"
          subtitle="Total detection count registered per CCTV/RTSP node"
          icon={<Video size={18} />}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cameraBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="camera_id" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121824',
                    borderColor: '#1f293d',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="events_count" name="Event Hits" fill="#00f2ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Alert Severity Distribution */}
        <Card
          title="Alert Severity Breakdown"
          subtitle="Priority tier distribution across active and historical threat warnings"
          icon={<Bell size={18} />}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertSeverities} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="severity" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121824',
                    borderColor: '#1f293d',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Alert Count" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
