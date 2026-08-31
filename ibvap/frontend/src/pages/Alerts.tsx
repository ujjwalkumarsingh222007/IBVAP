import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Eye,
  Camera as CameraIcon,
  Trash2,
  Calendar,
  Image as ImageIcon,
} from 'lucide-react';
import { alertApi } from '../api/alertApi';
import { evidenceApi } from '../api/evidenceApi';
import { CorrelatedThreat, EvidenceItem } from '../types';
import { EvidenceModal } from '../components/alerts/EvidenceModal';
import { formatFullDateTime, timeAgo, resolveMediaUrl } from '../utils/formatters';

export const Alerts: React.FC = () => {
  const [threats, setThreats] = useState<CorrelatedThreat[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'threats'>('evidence');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tList, eList] = await Promise.allSettled([
        alertApi.getThreats({ limit: 50 }),
        evidenceApi.getEvidenceList({ limit: 50 }),
      ]);

      if (tList.status === 'fulfilled') setThreats(tList.value);
      if (eList.status === 'fulfilled') setEvidenceList(eList.value);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDeleteEvidence = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete forensic evidence snapshot #${id}?`)) return;
    try {
      await evidenceApi.deleteEvidence(id);
      setEvidenceList((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete evidence');
    }
  };

  const filteredEvidence = evidenceList.filter((item) => {
    if (filterSeverity === 'CRITICAL') return item.status === 'FLAGGED';
    if (filterSeverity === 'MEDIUM') return item.status === 'UNKNOWN';
    return true;
  });

  const criticalCount = evidenceList.filter((e) => e.status === 'FLAGGED').length;
  const mediumCount = evidenceList.filter((e) => e.status === 'UNKNOWN').length;

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* 1. Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              TACTICAL THREAT & EVIDENCE CENTER
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-red-400 border border-surface-border font-bold">
              {criticalCount} CRITICAL
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Autonomous threat correlation, optical forensic snapshots, and watchlist violation telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Severity KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">TOTAL FORENSIC CAPTURES</div>
            <div className="text-xl font-bold text-white mt-0.5">{evidenceList.length}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
            <CameraIcon className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">CRITICAL / FLAGGED</div>
            <div className="text-xl font-bold text-red-400 mt-0.5">{criticalCount}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-red-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">UNIDENTIFIED ENTITIES</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{mediumCount}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Tab Selectors & Severity Filters */}
      <div className="p-3 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-tactical">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'bg-tactical-blue text-white shadow-tactical'
                : 'bg-surface-subtle text-tactical-slate hover:text-white border border-surface-border'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            FORENSIC SNAPSHOTS ({evidenceList.length})
          </button>
          <button
            onClick={() => setActiveTab('threats')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'threats'
                ? 'bg-tactical-blue text-white shadow-tactical'
                : 'bg-surface-subtle text-tactical-slate hover:text-white border border-surface-border'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            CORRELATED THREATS ({threats.length})
          </button>
        </div>

        {activeTab === 'evidence' && (
          <div className="flex items-center gap-1 bg-surface-subtle border border-surface-border p-1 rounded">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                filterSeverity === 'ALL' ? 'bg-tactical-blue text-white' : 'text-tactical-slate hover:text-white'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                filterSeverity === 'CRITICAL' ? 'bg-red-600 text-white' : 'text-tactical-slate hover:text-white'
              }`}
            >
              FLAGGED ({criticalCount})
            </button>
            <button
              onClick={() => setFilterSeverity('MEDIUM')}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                filterSeverity === 'MEDIUM' ? 'bg-amber-600 text-white' : 'text-tactical-slate hover:text-white'
              }`}
            >
              UNKNOWN ({mediumCount})
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Tab Views */}
      {activeTab === 'evidence' ? (
        filteredEvidence.length === 0 && !loading ? (
          <div className="p-12 text-center rounded-lg border border-surface-border bg-surface text-tactical-slate">
            <CameraIcon className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <div className="text-xs font-semibold">NO FORENSIC SNAPSHOTS RECORDED</div>
            <div className="text-[10px] text-tactical-slate/70 mt-0.5">
              Forensic evidence is captured upon detection of unknown or watchlist entities.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEvidence.map((item) => {
              const imgUrl = resolveMediaUrl(item.image_path || item.crop_image_path);
              const isFlagged = item.status === 'FLAGGED';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedEvidence(item)}
                  className={`bg-surface border rounded-lg p-3 transition-all hover:shadow-tactical cursor-pointer flex flex-col justify-between group ${
                    isFlagged
                      ? 'border-red-500/40 hover:border-red-500'
                      : 'border-surface-border hover:border-tactical-blue'
                  }`}
                >
                  <div>
                    {/* Image Preview Canvas */}
                    <div className="relative aspect-video rounded bg-black border border-surface-border overflow-hidden mb-2.5 flex items-center justify-center tactical-reticle">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={`Evidence #${item.id}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}

                      {/* Top Overlay Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isFlagged
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {item.status || 'UNKNOWN'}
                        </span>
                      </div>

                      {item.confidence && (
                        <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.2 rounded bg-black/80 text-[9px] text-slate-300 border border-slate-700">
                          {Math.round(item.confidence * 100)}% MATCH
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide truncate max-w-[190px]">
                          {item.person_id || item.plate_number || `${item.status} ${item.detection_type.toUpperCase()}`}
                        </h4>
                        <div className="text-[10px] text-tactical-blue font-bold mt-0.5">
                          SENSOR: {item.camera_id}
                        </div>
                      </div>
                    </div>

                    {item.reason && (
                      <p className="text-[10px] text-tactical-slate line-clamp-2 leading-relaxed mb-2">
                        {item.reason}
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-[9px] text-tactical-slate py-1.5 border-t border-surface-border">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{formatFullDateTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                    <span className="text-[10px] text-tactical-blue group-hover:text-blue-300 font-bold flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Inspect Forensics
                    </span>

                    <button
                      onClick={(e) => handleDeleteEvidence(item.id, e)}
                      className="p-1 text-tactical-slate hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Threats Tab */
        <div className="space-y-2.5">
          {threats.length === 0 && !loading ? (
            <div className="p-12 text-center rounded-lg border border-surface-border bg-surface text-tactical-slate">
              <ShieldAlert className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <div className="text-xs font-semibold">NO ACTIVE CORRELATED THREAT PATTERNS</div>
              <div className="text-[10px] text-tactical-slate/70 mt-0.5">
                Multi-event correlation engine reports sector safe.
              </div>
            </div>
          ) : (
            threats.map((threat) => (
              <div
                key={threat.threat_id || threat.id}
                className="p-3.5 rounded-lg bg-surface border border-surface-border hover:border-tactical-blue transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                        threat.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      {threat.severity}
                    </span>
                    <h3 className="text-xs font-bold text-white uppercase">{threat.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-subtle text-tactical-slate border border-surface-border">
                      SCORE: {threat.score}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{threat.reason}</p>
                  <div className="flex items-center gap-2 text-[10px] text-tactical-slate pt-0.5">
                    <span>SENSOR: {threat.camera_id}</span>
                    <span>·</span>
                    <span>EVENTS: {threat.event_count}</span>
                    <span>·</span>
                    <span>{timeAgo(threat.last_event_time)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-subtle text-slate-200 border border-surface-border">
                    {threat.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Forensics Viewer Modal */}
      {selectedEvidence && (
        <EvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
};
