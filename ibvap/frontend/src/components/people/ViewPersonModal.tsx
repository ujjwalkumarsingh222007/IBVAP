import React from 'react';
import { X, User, Calendar, Shield, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Person } from '../../types';
import { Badge } from '../common/Badge';
import { formatFullDateTime, resolveMediaUrl } from '../../utils/formatters';

interface ViewPersonModalProps {
  person: Person | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (person: Person) => void;
}

export const ViewPersonModal: React.FC<ViewPersonModalProps> = ({
  person,
  isOpen,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !person) return null;

  const imageUrl = resolveMediaUrl(person.face_image_path);
  const isKnown = person.status === 'KNOWN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Person Profile</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {person.person_code}</p>
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
          {/* Photo & Identity Badge */}
          <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 shadow-xl mb-3">
              {imageUrl ? (
                <img src={imageUrl} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>

            <h3 className="text-base font-bold text-white tracking-tight">{person.name}</h3>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge status={person.status} size="md" />
            </div>
          </div>

          {/* Details Table */}
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
                {formatFullDateTime(person.created_at)}
              </span>
            </div>

            {person.notes && (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <div className="text-slate-400 font-mono flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Notes / Role
                </div>
                <div className="text-slate-200 pl-6">{person.notes}</div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
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
                onEdit(person);
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md cursor-pointer"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
