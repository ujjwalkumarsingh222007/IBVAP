import React, { useState } from 'react';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { EventFilters } from '../../types';
import { Button } from '../common/Button';

interface EventFilterPanelProps {
  filters: EventFilters;
  onApply: (newFilters: EventFilters) => void;
  onReset: () => void;
  camerasList?: string[];
}

const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Person', value: 'PERSON_DETECTED' },
  { label: 'Vehicle', value: 'VEHICLE_DETECTED' },
  { label: 'ANPR', value: 'ANPR_DETECTED' },
  { label: 'Intrusion', value: 'INTRUSION_DETECTED' },
  { label: 'Watchlist', value: 'WATCHLIST_MATCH' },
];

export const EventFilterPanel: React.FC<EventFilterPanelProps> = ({
  filters,
  onApply,
  onReset,
  camerasList = [],
}) => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [localCamera, setLocalCamera] = useState<string>(filters.camera_id || '');
  const [confMin, setConfMin] = useState<string>(
    filters.confidence_min !== undefined ? filters.confidence_min.toString() : ''
  );
  const [confMax, setConfMax] = useState<string>(
    filters.confidence_max !== undefined ? filters.confidence_max.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  const activeQuickFilter = filters.event_type || '';

  const handleSelectQuickFilter = (typeValue: string) => {
    onApply({
      ...filters,
      event_type: typeValue || undefined,
      offset: 0,
    });
  };

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
      camera_id: localCamera || undefined,
      confidence_min: minNum,
      confidence_max: maxNum,
      offset: 0,
    });
  };

  const handleReset = () => {
    setLocalCamera('');
    setConfMin('');
    setConfMax('');
    setError(null);
    onReset();
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-md space-y-3">
      {/* Quick Filter Category Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((q) => (
            <Button
              key={q.value}
              variant={activeQuickFilter === q.value ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectQuickFilter(q.value)}
            >
              {q.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>{showAdvanced ? 'Hide Advanced' : 'More Filters'}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {(localCamera || confMin || confMax || activeQuickFilter) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 transition-colors px-2 py-1"
              title="Reset All Filters"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Collapse */}
      {showAdvanced && (
        <form onSubmit={handleSubmit} className="pt-3 border-t border-surface-border/60 space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Camera Identifier
              </label>
              {camerasList.length > 0 ? (
                <select
                  value={localCamera}
                  onChange={(e) => setLocalCamera(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
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
                  placeholder="e.g. CAM-TOWER-04"
                  value={localCamera}
                  onChange={(e) => setLocalCamera(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Confidence Min (0.0 – 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="0.00"
                value={confMin}
                onChange={(e) => setConfMin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Confidence Max (0.0 – 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="1.00"
                value={confMax}
                onChange={(e) => setConfMax(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 font-mono bg-red-950/40 p-2 rounded border border-red-900/50">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" size="sm" variant="primary">
              Apply Advanced Filters
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EventFilterPanel;
