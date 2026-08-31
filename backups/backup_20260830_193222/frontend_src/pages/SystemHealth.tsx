import React from 'react';
import {
  Server,
  Database,
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Radio,
  Globe,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useHealth } from '../hooks';

export const SystemHealth: React.FC = () => {
  const {
    health,
    refreshing,
    lastChecked,
    lastSuccessfulCheck,
    isBackendOnline,
    isDatabaseConnected,
    isHealthy,
    isDegraded,
    isOffline,
    checkHealth,
  } = useHealth(4000);

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="System Health & Operational Diagnostics"
        subtitle="Live Node Status, Database Persistence & Telemetry Monitor (4s Sync)"
        onRefresh={() => checkHealth()}
        isRefreshing={refreshing}
      />

      {/* Main Status Overview Banner */}
      <div
        className={`border rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4 transition-all duration-300 ${
          isHealthy
            ? 'bg-surface border-emerald-800/80 bg-gradient-to-r from-emerald-950/30 to-surface'
            : isDegraded
            ? 'bg-surface border-amber-800/80 bg-gradient-to-r from-amber-950/30 to-surface'
            : 'bg-surface border-red-800/80 bg-gradient-to-r from-red-950/40 to-surface'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl border ${
              isHealthy
                ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                : isDegraded
                ? 'bg-amber-950 text-amber-400 border-amber-700'
                : 'bg-red-950 text-red-400 border-red-700 animate-pulse'
            }`}
          >
            {isHealthy ? (
              <CheckCircle className="w-7 h-7" />
            ) : isDegraded ? (
              <AlertCircle className="w-7 h-7" />
            ) : (
              <Radio className="w-7 h-7 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-400 uppercase">
                System Operational Health:
              </span>
              <span
                className={`text-sm font-bold px-2.5 py-0.5 rounded border ${
                  isHealthy
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : isDegraded
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : 'bg-red-950 text-red-400 border-red-800'
                }`}
              >
                {isHealthy ? 'ALL SYSTEMS OPERATIONAL' : isDegraded ? 'DATABASE DEGRADED' : 'BACKEND OFFLINE'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Last check: {lastChecked || 'Checking...'}
              </span>
              {lastSuccessfulCheck && (
                <span className="text-emerald-400">
                  Last successful sync: {lastSuccessfulCheck}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={refreshing}
          onClick={() => checkHealth()}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Diagnose Now
        </Button>
      </div>

      {isOffline && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            Backend Unavailable
          </div>
          <p>
            The surveillance backend service at <code className="text-white">http://127.0.0.1:8000</code> is currently unreachable.
          </p>
          <p className="text-slate-400 text-[11px]">
            The command center will automatically recover and reconnect as soon as the FastAPI service resumes.
          </p>
        </div>
      )}

      {/* Tri-Node Health Architecture Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Frontend Node */}
        <Card
          title="React Web Console"
          subtitle="Client-Side Command Interface"
          icon={<Globe className="w-5 h-5 text-cyan-400" />}
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Node Status</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                ONLINE
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Architecture</span>
              <span className="text-slate-200">React + TypeScript</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Real-time Polling</span>
              <span className="text-blue-400">3–5s Adaptive Interval</span>
            </div>
          </div>
        </Card>

        {/* Backend Node */}
        <Card
          title="FastAPI Gateway"
          subtitle="REST API & Common Event Ingest"
          icon={<Server className="w-5 h-5 text-blue-400" />}
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Node Status</span>
              {isBackendOnline ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  ONLINE
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  OFFLINE
                </span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Service Name</span>
              <span className="text-slate-200">{health?.service || 'IBVAP Backend Service'}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Host URL</span>
              <span className="text-blue-400">http://127.0.0.1:8000</span>
            </div>
          </div>
        </Card>

        {/* Database Node */}
        <Card
          title="SQLAlchemy Storage"
          subtitle="SQLite Local Persistence Engine"
          icon={<Database className="w-5 h-5 text-emerald-400" />}
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Connection</span>
              {isBackendOnline && isDatabaseConnected ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  CONNECTED
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  DISCONNECTED
                </span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Storage Backend</span>
              <span className="text-slate-200">SQLite (ibvap.db)</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Persistence Schema</span>
              <span className="text-slate-200">events, cameras</span>
            </div>
          </div>
        </Card>
      </div>

      {/* REST API Endpoints Inventory */}
      <Card
        title="Authoritative REST API Gateway Contracts"
        subtitle="Core surveillance endpoints consumed by command center polling hooks"
        icon={<Shield className="w-5 h-5 text-purple-400" />}
      >
        <div className="divide-y divide-surface-border/50 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-bold">
                POST
              </span>
              <span className="text-slate-200">/api/v1/events</span>
            </div>
            <span className="text-slate-400">Common Event Schema Telemetry Ingestion</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                GET
              </span>
              <span className="text-slate-200">/api/v1/dashboard/summary</span>
            </div>
            <span className="text-slate-400">Dashboard Real-Time Metrics Aggregation</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                GET
              </span>
              <span className="text-slate-200">/api/v1/dashboard/recent-events?limit=20</span>
            </div>
            <span className="text-slate-400">Live Surveillance Feed & Threat Toast Stream</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                GET
              </span>
              <span className="text-slate-200">/api/v1/events</span>
            </div>
            <span className="text-slate-400">Paginated Event Logs & Multi-Filter Query Engine</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 font-bold">
                GET / POST / PUT / DELETE
              </span>
              <span className="text-slate-200">/api/v1/cameras</span>
            </div>
            <span className="text-slate-400">Surveillance Camera Node Registry</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                GET
              </span>
              <span className="text-slate-200">/api/v1/health</span>
            </div>
            <span className="text-slate-400">Active Service & Persistence Diagnostic Health</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SystemHealth;
