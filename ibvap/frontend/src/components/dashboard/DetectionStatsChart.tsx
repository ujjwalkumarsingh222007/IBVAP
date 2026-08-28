import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { HourlyDetectionTrend } from '../../types/analytics';

interface DetectionStatsChartProps {
  data: HourlyDetectionTrend[];
}

export const DetectionStatsChart: React.FC<DetectionStatsChartProps> = ({ data }) => {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#00f2ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorANPR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPersons" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
          <XAxis
            dataKey="hour"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1f293d' }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1f293d' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#121824',
              borderColor: '#1f293d',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="vehicles"
            name="Vehicles"
            stroke="#00f2ff"
            fillOpacity={1}
            fill="url(#colorVehicles)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="anpr"
            name="ANPR Plates"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorANPR)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="persons"
            name="Persons"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorPersons)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
