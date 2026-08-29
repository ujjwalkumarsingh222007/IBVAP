import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileImage,
  ArrowRight,
  Camera as CameraIcon,
  Clock,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { EvidenceItem } from '../../types';
import { evidenceApi } from '../../api/evidenceApi';

export const DashboardRecentEvidence: React.FC = () => {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadEvidence = useCallback(async () => {
    try {
      const data = await evidenceApi.getEvidence({ limit: 4 });
      setEvidence(data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvidence();
    const timer = setInterval(loadEvidence, 5000);
    return () => clearInterval(timer);
  }, [loadEvidence]);

  if (loading && evidence.length === 0) {
    return (
      <div className="bg-surface border border-surface-border rounded-xl p-5 shadow space-y-3">
        <div className="h-6 w-40 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-md font-mono space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileImage className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Recent Evidence
          </h3>
        </div>
        <button
          onClick={() => navigate('/evidence')}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold transition-colors"
        >
          <span>View All Evidence</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {evidence.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-lg border border-surface-border/40 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-slate-500" />
          <span>No evidence captured yet. Captured automatically when unknown/flagged detections occur.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {evidence.map((item) => {
            const isFlagged = item.status === 'FLAGGED';
            const tag = `${item.status} ${item.detection_type.toUpperCase()}`;
            const timeStr = item.timestamp
              ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Recent';

            return (
              <div
                key={item.id}
                onClick={() => navigate('/evidence')}
                className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between hover:border-slate-600 transition-all cursor-pointer group"
              >
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={item.crop_image_path || item.image_path}
                    alt={tag}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = item.image_path;
                    }}
                  />
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isFlagged ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {tag}
                  </span>
                </div>

                <div className="p-2.5 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <CameraIcon className="w-3 h-3 text-cyan-400" />
                      {item.camera_id}
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="flex items-center gap-1 font-sans">
                      <Clock className="w-2.5 h-2.5 text-slate-600" />
                      {timeStr}
                    </span>
                    <span className="text-blue-400 flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5" />
                      Inspect
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardRecentEvidence;
