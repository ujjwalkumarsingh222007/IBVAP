import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Users,
  Car,
  Bell,
  Activity,
  Settings,
  Shield,
  LogOut,
  UserCheck,
  FileImage,
} from 'lucide-react';
import { ConnectionStatusBadge } from '../common/ConnectionStatusBadge';
import { useAuth } from '../../hooks';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const PRIMARY_NAV: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Cameras', path: '/cameras', icon: Video },
  { name: 'People', path: '/people', icon: Users },
  { name: 'Vehicles', path: '/vehicles', icon: Car },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'Evidence', path: '/evidence', icon: FileImage },
  { name: 'Events', path: '/events', icon: Activity },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 bg-surface border-r border-surface-border flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-surface-border/60">
        <div className="p-2 bg-blue-950/80 border border-blue-800/60 rounded-xl text-blue-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 tracking-wide text-sm font-mono">IBVAP</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">
              PROTOTYPE
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
            Security Command
          </p>
        </div>
      </div>

      {/* Primary Clean Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent font-medium'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Operator Session Info */}
      {user && (
        <div className="px-3 pb-2">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-cyan-400" /> Operator
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  user.role === 'ADMIN'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : 'bg-blue-950 text-blue-400 border border-blue-800'
                }`}
              >
                {user.role}
              </span>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-200 font-bold truncate max-w-[110px]">{user.username}</span>
              <button
                onClick={logout}
                className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Status Footer */}
      <div className="p-3 m-3 bg-slate-900/60 rounded-xl border border-surface-border/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-slate-300 font-medium font-mono">System Online</span>
        </div>
        <ConnectionStatusBadge compact />
      </div>
    </aside>
  );
};

export default Sidebar;
