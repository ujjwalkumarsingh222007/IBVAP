import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Eye,
  Camera as CameraIcon,
  Clock,
  Trash2,
  X,
  FileImage,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/common/Button';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { evidenceApi, formatApiError } from '../api';
import { EvidenceItem } from '../types';
import { usePolling } from '../hooks';

type EvidenceFilter = 'ALL' | 'PERSON' | 'VEHICLE' | 'UNKNOWN' | 'FLAGGED';

export const Evidence: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<EvidenceFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchEvidence = useCallback(async () => {
    try {
      const data = await evidenceApi.getEvidence({ limit: 100 });
      setEvidenceList(data);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, refresh } = usePolling(fetchEvidence, {
    intervalMs: 5000,
    enabled: true,
    pauseWhenHidden: true,
    immediate: true,
  });

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Delete evidence capture #${id}?`)) return;
    setIsDeleting(true);
    try {
      await evidenceApi.deleteEvidence(id);
      setSelectedEvidence(null);
      await fetchEvidence();
    } catch (err) {
      alert(`Failed to delete evidence: ${formatApiError(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEvidence = useMemo(() => {
    return evidenceList.filter((item) => {
      if (activeFilter === 'PERSON' && item.detection_type !== 'person') return false;
      if (activeFilter === 'VEHICLE' && item.detection_type !== 'vehicle') return false;
      if (activeFilter === 'UNKNOWN' && item.status !== 'UNKNOWN') return false;
      if (activeFilter === 'FLAGGED' && item.status !== 'FLAGGED') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCam = item.camera_id.toLowerCase().includes(q);
        const matchPlate = item.plate_number ? item.plate_number.toLowerCase().includes(q) : false;
        const matchReason = item.reason ? item.reason.toLowerCase().includes(q) : false;
        if (!matchCam && !matchPlate && !matchReason) return false;
      }
      return true;
    });
  }, [evidenceList, activeFilter, searchTerm]);

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Evidence"
        subtitle="Captured photo logs and bounding-box crops for unknown and flagged detections"
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface border border-surface-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'PERSON', 'VEHICLE', 'UNKNOWN', 'FLAGGED'] as EvidenceFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === f
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f === 'ALL' ? `All (${evidenceList.length})` : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search camera or plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="Evidence Feed Offline"
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Evidence Grid */}
      {loading && evidenceList.length === 0 ? (
        <CardSkeleton count={6} />
      ) : filteredEvidence.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-surface-border rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
            <FileImage className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">No Evidence Captured</h3>
            <p className="text-xs text-slate-400 mt-1">
              Evidence is automatically recorded whenever an UNKNOWN or FLAGGED person or vehicle enters camera view.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredEvidence.map((ev) => {
            const isFlagged = ev.status === 'FLAGGED';
            const tagLabel = `${ev.status} ${ev.detection_type.toUpperCase()}`;
            const timeStr = ev.timestamp
              ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '--:--:--';

            return (
              <div
                key={ev.id}
                className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-md flex flex-col justify-between transition-all hover:border-slate-400 group"
              >
                {/* Photo Thumbnail */}
                <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
                  <img
                    src={ev.crop_image_path || ev.image_path}
                    alt={tagLabel}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback if local image not found
                      (e.target as HTMLImageElement).src = ev.image_path;
                    }}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm border text-[10px] font-bold">
                    <span className={`w-1.5 h-1.5 rounded-full ${isFlagged ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className={isFlagged ? 'text-red-300' : 'text-amber-300'}>
                      {tagLabel}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-300 font-bold">
                      <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
                      {ev.camera_id}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {Math.round(ev.confidence * 100)}% conf
                    </span>
                  </div>

                  {ev.plate_number && (
                    <p className="text-xs text-yellow-300 font-bold truncate">
                      Plate: {ev.plate_number}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-sans">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {timeStr}
                    </span>
                    <button
                      onClick={() => setSelectedEvidence(ev)}
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Evidence Detail Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-slate-900/90">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedEvidence.status === 'FLAGGED' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <h3 className="text-sm font-bold text-white uppercase">
                  Evidence Capture #{selectedEvidence.id} — {selectedEvidence.status} {selectedEvidence.detection_type}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Image Previews Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">Full Frame Image</span>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    <img
                      src={selectedEvidence.image_path}
                      alt="Full Frame"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">Cropped Detection Region</span>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    <img
                      src={selectedEvidence.crop_image_path || selectedEvidence.image_path}
                      alt="Crop Region"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Metadata Table */}
              <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Camera Source:</span>
                  <span className="text-cyan-400 font-bold">{selectedEvidence.camera_id}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-200 font-sans">
                    {new Date(selectedEvidence.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Classification:</span>
                  <span
                    className={`font-bold ${
                      selectedEvidence.status === 'FLAGGED' ? 'text-red-400' : 'text-amber-400'
                    }`}
                  >
                    {selectedEvidence.status} {selectedEvidence.detection_type.toUpperCase()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="text-emerald-400 font-bold">
                    {Math.round(selectedEvidence.confidence * 100)}%
                  </span>
                </div>

                {selectedEvidence.plate_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">License Plate:</span>
                    <span className="text-yellow-300 font-bold font-mono">
                      {selectedEvidence.plate_number}
                    </span>
                  </div>
                )}

                {selectedEvidence.bbox_x1 !== null && selectedEvidence.bbox_x1 !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bounding Box:</span>
                    <span className="text-slate-300 font-mono">
                      [{selectedEvidence.bbox_x1}, {selectedEvidence.bbox_y1}, {selectedEvidence.bbox_x2}, {selectedEvidence.bbox_y2}]
                    </span>
                  </div>
                )}

                {selectedEvidence.reason && (
                  <div className="flex justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Trigger Reason:</span>
                    <span className="text-slate-200 font-sans">{selectedEvidence.reason}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border bg-slate-900/90">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(selectedEvidence.id)}
                disabled={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Evidence
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedEvidence(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evidence;
