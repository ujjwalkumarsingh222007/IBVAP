import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Users,
  Car,
  Activity,
  Settings,
  Shield,
  LogOut,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
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
  { name: 'Events', path: '/events', icon: Activity },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('ibvap_sidebar_collapsed');
    return saved === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ibvap_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Automatically minimize navigation on live camera screens if desired
  useEffect(() => {
    if (location.pathname === '/cameras' && window.innerWidth >= 1024) {
      // Allow user preference but keep layout responsive
    }
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'lg:w-16' : 'lg:w-56'
        } w-60 bg-surface border-r border-surface-border flex flex-col shrink-0 min-h-screen transition-all duration-200 select-none shadow-2xl lg:shadow-none`}
      >
        {/* Brand Header & Collapse Toggle */}
        <div
          className={`h-14 flex items-center border-b border-surface-border/60 ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-blue-950/80 border border-blue-800/60 rounded-xl text-blue-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-100 tracking-wide text-sm font-mono">IBVAP</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono font-bold">
                    V2
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center ${
                    isCollapsed ? 'lg:justify-center px-2.5' : 'gap-3 px-3'
                  } py-2.5 rounded-xl text-xs transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent font-medium'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

      {/* Operator Session Info */}
      {user && (
        <div className="px-2.5 pb-2">
          {isCollapsed ? (
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col items-center gap-1.5" title={`${user.username} (${user.role})`}>
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <button
                onClick={logout}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* System Status Footer */}
      <div className={`p-2.5 m-2.5 bg-slate-900/60 rounded-xl border border-surface-border/60 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-xs`}>
        {isCollapsed ? (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-slate-300 font-medium font-mono">System Online</span>
            </div>
            <ConnectionStatusBadge compact />
          </>
        )}
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
