import React, { useState } from 'react';
import { X, Car, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { vehicleApi } from '../../api/vehicleApi';
import { VehicleRegisterPayload } from '../../types';

interface RegisterVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterVehicleModal: React.FC<RegisterVehicleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED' | 'WATCHLIST'>('KNOWN');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = plateNumber.replace(/\s+/g, '').toUpperCase();
    if (!cleanPlate) {
      setErrorMessage('License plate number is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: VehicleRegisterPayload = {
        plate_number: cleanPlate,
        owner_name: ownerName.trim(),
        status,
        notes: notes.trim() || undefined,
      };

      await vehicleApi.registerVehicle(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-surface border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Register Vehicle</h3>
              <p className="text-xs text-slate-400 font-mono">Add Plate to Surveillance Registry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              License Plate Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g. HR98AA0000"
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-mono tracking-widest uppercase text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Owner / Department Name
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Facilities Management / Staff"
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Classification Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('KNOWN')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  status === 'KNOWN'
                    ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold uppercase">KNOWN (Authorized)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">No alert on detection</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('FLAGGED')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  status === 'FLAGGED'
                    ? 'bg-red-950/30 border-red-500 text-red-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>
                  <div className="text-xs font-bold uppercase">FLAGGED (Watchlist)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">High priority alert</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIP parking access, Sector 4"
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md"
            >
              {isSubmitting ? 'Registering...' : 'Save Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
