import React from 'react';
import { User, Car, ShieldAlert, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';
import { AIDetection } from '../../types';

interface DetectionFeedProps {
  detections: AIDetection[];
  cameraName: string;
}

export const DetectionFeed: React.FC<DetectionFeedProps> = ({ detections, cameraName }) => {
  return (
    <div className="flex flex-col h-full bg-surface border border-surface-border rounded-lg overflow-hidden shadow-tactical font-mono">
      {/* Feed Header */}
      <div className="p-3 border-b border-surface-border bg-surface-subtle flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-tactical-blue animate-pulse" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
              LIVE TARGET TRACKS
            </h3>
          </div>
          <div className="text-[10px] text-tactical-slate mt-0.5">{cameraName}</div>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-surface-elevated border border-surface-border text-tactical-cyan">
          {detections.length} ACTIVE
        </span>
      </div>

      {/* Detections Target List */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[520px]">
        {detections.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center p-4 text-center text-tactical-slate">
            <User className="w-6 h-6 opacity-30 mb-2" />
            <div className="text-xs font-semibold">NO ACTIVE TARGETS IN SECTOR</div>
            <div className="text-[10px] text-tactical-slate/70 mt-0.5">Optical scanner continuous monitoring...</div>
          </div>
        ) : (
          detections.map((det, idx) => {
            const isPerson = det.class_name === 'person';
            const isKnown = det.is_known || det.status === 'KNOWN';
            const isFlagged = det.is_flagged || det.status === 'FLAGGED' || det.watchlist_match;
            const isAnalyzing = det.status === 'ANALYZING' || det.plate_number === 'Scanning...';

            const nameOrPlate = isPerson
              ? (det.person_name || 'UNKNOWN PERSON')
              : (det.plate_number || 'VEHICLE SCANNING');

            return (
              <div
                key={`det_item_${det.track_id || idx}_${nameOrPlate}`}
                className={`p-2.5 rounded border transition-all ${
                  isKnown
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                    : isFlagged
                    ? 'bg-red-950/30 border-red-500/50 text-red-300 animate-pulse'
                    : isAnalyzing
                    ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded border ${
                        isKnown
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : isFlagged
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : isAnalyzing
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {isPerson ? <User className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-tactical-slate tracking-wider font-bold">
                        {isPerson ? 'BIOMETRIC PERSON' : 'VEHICLE / ANPR'}
                        {det.track_id ? ` · TRK #${det.track_id}` : ''}
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5 truncate max-w-[160px]">
                        {nameOrPlate}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      isKnown
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : isFlagged
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : isAnalyzing
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {isKnown ? 'KNOWN' : isFlagged ? 'FLAGGED' : isAnalyzing ? 'ANALYZING' : 'UNKNOWN'}
                  </span>
                </div>

                <div className="mt-2 pt-1.5 border-t border-surface-border/60 flex items-center justify-between text-[9px] text-tactical-slate">
                  <div className="flex items-center gap-1">
                    {isKnown ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    ) : isFlagged ? (
                      <ShieldAlert className="w-2.5 h-2.5 text-red-400" />
                    ) : isAnalyzing ? (
                      <Radio className="w-2.5 h-2.5 text-cyan-400" />
                    ) : (
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    )}
                    <span>
                      {isKnown
                        ? 'IDENTITY VERIFIED'
                        : isFlagged
                        ? 'CRITICAL ALERT ACTIVE'
                        : isAnalyzing
                        ? 'EXTRACTING BIOMETRICS'
                        : 'UNKNOWN ENTITY'}
                    </span>
                  </div>
                  {det.confidence ? (
                    <span className="font-semibold text-slate-300">
                      {Math.round(det.confidence * 100)}% MATCH
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
