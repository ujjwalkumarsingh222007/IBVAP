import React, { useState } from 'react';
import { Bell, ShieldCheck, User, Wifi, ChevronDown } from 'lucide-react';
import { MOCK_ALERTS } from '../../data/mockData';

export const Header: React.FC = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadAlerts = MOCK_ALERTS.filter(a => a.status === 'UNACKNOWLEDGED');

  return (
    <header className="h-16 bg-[#0d121d]/90 backdrop-blur border-b border-[#1f293d] px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Status Indicator */}
      <div className="flex items-center gap-6">
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-wide">
            Intelligent Border Video Analytics Platform
          </h2>
          <p className="text-[11px] text-slate-400">SIH Surveillance & AI Vision Node</p>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] font-medium">4/4 Camera Nodes Active</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Backend API Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
          <Wifi size={13} className="text-cyan-400" />
          <span className="text-[11px]">API: http://localhost:8000</span>
        </div>

        {/* Notifications Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Surveillance Notifications"
          >
            <Bell size={18} />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#121824] border border-[#1f293d] rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Active Security Alerts</span>
                <span className="text-[10px] text-cyan-400 font-mono">{unreadAlerts.length} Action Needed</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                {MOCK_ALERTS.map((alert) => (
                  <div key={alert.id} className="p-3 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-red-400">{alert.severity}</span>
                      <span className="text-slate-500 font-mono">{alert.camera_id}</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium line-clamp-1">{alert.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{alert.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-800" />

        {/* User / Profile Area */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="p-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <User size={16} />
          </div>
          <div className="hidden lg:block">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-200">Officer J. Miller</span>
              <ShieldCheck size={13} className="text-cyan-400" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Control Room Chief</p>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
};
