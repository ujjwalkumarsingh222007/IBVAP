import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { WatchlistModal } from '../components/watchlist/WatchlistModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { watchlistService } from '../services/watchlistService';
import { WatchlistEntry } from '../types/watchlist';
import { ShieldAlert, Plus, Car, User, Edit, Trash2, Search, Filter } from 'lucide-react';

export const WatchlistPage: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<WatchlistEntry | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<WatchlistEntry | null>(null);

  useEffect(() => {
    async function loadWatchlist() {
      setLoading(true);
      try {
        const res = await watchlistService.getWatchlist();
        setWatchlist(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadWatchlist();
  }, []);

  const handleSaveTarget = async (data: Partial<WatchlistEntry>) => {
    try {
      if (editingTarget) {
        const res = await watchlistService.updateWatchlistEntry(editingTarget.id, data);
        setWatchlist(watchlist.map(w => w.id === editingTarget.id ? res.data : w));
      } else {
        const res = await watchlistService.addWatchlistEntry(data as any);
        setWatchlist([res.data, ...watchlist]);
      }
      setIsModalOpen(false);
      setEditingTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTarget = async () => {
    if (!deletingTarget) return;
    try {
      await watchlistService.deleteWatchlistEntry(deletingTarget.id);
      setWatchlist(watchlist.filter(w => w.id !== deletingTarget.id));
      setDeletingTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredWatchlist = watchlist.filter((entry) => {
    if (selectedPriority !== 'ALL' && entry.priority !== selectedPriority) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.identifier.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      (entry.vehicle_type && entry.vehicle_type.toLowerCase().includes(q))
    );
  });

  if (loading) return <SkeletonLoader type="card" count={3} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Target Watchlist & ANPR Registry"
        subtitle="Flagged vehicle license plates, stolen vehicles, and border suspect profiles"
        icon={<ShieldAlert size={22} />}
        action={
          <button
            onClick={() => {
              setEditingTarget(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold font-mono rounded-lg transition-colors shadow-md shadow-cyan-500/20"
          >
            <Plus size={16} />
            <span>Add Target</span>
          </button>
        }
      />

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by license plate, POI name, or vehicle type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121824] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <Filter size={14} /> Priority:
          </span>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#121824] border border-slate-800 text-xs font-mono text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWatchlist.map((entry) => (
          <Card key={entry.id} className="p-4 flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  {entry.category.includes('VEHICLE') || entry.category.includes('PLATE') ? (
                    <Car size={18} />
                  ) : (
                    <User size={18} />
                  )}
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-red-950 text-red-400 font-mono text-[10px] font-bold rounded border border-red-800">
                    {entry.priority}
                  </span>
                  
                  {/* Action Buttons */}
                  <button
                    onClick={() => {
                      setEditingTarget(entry);
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors"
                    title="Edit target"
                  >
                    <Edit size={14} />
                  </button>
                  
                  <button
                    onClick={() => setDeletingTarget(entry)}
                    className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                    title="Remove target"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100">{entry.name}</h3>
                <p className="text-xs font-mono text-cyan-400 font-semibold mt-0.5">
                  Identifier / Plate: {entry.identifier}
                </p>
                {entry.vehicle_type && (
                  <span className="inline-block text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 mt-1">
                    Type: {entry.vehicle_type}
                  </span>
                )}
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <WatchlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTarget}
          initialData={editingTarget}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTarget && (
        <ConfirmModal
          isOpen={!!deletingTarget}
          onClose={() => setDeletingTarget(null)}
          onConfirm={handleDeleteTarget}
          title={`Remove Target (${deletingTarget.identifier})`}
          message={`Are you sure you want to remove target "${deletingTarget.name}" from the border surveillance watchlist?`}
          confirmLabel="Delete Target"
          isDangerous={true}
        />
      )}
    </div>
  );
};
