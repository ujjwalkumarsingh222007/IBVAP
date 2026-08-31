import React, { useState, useEffect } from 'react';
import { X, Car, Save, RefreshCw } from 'lucide-react';
import { Vehicle } from '../../types';
import { vehicleApi } from '../../api/vehicleApi';

interface EditVehicleModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED' | 'WATCHLIST'>('KNOWN');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicle) {
      setPlateNumber(vehicle.plate_number || '');
      setOwnerName(vehicle.owner_name || '');
      setStatus(vehicle.status as any || 'KNOWN');
      setNotes(vehicle.notes || '');
      setError(null);
    }
  }, [vehicle, isOpen]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = plateNumber.replace(/\s+/g, '').toUpperCase();
    if (!cleanPlate) {
      setError('License plate cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vehicleApi.updateVehicle(vehicle.id, {
        plate_number: cleanPlate,
        owner_name: ownerName.trim(),
        status,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to update vehicle record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Vehicle Record</h2>
              <p className="text-xs text-slate-400 font-mono">ID: #{vehicle.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* Plate Number */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              License Plate Number *
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-mono tracking-wider uppercase font-bold"
              placeholder="e.g. DL01AB1234 or HR98AA0000"
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Registered Owner / Department
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-sans"
              placeholder="e.g. Security Fleet Chief / Logistics Dept"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Security Classification *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('KNOWN')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  status === 'KNOWN'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>✓ AUTHORIZED (KNOWN)</span>
                <span className="text-[10px] font-normal text-slate-400">Regular access, 0 alerts</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('FLAGGED')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  status === 'FLAGGED' || status === 'WATCHLIST'
                    ? 'bg-red-500/15 border-red-500/60 text-red-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>🚨 WATCHLIST (FLAGGED)</span>
                <span className="text-[10px] font-normal text-slate-400">Triggers tactical alert</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Notes / Remarks
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-sans"
              placeholder="e.g. VIP Transport / Delivery Van / Stolen alert"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
