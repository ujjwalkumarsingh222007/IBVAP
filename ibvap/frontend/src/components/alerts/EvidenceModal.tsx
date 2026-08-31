import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, Calendar, Cctv, User, Car, ImageOff, CheckCircle2 } from 'lucide-react';
import { EvidenceItem } from '../../types';
import { formatFullDateTime, resolveMediaUrl } from '../../utils/formatters';

interface EvidenceModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ evidence, onClose }) => {
  const [imageError, setImageError] = useState(false);

  if (!evidence) return null;

  const imageUrl = resolveMediaUrl(evidence.image_path || evidence.crop_image_path);
  const isPerson = evidence.detection_type === 'person';
  const isFlagged = evidence.status === 'FLAGGED';
  const isKnown = evidence.status === 'KNOWN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-mono">
      <div className="bg-surface border border-surface-border rounded-lg w-full max-w-3xl overflow-hidden shadow-tactical flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded flex items-center justify-center border ${
                isFlagged
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                  : isKnown
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              {isFlagged ? (
                <ShieldAlert className="w-4 h-4" />
              ) : isKnown ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                FORENSIC EVIDENCE RECORD #{evidence.id}
              </h3>
              <p className="text-[10px] text-tactical-slate">
                SENSOR: {evidence.camera_id} · {formatFullDateTime(evidence.timestamp)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Main Evidence Photo Preview */}
          <div className="relative aspect-video rounded bg-black border border-surface-border overflow-hidden flex items-center justify-center tactical-reticle">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={`Evidence ${evidence.id}`}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-tactical-slate text-center">
                <ImageOff className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-bold text-slate-300 uppercase">Snapshot Storage Unavailable</p>
                <p className="text-[10px] text-tactical-slate/70 mt-0.5">
                  Raw frame image path could not be located in local media cache.
                </p>
              </div>
            )}

            {/* Overlay Badge */}
            <div className="absolute top-2.5 left-2.5 z-10">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isKnown
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : isFlagged
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {evidence.status || 'UNKNOWN'}
              </span>
            </div>

            {evidence.confidence && (
              <div className="absolute bottom-2.5 right-2.5 z-10 px-2 py-0.5 rounded bg-black/80 border border-surface-border text-[10px] text-slate-300">
                AI CONFIDENCE: {Math.round(evidence.confidence * 100)}%
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-surface-subtle border border-surface-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-tactical-slate">
                {isPerson ? <User className="w-3.5 h-3.5 text-tactical-blue" /> : <Car className="w-3.5 h-3.5 text-tactical-cyan" />}
                <span>TARGET IDENTITY</span>
              </div>
              <div className="text-sm font-bold text-white">
                {evidence.person_id || evidence.plate_number || 'UNIDENTIFIED TARGET'}
              </div>
              {evidence.reason && (
                <p className="text-[11px] text-tactical-slate leading-relaxed">{evidence.reason}</p>
              )}
            </div>

            <div className="p-3 rounded bg-surface-subtle border border-surface-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-tactical-slate">
                <Cctv className="w-3.5 h-3.5 text-emerald-400" />
                <span>OPTICAL SENSOR GATEWAY</span>
              </div>
              <div className="text-sm font-bold text-white">
                {evidence.camera_id}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-tactical-slate">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{formatFullDateTime(evidence.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-surface-border bg-surface-subtle flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-surface-elevated hover:bg-tactical-blue text-white text-xs font-bold transition-colors border border-surface-border"
          >
            Dismiss Forensics
          </button>
        </div>
      </div>
    </div>
  );
};
