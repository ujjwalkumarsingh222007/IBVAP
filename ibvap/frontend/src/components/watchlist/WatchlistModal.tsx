import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { WatchlistEntry, WatchlistCategory, PriorityLevel, WatchlistStatus } from '../../types/watchlist';

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<WatchlistEntry>) => void;
  initialData?: WatchlistEntry | null;
}

export const WatchlistModal: React.FC<WatchlistModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [category, setCategory] = useState<WatchlistCategory>('WANTED_VEHICLE');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [vehicleType, setVehicleType] = useState('SUV');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [status, setStatus] = useState<WatchlistStatus>('ACTIVE');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setCategory(initialData.category);
      setIdentifier(initialData.identifier);
      setName(initialData.name);
      setVehicleType(initialData.vehicle_type || 'SUV');
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setNotes(initialData.notes);
    } else {
      setCategory('WANTED_VEHICLE');
      setIdentifier('');
      setName('');
      setVehicleType('SUV');
      setPriority('HIGH');
      setStatus('ACTIVE');
      setNotes('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !name) return;
    onSave({
      ...(initialData ? { id: initialData.id } : {}),
      category,
      identifier,
      name,
      vehicle_type: vehicleType,
      priority,
      status,
      notes,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Watchlist Target (${initialData.id})` : 'Add New Target to Surveillance Watchlist'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Target Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WatchlistCategory)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="WANTED_VEHICLE">Wanted Vehicle</option>
            <option value="STOLEN_PLATE">Stolen License Plate</option>
            <option value="SUSPECT_PERSON">Suspect Person</option>
            <option value="RESTRICTED_ACCESS">Restricted Access Violation</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Identifier (License Plate / Person ID)</label>
          <input
            type="text"
            placeholder="e.g. KA-05-MN-9921"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Target Description / Name</label>
          <input
            type="text"
            placeholder="e.g. Dark Gray SUV (Armed Robbery)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Vehicle / Subject Type</label>
          <input
            type="text"
            placeholder="e.g. SUV, Commercial Truck, Sedan"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Target Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WatchlistStatus)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="FLAGGED">Flagged</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Intelligence Notes</label>
          <textarea
            placeholder="Provide border security background details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 h-20"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-mono rounded-lg border border-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs font-mono rounded-lg shadow-md shadow-cyan-500/20"
          >
            {initialData ? 'Update Target' : 'Save Watchlist Target'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
