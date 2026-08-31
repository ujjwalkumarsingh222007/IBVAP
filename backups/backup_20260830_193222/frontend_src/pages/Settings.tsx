import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  History,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks';
import { authApi, formatApiError } from '../api';
import { AuditLog } from '../types';

export const Settings: React.FC = () => {
  const { user, isAdmin, role, logout } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Demo reset states
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const logs = await authApi.getAuditLogs(30);
      setAuditLogs(logs);
    } catch (err) {
      setAuditError(formatApiError(err));
    } finally {
      setAuditLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [isAdmin, fetchAuditLogs]);

  const handleResetDemoData = async () => {
    setResetLoading(true);
    setResetSuccessMsg(null);
    setResetErrorMsg(null);
    try {
      const res = await authApi.resetDemoData();
      setResetSuccessMsg(res.message);
      setResetModalOpen(false);
      if (isAdmin) {
        await fetchAuditLogs();
      }
    } catch (err) {
      setResetErrorMsg(formatApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Surveillance System Administration"
        subtitle="Platform Configuration, Role Permissions & Security Audit Log"
      />

      {resetSuccessMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <span>✓ {resetSuccessMsg}</span>
          <button
            onClick={() => setResetSuccessMsg(null)}
            className="text-emerald-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {resetErrorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <span>✕ {resetErrorMsg}</span>
          <button
            onClick={() => setResetErrorMsg(null)}
            className="text-rose-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Session Profile Card */}
        <Card
          title="Active Operator Session"
          subtitle="Authenticated credentials & privilege level"
          icon={<UserCheck className="w-5 h-5 text-cyan-400" />}
        >
          <div className="space-y-3 text-xs pt-1">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Username</span>
              <span className="text-white font-bold">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Assigned Role</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  role === 'ADMIN'
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : role === 'OPERATOR'
                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {role}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Account Status</span>
              <span className="text-emerald-400 font-semibold">● ACTIVE</span>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={logout} className="w-full">
                Terminate Session (Log Out)
              </Button>
            </div>
          </div>
        </Card>

        {/* Database Management (Admin Only) */}
        <Card
          title="Database State & Maintenance"
          subtitle="Surveillance table maintenance controls"
          icon={<RotateCcw className="w-5 h-5 text-amber-400" />}
        >
          <div className="space-y-3 text-xs pt-1">
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Reset surveillance event tables to baseline for testing and live camera operations. Preserves camera registries and audit trails.
            </p>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px]">Command Line Utility:</span>
              <code className="text-amber-300 block text-[10px]">python scripts/demo_simulation.py --reset</code>
            </div>

            {isAdmin ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setResetModalOpen(true)}
                className="w-full"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Event Database
              </Button>
            ) : (
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-500 text-[11px] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Admin privileges required to reset event tables</span>
              </div>
            )}
          </div>
        </Card>

        {/* Gateway & Parameters */}
        <Card
          title="Backend Gateway & Security"
          subtitle="Platform connectivity & authentication mode"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        >
          <div className="space-y-3 text-xs pt-1">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Gateway URL</span>
              <span className="text-blue-400 text-[11px]">http://127.0.0.1:8000</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Security Boundary</span>
              <span className="text-emerald-400 font-bold">JWT Bearer (HS256)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">API Documentation</span>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                /docs ↗
              </a>
            </div>
          </div>
        </Card>
      </div>

      {/* Security Audit Log Stream (Admin Only) */}
      {isAdmin && (
        <Card
          title="Security & Management Audit Trail"
          subtitle="Immutable chronological record of administrative actions, logins, and camera mutations"
          icon={<History className="w-5 h-5 text-purple-400" />}
          action={
            <Button
              variant="outline"
              size="sm"
              loading={auditLoading}
              onClick={fetchAuditLogs}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Log
            </Button>
          }
        >
          {auditError ? (
            <div className="p-4 text-rose-400 text-xs">{auditError}</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No audit logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5 pl-2">Timestamp</th>
                    <th className="pb-2.5">User</th>
                    <th className="pb-2.5">Action</th>
                    <th className="pb-2.5">Endpoint</th>
                    <th className="pb-2.5 text-center">Status</th>
                    <th className="pb-2.5 pr-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/40 text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pl-2 text-slate-400">
                        {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '—'}
                      </td>
                      <td className="py-2.5 font-bold text-slate-200">{log.username}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700 font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400 text-[10px]">{log.endpoint}</td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            log.success
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {log.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-400 truncate max-w-xs">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Confirmation Modal for Reset Demo Data */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-surface border border-red-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-950 border border-red-800 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Surveillance Events</h3>
                <p className="text-xs text-slate-400">Confirm Database Reset Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will clear all current surveillance events in the SQLite database and re-verify baseline camera nodes. Database tables and security audit logs will be preserved.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetModalOpen(false)}
                disabled={resetLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetDemoData}
                loading={resetLoading}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
