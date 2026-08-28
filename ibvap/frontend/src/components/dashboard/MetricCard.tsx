import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  accentColor?: 'cyan' | 'red' | 'emerald' | 'amber';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendType = 'positive',
  icon,
  accentColor = 'cyan',
}) => {
  const accentStyles = {
    cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    red: 'border-red-500/30 text-red-400 bg-red-500/10',
    emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    amber: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  };

  const trendColors = {
    positive: 'text-emerald-400 bg-emerald-500/10',
    negative: 'text-red-400 bg-red-500/10',
    neutral: 'text-slate-400 bg-slate-800',
  };

  return (
    <div className="bg-[#121824] border border-[#1f293d] rounded-xl p-5 shadow-lg shadow-black/20 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{title}</span>
        <div className={`p-2 rounded-xl border ${accentStyles[accentColor]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">{value}</span>
        {trend && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono ${trendColors[trendType]}`}>
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>}
    </div>
  );
};
