import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Activity,
  Bell,
  Search,
  ShieldAlert,
  BarChart3,
  Settings,
  Shield,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Live Cameras', path: '/cameras', icon: <Video size={18} /> },
    { name: 'Events', path: '/events', icon: <Activity size={18} /> },
    { name: 'Alerts', path: '/alerts', icon: <Bell size={18} />, badge: 5 },
    { name: 'Detections', path: '/detections', icon: <Search size={18} /> },
    { name: 'Watchlist', path: '/watchlist', icon: <ShieldAlert size={18} /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
    { name: 'Camera Management', path: '/camera-management', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 bg-[#0d121d] border-r border-[#1f293d] flex flex-col shrink-0 h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#1f293d] flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 text-black shadow-lg shadow-cyan-500/20">
          <Shield size={22} className="stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg tracking-wider text-slate-100 font-mono">IBVAP</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
              v1.0
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono tracking-tight">Border Analytics Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 tracking-wider uppercase font-mono">
          Surveillance Operations
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.name}</span>
            </div>
            {item.badge && item.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer System Status Banner */}
      <div className="p-3 m-3 bg-[#121824] rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-slate-200 text-[11px]">System Online</span>
        </div>
        <p className="text-[10px] text-slate-400">Border Sector North Ops</p>
      </div>
    </aside>
  );
};
