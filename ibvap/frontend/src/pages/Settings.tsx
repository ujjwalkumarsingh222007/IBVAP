import React from 'react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Sliders, ShieldCheck } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="space-y-6">
      <Header
        title="Surveillance System Settings"
        subtitle="Platform Configuration & Display Preferences"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title="Telemetry Polling Configuration"
          subtitle="Real-time live dashboard sync parameters"
          icon={<Sliders className="w-5 h-5 text-blue-400" />}
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Dashboard Sync Frequency</span>
              <span className="text-slate-100 font-bold">12 Seconds</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Health Check Frequency</span>
              <span className="text-slate-100 font-bold">15 Seconds</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Default Query Limit</span>
              <span className="text-slate-100 font-bold">20 Events</span>
            </div>
          </div>
        </Card>

        <Card
          title="Backend Connection Details"
          subtitle="Surveillance platform endpoint targets"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Gateway URL</span>
              <span className="text-blue-400">http://127.0.0.1:8000</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Swagger API Docs</span>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                /docs ↗
              </a>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Authentication</span>
              <span className="text-slate-400">Disabled (Local Dev)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
