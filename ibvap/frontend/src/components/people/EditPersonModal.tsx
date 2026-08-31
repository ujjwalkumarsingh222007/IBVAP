import React, { useState, useEffect } from 'react';
import { X, User, Save, RefreshCw, Camera } from 'lucide-react';
import { Person } from '../../types';
import { peopleApi } from '../../api/peopleApi';
import { resolveMediaUrl } from '../../utils/formatters';

interface EditPersonModalProps {
  person: Person | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRescanFace?: (person: Person) => void;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({
  person,
  isOpen,
  onClose,
  onSuccess,
  onRescanFace,
}) => {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'KNOWN' | 'FLAGGED'>('KNOWN');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (person) {
      setName(person.name || '');
      setStatus(person.status === 'FLAGGED' ? 'FLAGGED' : 'KNOWN');
      setNotes(person.notes || '');
      setError(null);
    }
  }, [person, isOpen]);

  if (!isOpen || !person) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await peopleApi.updatePerson(person.id, {
        name: name.trim(),
        status,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to update person profile.');
    } finally {
      setSaving(false);
    }
  };

  const imageUrl = resolveMediaUrl(person.face_image_path);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Person Profile</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {person.person_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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

          {/* Photo Preview & Re-scan */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
              {imageUrl ? (
                <img src={imageUrl} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{person.name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Biometric facial embedding is preserved.</div>
              {onRescanFace && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRescanFace(person);
                  }}
                  className="mt-2 text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Re-scan Face Biometrics</span>
                </button>
              )}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-sans"
              placeholder="e.g. Ujjwal Sharma"
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
                  status === 'FLAGGED'
                    ? 'bg-red-500/15 border-red-500/60 text-red-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>🚨 WATCHLIST (FLAGGED)</span>
                <span className="text-[10px] font-normal text-slate-400">Triggers tactical alert</span>
              </button>
            </div>
          </div>

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
              Security Notes / Role
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-sans"
              placeholder="e.g. Lead Security Officer / IT Admin"
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
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
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
