import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { watchlistService } from '../services/watchlistService';
import { WatchlistEntry, WatchlistCategory, PriorityLevel } from '../types/watchlist';
import { formatTimestamp } from '../utils/formatters';
import { ShieldAlert, Plus, Car, User, AlertTriangle } from 'lucide-react';

export const WatchlistPage: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form state
  const [category, setCategory] = useState<WatchlistCategory>('WANTED_VEHICLE');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadWatchlist() {
      setLoading(true);
      try {
        const data = await watchlistService.getWatchlist();
        setWatchlist(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadWatchlist();
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !name) return;
    try {
      const newEntry = await watchlistService.addWatchlistEntry({
        category,
        identifier,
        name,
        priority,
        notes,
      });
      setWatchlist([newEntry, ...watchlist]);
      setIsAddModalOpen(false);
      setIdentifier('');
      setName('');
      setNotes('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner label="Loading Target Watchlist Database..." />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Target Watchlist & ANPR Registry"
        subtitle="Flagged vehicle license plates, stolen vehicles, and border suspect profiles"
        icon={<ShieldAlert size={22} />}
        action={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-lg transition-colors shadow-md shadow-cyan-500/20"
          >
            <Plus size={16} />
            <span>Add Target</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {watchlist.map((entry) => (
          <Card key={entry.id} className="p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  {entry.category.includes('VEHICLE') || entry.category.includes('PLATE') ? (
                    <Car size={18} />
                  ) : (
                    <User size={18} />
                  )}
                </span>
                <span className="px-2 py-0.5 bg-red-950 text-red-400 font-mono text-[10px] font-bold rounded border border-red-800">
                  {entry.priority}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100">{entry.name}</h3>
                <p className="text-xs font-mono text-cyan-400 font-semibold mt-0.5">
                  ID / Plate: {entry.identifier}
                </p>
                <p className="text-xs text-slate-400 mt-2">{entry.notes}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Hits: <strong className="text-slate-200">{entry.matches_count}</strong></span>
              <span className="text-amber-400">Last Seen: {entry.last_seen_camera || 'N/A'}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Target Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Target to Surveillance Watchlist"
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
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
            <label className="block text-xs font-mono text-slate-400 mb-1">Identifier (Plate No / Person ID)</label>
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
            <label className="block text-xs font-mono text-slate-400 mb-1">Target Name / Description</label>
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
            <label className="block text-xs font-mono text-slate-400 mb-1">Intelligence Notes</label>
            <textarea
              placeholder="Provide intelligence bulletin context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-mono rounded-lg border border-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20"
            >
              Save Watchlist Target
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
