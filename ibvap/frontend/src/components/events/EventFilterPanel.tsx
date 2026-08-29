import React, { useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { EventFilters, EventType } from '../../types';
import { Button } from '../common/Button';

interface EventFilterPanelProps {
  filters: EventFilters;
  onApply: (newFilters: EventFilters) => void;
  onReset: () => void;
  camerasList?: string[];
}

const EVENT_TYPES: { label: string; value: EventType }[] = [
  { label: 'Intrusion Detected', value: 'INTRUSION_DETECTED' },
  { label: 'Person Detected', value: 'PERSON_DETECTED' },
  { label: 'Vehicle Detected', value: 'VEHICLE_DETECTED' },
  { label: 'ANPR Detected', value: 'ANPR_DETECTED' },
  { label: 'Watchlist Match', value: 'WATCHLIST_MATCH' },
  { label: 'Suspicious Activity', value: 'SUSPICIOUS_ACTIVITY' },
  { label: 'Object Detected', value: 'OBJECT_DETECTED' },
];

export const EventFilterPanel: React.FC<EventFilterPanelProps> = ({
  filters,
  onApply,
  onReset,
  camerasList = [],
}) => {
  const [localType, setLocalType] = useState<string>(filters.event_type || '');
  const [localCamera, setLocalCamera] = useState<string>(filters.camera_id || '');
  const [confMin, setConfMin] = useState<string>(
    filters.confidence_min !== undefined ? filters.confidence_min.toString() : ''
  );
  const [confMax, setConfMax] = useState<string>(
    filters.confidence_max !== undefined ? filters.confidence_max.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const minNum = confMin.trim() !== '' ? parseFloat(confMin) : undefined;
    const maxNum = confMax.trim() !== '' ? parseFloat(confMax) : undefined;

    if (minNum !== undefined && (isNaN(minNum) || minNum < 0 || minNum > 1)) {
      setError('Confidence Min must be between 0.0 and 1.0');
      return;
    }
    if (maxNum !== undefined && (isNaN(maxNum) || maxNum < 0 || maxNum > 1)) {
      setError('Confidence Max must be between 0.0 and 1.0');
      return;
    }
    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      setError('Confidence Min cannot exceed Confidence Max');
      return;
    }

    onApply({
      ...filters,
      event_type: localType || undefined,
      camera_id: localCamera || undefined,
      confidence_min: minNum,
      confidence_max: maxNum,
      offset: 0, // Reset to page 1 on filter apply
    });
  };

  const handleReset = () => {
    setLocalType('');
    setLocalCamera('');
    setConfMin('');
    setConfMax('');
    setError(null);
    onReset();
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 mb-6 shadow-md">
      <div className="flex items-center justify-between mb-4 border-b border-surface-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter className="w-4 h-4 text-blue-400" />
          <span>Surveillance Filters</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Event Type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Event Category
            </label>
            <select
              value={localType}
              onChange={(e) => setLocalType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            >
              <option value="">All Categories</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Camera ID */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Camera Identifier
            </label>
            {camerasList.length > 0 ? (
              <select
                value={localCamera}
                onChange={(e) => setLocalCamera(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              >
                <option value="">All Cameras</option>
                {camerasList.map((cam) => (
                  <option key={cam} value={cam}>
                    {cam}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. CAM-01"
                value={localCamera}
                onChange={(e) => setLocalCamera(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            )}
          </div>

          {/* Confidence Min */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Confidence Min (0.00 – 1.00)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              placeholder="0.00"
              value={confMin}
              onChange={(e) => setConfMin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Confidence Max */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Confidence Max (0.00 – 1.00)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              placeholder="1.00"
              value={confMax}
              onChange={(e) => setConfMax(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 font-mono bg-red-950/40 p-2 rounded border border-red-900/50">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" size="sm" variant="primary">
            Apply Filters
          </Button>
        </div>
      </form>
    </div>
  );
};
