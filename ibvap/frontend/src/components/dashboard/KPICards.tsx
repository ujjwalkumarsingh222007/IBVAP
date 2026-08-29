import React from 'react';
import {
  Activity,
  ShieldAlert,
  Users,
  Car,
  FileText,
  Eye,
  AlertTriangle,
  Video,
} from 'lucide-react';
import { DashboardSummary } from '../../types';

interface KPICardsProps {
  summary: DashboardSummary;
}

export const KPICards: React.FC<KPICardsProps> = ({ summary }) => {
  const cards = [
    {
      title: 'Total Events',
      value: summary.total_events,
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      color: 'border-blue-500/30',
      bgGlow: 'from-blue-950/30 to-transparent',
    },
    {
      title: 'Total Intrusions',
      value: summary.total_intrusions,
      icon: <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />,
      color: summary.total_intrusions > 0 ? 'border-red-500/40' : 'border-surface-border',
      bgGlow: summary.total_intrusions > 0 ? 'from-red-950/40 to-transparent' : '',
      alert: summary.total_intrusions > 0,
    },
    {
      title: 'Persons Detected',
      value: summary.total_persons,
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      color: 'border-cyan-500/30',
      bgGlow: 'from-cyan-950/30 to-transparent',
    },
    {
      title: 'Vehicles Detected',
      value: summary.total_vehicles,
      icon: <Car className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/30',
      bgGlow: 'from-emerald-950/30 to-transparent',
    },
    {
      title: 'ANPR Reads',
      value: summary.total_anpr,
      icon: <FileText className="w-5 h-5 text-purple-400" />,
      color: 'border-purple-500/30',
      bgGlow: 'from-purple-950/30 to-transparent',
    },
    {
      title: 'Watchlist Matches',
      value: summary.total_watchlist_matches,
      icon: <Eye className="w-5 h-5 text-rose-400" />,
      color: summary.total_watchlist_matches > 0 ? 'border-rose-500/40' : 'border-surface-border',
      bgGlow: summary.total_watchlist_matches > 0 ? 'from-rose-950/40 to-transparent' : '',
    },
    {
      title: 'Suspicious Activity',
      value: summary.total_suspicious_activity,
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/30',
      bgGlow: 'from-amber-950/30 to-transparent',
    },
    {
      title: 'Active Cameras',
      value: `${summary.active_cameras} / ${summary.total_cameras}`,
      icon: <Video className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/30',
      bgGlow: 'from-emerald-950/30 to-transparent',
      isRatio: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`relative bg-surface border ${card.color} rounded-xl p-5 shadow-lg overflow-hidden transition-all duration-200 hover:border-slate-500/60`}
        >
          {card.bgGlow && (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.bgGlow} pointer-events-none opacity-50`}
            />
          )}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {card.title}
            </span>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
              {card.icon}
            </div>
          </div>
          <div className="relative z-10 mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                card.alert ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {card.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
