import React from 'react';
import { Car, Trash2, Calendar, FileText, User, Edit2, Eye, Check } from 'lucide-react';
import { Vehicle } from '../../types';
import { Badge } from '../common/Badge';
import { formatFullDateTime } from '../../utils/formatters';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected = false,
  onToggleSelect,
  onDelete,
  onView,
  onEdit,
}) => {
  const isKnown = vehicle.status === 'KNOWN';

  return (
    <div
      className={`bg-surface border rounded-2xl p-4 transition-all hover:shadow-xl group flex flex-col justify-between relative ${
        isSelected
          ? 'border-cyan-500/80 ring-1 ring-cyan-500/50 bg-slate-900/90'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Plate + Status Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Checkbox */}
            {onToggleSelect && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(vehicle.id);
                }}
                className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              onClick={() => onView(vehicle)}
              className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 group-hover:border-cyan-500/40 transition-colors shrink-0 cursor-pointer"
            >
              <Car className="w-5 h-5" />
            </div>

            <div>
              {/* Tactical License Plate Box */}
              <div
                onClick={() => onView(vehicle)}
                className="inline-block px-2.5 py-0.5 bg-slate-950 border border-slate-600 rounded-md font-mono text-sm font-bold tracking-widest text-slate-100 uppercase shadow-inner cursor-pointer hover:text-cyan-400 transition-colors"
              >
                {vehicle.plate_number}
              </div>
              {vehicle.owner_name && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <User className="w-3 h-3 text-slate-500" />
                  <span className="truncate max-w-[150px]">{vehicle.owner_name}</span>
                </div>
              )}
            </div>
          </div>

          <Badge status={vehicle.status} size="sm" />
        </div>

        {vehicle.notes && (
          <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{vehicle.notes}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono py-2 border-t border-slate-800/80">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>Registered: {formatFullDateTime(vehicle.created_at)}</span>
        </div>
      </div>

      {/* Footer Actions: VIEW, EDIT, DELETE */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-mono font-medium ${
            isKnown ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isKnown ? '● AUTHORIZED' : '🚨 WATCHLIST TARGET'}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onView(vehicle)}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="View Details"
          >
            <Eye className="w-3 h-3" />
            <span>VIEW</span>
          </button>
          <button
            onClick={() => onEdit(vehicle)}
            className="px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-600 rounded-lg transition-colors flex items-center gap-1 border border-cyan-500/20 cursor-pointer"
            title="Edit Record"
          >
            <Edit2 className="w-3 h-3" />
            <span>EDIT</span>
          </button>
          <button
            onClick={() => onDelete(vehicle.id)}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="Delete vehicle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
