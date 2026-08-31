import React from 'react';
import { X, Car, Calendar, Shield, FileText, CheckCircle2, ShieldAlert, User } from 'lucide-react';
import { Vehicle } from '../../types';
import { Badge } from '../common/Badge';
import { formatFullDateTime } from '../../utils/formatters';

interface ViewVehicleModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (vehicle: Vehicle) => void;
}

export const ViewVehicleModal: React.FC<ViewVehicleModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !vehicle) return null;

  const isKnown = vehicle.status === 'KNOWN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Vehicle Details</h2>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Tactical Plate Banner */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="inline-block px-5 py-2.5 bg-slate-950 border-2 border-slate-600 rounded-xl font-mono text-xl font-bold tracking-widest text-slate-100 uppercase shadow-2xl mb-3">
              {vehicle.plate_number}
            </div>

            {vehicle.owner_name ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Owner: {vehicle.owner_name}</span>
              </div>
            ) : null}

            <div className="mt-2 flex items-center gap-2">
              <Badge status={vehicle.status} size="md" />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 font-mono flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                Authorization State
              </span>
              <span className={`font-mono font-bold flex items-center gap-1 ${isKnown ? 'text-emerald-400' : 'text-red-400'}`}>
                {isKnown ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {isKnown ? 'AUTHORIZED (KNOWN)' : 'WATCHLIST (FLAGGED)'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="text-slate-400 font-mono flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Registered Date
              </span>
              <span className="text-slate-200 font-mono font-medium">
                {formatFullDateTime(vehicle.created_at)}
              </span>
            </div>

            {vehicle.notes && (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <div className="text-slate-400 font-mono flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Notes / Remarks
                </div>
                <div className="text-slate-200 pl-6">{vehicle.notes}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(vehicle);
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-all shadow-md cursor-pointer"
            >
              Edit Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
