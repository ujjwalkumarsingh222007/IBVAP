import React from 'react';
import { User, Trash2, Calendar, FileText, Edit2, Eye, Check } from 'lucide-react';
import { Person } from '../../types';
import { Badge } from '../common/Badge';
import { formatFullDateTime, resolveMediaUrl } from '../../utils/formatters';

interface PersonCardProps {
  person: Person;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (person: Person) => void;
  onEdit: (person: Person) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  isSelected = false,
  onToggleSelect,
  onDelete,
  onView,
  onEdit,
}) => {
  const imageUrl = resolveMediaUrl(person.face_image_path);
  const isKnown = person.status === 'KNOWN';

  return (
    <div
      className={`bg-surface border rounded-2xl p-4 transition-all hover:shadow-xl group flex flex-col justify-between relative ${
        isSelected
          ? 'border-blue-500/80 ring-1 ring-blue-500/50 bg-slate-900/90'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Photo + Status Header */}
        <div className="flex items-start gap-3.5 mb-3">
          {/* Checkbox */}
          {onToggleSelect && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(person.id);
              }}
              className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 mt-1 ${
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Photo */}
          <div
            onClick={() => onView(person)}
            className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 cursor-pointer group-hover:border-blue-500/40 transition-colors"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={person.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 -z-1">
              <User className="w-7 h-7 opacity-40" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3
                onClick={() => onView(person)}
                className="text-sm font-semibold text-slate-100 truncate group-hover:text-blue-400 transition-colors cursor-pointer"
              >
                {person.name}
              </h3>
              <Badge status={person.status} size="sm" />
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
              ID: {person.person_code}
            </div>
            {person.notes && (
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">
                <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{person.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Registration date */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono py-2 border-t border-slate-800/80">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>Registered: {formatFullDateTime(person.created_at)}</span>
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
            onClick={() => onView(person)}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="View Details"
          >
            <Eye className="w-3 h-3" />
            <span>VIEW</span>
          </button>
          <button
            onClick={() => onEdit(person)}
            className="px-2.5 py-1 text-[11px] font-semibold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-1 border border-blue-500/20 cursor-pointer"
            title="Edit Profile"
          >
            <Edit2 className="w-3 h-3" />
            <span>EDIT</span>
          </button>
          <button
            onClick={() => onDelete(person.id)}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="Delete registration"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
