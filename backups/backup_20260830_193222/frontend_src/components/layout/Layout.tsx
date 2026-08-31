import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import { Sidebar } from './Sidebar';

export const Layout: React.FC = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar
        isMobileOpen={isMobileNavOpen}
        onMobileClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden h-14 bg-surface border-b border-surface-border flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="font-bold font-mono text-sm tracking-wide">IBVAP</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-semibold">Live</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

