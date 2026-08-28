import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DetectionStatsChart } from '../components/dashboard/DetectionStatsChart';
import { analyticsService } from '../services/analyticsService';
import { HourlyDetectionTrend, ThreatDistribution } from '../types/analytics';
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
import { BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [trends, setTrends] = useState<HourlyDetectionTrend[]>([]);
  const [threats, setThreats] = useState<ThreatDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [trendsData, threatsData] = await Promise.all([
          analyticsService.getHourlyTrends(),
          analyticsService.getThreatDistribution(),
        ]);
        setTrends(trendsData);
        setThreats(threatsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) return <LoadingSpinner label="Compiling Surveillance Analytics..." />;

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
            title="Hourly Detection Volume by Object Class"
            subtitle="Real-time volume trends over 24-hour monitoring cycle"
            icon={<Activity size={18} />}
          >
            <DetectionStatsChart data={trends} />
          </Card>
        </div>

        {/* Threat Distribution Pie Chart (1 col) */}
        <div className="lg:col-span-1">
          <Card
            title="Detections Classification Ratio"
            subtitle="Breakdown by AI model classification category"
            icon={<PieChartIcon size={18} />}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={threats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="category"
                  >
                    {threats.map((entry, index) => (
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
              {threats.map((t) => (
                <div key={t.category} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-slate-300">{t.category}</span>
                  </div>
                  <span className="font-bold text-slate-100">{t.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
