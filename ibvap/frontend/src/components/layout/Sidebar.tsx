import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  ShieldAlert,
  Car,
  Search,
  Video,
  Activity,
  Shield,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { ConnectionStatusBadge } from '../common/ConnectionStatusBadge';
import { useAuth } from '../../hooks';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Stream', path: '/live-events', icon: Radio, pulse: true },
  { name: 'Threat Alerts', path: '/alerts', icon: ShieldAlert },
  { name: 'ANPR Intelligence', path: '/anpr', icon: Car },
  { name: 'Event Explorer', path: '/events', icon: Search },
  { name: 'Cameras', path: '/cameras', icon: Video },
  { name: 'System Health', path: '/health', icon: Activity },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-surface border-r border-surface-border flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-surface-border/60">
        <div className="p-2 bg-blue-950/80 border border-blue-800/60 rounded-xl text-blue-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 tracking-wider text-base">IBVAP</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
            Border Surveillance
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
              {item.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Operator Session Info */}
      {user && (
        <div className="px-3 pb-2">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> Active Session
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  user.role === 'ADMIN'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : user.role === 'OPERATOR'
                    ? 'bg-blue-950 text-blue-400 border border-blue-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                {user.role}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold truncate max-w-[120px]">{user.username}</span>
              <button
                onClick={logout}
                className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Level & System Status Footer */}
      <div className="p-4 border-t border-surface-border/60 m-3 bg-slate-900/60 rounded-xl border space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            AI Guard Mode
          </span>
          <span className="text-emerald-400 font-mono text-[11px]">ACTIVE</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full w-full"></div>
        </div>

        {/* Compact Connection Status */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Gateway</span>
          <ConnectionStatusBadge compact />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
