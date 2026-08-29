import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card } from '../common/Card';
import { DashboardSummary } from '../../types';
import { PieChart as PieIcon, BarChart2 } from 'lucide-react';

interface AnalyticsChartsProps {
  summary: DashboardSummary;
}

const COLORS = [
  '#ef4444', // Intrusions - Red
  '#3b82f6', // Persons - Blue
  '#10b981', // Vehicles - Emerald
  '#8b5cf6', // ANPR - Purple
  '#f43f5e', // Watchlist - Rose
  '#f59e0b', // Suspicious - Amber
];

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ summary }) => {
  const pieData = [
    { name: 'Intrusions', value: summary.total_intrusions, color: COLORS[0] },
    { name: 'Persons', value: summary.total_persons, color: COLORS[1] },
    { name: 'Vehicles', value: summary.total_vehicles, color: COLORS[2] },
    { name: 'ANPR', value: summary.total_anpr, color: COLORS[3] },
    { name: 'Watchlist', value: summary.total_watchlist_matches, color: COLORS[4] },
    { name: 'Suspicious', value: summary.total_suspicious_activity, color: COLORS[5] },
  ].filter((item) => item.value > 0);

  const barData = [
    { category: 'Intrusions', count: summary.total_intrusions },
    { category: 'Persons', count: summary.total_persons },
    { category: 'Vehicles', count: summary.total_vehicles },
    { category: 'ANPR', count: summary.total_anpr },
    { category: 'Watchlist', count: summary.total_watchlist_matches },
    { category: 'Suspicious', count: summary.total_suspicious_activity },
  ];

  const totalEventValues = pieData.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Event Category Distribution (Pie/Donut) */}
      <Card
        title="Event Category Distribution"
        subtitle="Proportion of detected surveillance alerts"
        icon={<PieIcon className="w-4 h-4 text-blue-400" />}
      >
        {totalEventValues === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
            <span>No surveillance event data recorded yet</span>
          </div>
        ) : (
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  itemStyle={{ color: '#93c5fd' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/3 flex flex-col gap-2 text-xs font-mono pr-2">
              {pieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300 truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-100">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Category Volume Breakdown (BarChart) */}
      <Card
        title="Surveillance Threat Breakdown"
        subtitle="Count comparison across surveillance categories"
        icon={<BarChart2 className="w-4 h-4 text-emerald-400" />}
      >
        {totalEventValues === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
            <span>No surveillance event data recorded yet</span>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  cursor={{ fill: 'rgba(51, 65, 85, 0.3)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};
