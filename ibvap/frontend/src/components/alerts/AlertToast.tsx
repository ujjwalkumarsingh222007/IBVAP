import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useAlerts } from '../../context/AlertContext';
import { formatTimestamp } from '../../utils/formatters';

export const AlertToastContainer: React.FC = () => {
  const { recentToasts, dismissToast } = useAlerts();

  if (recentToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {recentToasts.map((toast) => {
        const isCritical = toast.severity === 'CRITICAL';
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              isCritical
                ? 'bg-red-950/85 border-red-500/50 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                : 'bg-slate-900/90 border-amber-500/40 text-slate-100 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 p-1.5 rounded-lg ${
                    isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider">{toast.title}</h5>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-mono">
                    <span className="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                      {toast.camera_id}
                    </span>
                    <span>{formatTimestamp(toast.timestamp)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
