import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cctv,
  Users,
  Car,
  Clock,
  AlertTriangle,
  Settings,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAlerts } from '../../context/AlertContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onCloseMobile }) => {
  const { alerts } = useAlerts();
  const unreadAlerts = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, tag: 'DASH' },
    { to: '/cameras', label: 'Surveillance Wall', icon: Cctv, tag: 'LIVE' },
    { to: '/people', label: 'Biometrics', icon: Users, tag: 'FACE' },
    { to: '/vehicles', label: 'ANPR Tracking', icon: Car, tag: 'PLATE' },
    { to: '/events', label: 'Audit Logs', icon: Clock, tag: 'EVT' },
    {
      to: '/alerts',
      label: 'Threat Center',
      icon: AlertTriangle,
      badge: unreadAlerts > 0 ? unreadAlerts : undefined,
      tag: 'ALRT',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-surface border-r border-surface-border transition-all duration-200 ease-in-out ${
          isOpen ? 'w-56' : 'w-16'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-surface-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-surface-elevated border border-tactical-blue/40 flex items-center justify-center text-tactical-blue shrink-0 shadow-tactical">
              <Shield className="w-4 h-4" />
            </div>
            {isOpen && (
              <div className="flex flex-col min-w-0">
                <span className="font-mono font-black text-sm tracking-widest text-white leading-none">
                  IBVAP<span className="text-tactical-blue font-sans text-xs">·AI</span>
                </span>
                <span className="text-[9px] tracking-wider text-tactical-slate uppercase font-mono mt-0.5">
                  DEFENSE SUITE
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors hidden lg:flex border border-surface-border/60"
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onCloseMobile}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tag */}
        {isOpen && (
          <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-bold text-tactical-slate tracking-widest uppercase">
            OPERATIONAL MODULES
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-surface-elevated text-white border-l-2 border-tactical-blue font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-subtle border-l-2 border-transparent'
                } ${!isOpen && 'justify-center px-0'}`
              }
              title={!isOpen ? item.label : undefined}
            >
              <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105`} />
              {isOpen && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined ? (
                    <span className="ml-auto px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-red-600 text-white animate-pulse">
                      {item.badge}
                    </span>
                  ) : (
                    <span className="ml-auto text-[9px] font-mono text-tactical-slate opacity-60 group-hover:opacity-100">
                      {item.tag}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Settings Link & Telemetry Status */}
        <div className="p-2 border-t border-surface-border space-y-1">
          <NavLink
            to="/settings"
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-surface-elevated text-white border-l-2 border-tactical-blue'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-subtle border-l-2 border-transparent'
              } ${!isOpen && 'justify-center px-0'}`
            }
            title={!isOpen ? 'System Settings' : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {isOpen && <span className="truncate">Configuration</span>}
          </NavLink>
        </div>
      </aside>
    </>
  );
};
