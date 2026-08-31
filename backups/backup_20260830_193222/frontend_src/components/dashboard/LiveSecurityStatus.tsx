import React from 'react';
import { ShieldCheck, ShieldAlert, Video, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardSummary } from '../../types';

interface LiveSecurityStatusProps {
  summary: DashboardSummary;
  activeThreatCount?: number;
  criticalAlertMessage?: string | null;
}

export const LiveSecurityStatus: React.FC<LiveSecurityStatusProps> = ({
  summary,
  activeThreatCount = 0,
  criticalAlertMessage,
}) => {
  const isThreatActive = activeThreatCount > 0 || summary.total_intrusions > 0 || summary.total_watchlist_matches > 0;

  return (
    <div
      className={`relative rounded-xl border p-5 shadow-lg transition-all ${
        isThreatActive
          ? 'bg-red-950/20 border-red-800/60 shadow-red-950/20'
          : 'bg-surface border-surface-border'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Security Status Banner */}
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-xl border shrink-0 ${
              isThreatActive
                ? 'bg-red-950/80 border-red-700 text-red-400 animate-pulse'
                : 'bg-emerald-950/80 border-emerald-700 text-emerald-400'
            }`}
          >
            {isThreatActive ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-100 font-mono">
                {isThreatActive ? 'SECURITY ALERT IN PROGRESS' : 'PERIMETER SECURE — NO ACTIVE THREATS'}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                  isThreatActive
                    ? 'bg-red-900/80 text-red-200 border border-red-700'
                    : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                }`}
              >
                {isThreatActive ? 'THREAT LEVEL: HIGH' : 'NORMAL MONITORING'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {criticalAlertMessage ||
                (isThreatActive
                  ? `${activeThreatCount} active correlated threat(s) detected across optical sensor grid.`
                  : `All ${summary.active_cameras} active surveillance node(s) reporting normal baseline telemetry.`)}
            </p>
          </div>
        </div>

        {/* Right: Quick Action Links */}
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <Link
            to="/cameras"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-mono font-semibold transition-colors"
          >
            <Video className="w-3.5 h-3.5 text-blue-400" />
            <span>{summary.active_cameras} Cameras Live</span>
          </Link>

          <Link
            to="/alerts"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors ${
              isThreatActive
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-md animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <span>View Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
