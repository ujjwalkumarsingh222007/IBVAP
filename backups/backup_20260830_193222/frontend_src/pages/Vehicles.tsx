import React, { useState, useEffect, useCallback } from 'react';
import {
  Car,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Flame,
  X,
  RefreshCw,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { vehiclesApi, VehicleItem } from '../api/vehiclesApi';
import { registryStorage } from '../services/registryStorage';
import { formatApiError } from '../api';

export const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Form state
  const [formPlate, setFormPlate] = useState<string>('');
  const [formOwner, setFormOwner] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'KNOWN' | 'WATCHLIST'>('KNOWN');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const data = await vehiclesApi.getVehicles();
      setVehicles(data);
      setError(null);

      // Sync with clientside storage
      data.forEach((v) => {
        registryStorage.addVehicle({
          id: `VEH-${v.plate_number}`,
          plate_number: v.plate_number,
          owner_name: v.owner_name,
          status: v.status === 'WATCHLIST' || v.status === 'FLAGGED' ? 'WATCHLIST' : 'REGISTERED',
          notes: v.notes,
        });
      });
    } catch (err) {
      setError(formatApiError(err));
      // Local fallback
      const local = registryStorage.getVehicles().map((lv, idx) => ({
        id: idx + 1,
        plate_number: lv.plate_number,
        owner_name: lv.owner_name,
        status: lv.status === 'WATCHLIST' ? 'WATCHLIST' : 'KNOWN',
        notes: lv.notes,
        created_at: lv.created_at,
      }));
      setVehicles(local as VehicleItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanPlate = formPlate.replace(/\s+/g, '').toUpperCase();
    if (!cleanPlate) {
      setFormError('Please enter a license plate number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await vehiclesApi.registerVehicle({
        plate_number: cleanPlate,
        owner_name: formOwner.trim(),
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });

      setFormPlate('');
      setFormOwner('');
      setFormStatus('KNOWN');
      setFormNotes('');
      setIsAddModalOpen(false);
      await fetchVehicles();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, plate: string) => {
    if (!window.confirm(`Remove registered vehicle '${plate}'?`)) return;
    setIsDeleting(id);
    try {
      await vehiclesApi.deleteVehicle(id);
      registryStorage.deleteVehicle(plate);
      await fetchVehicles();
    } catch (err) {
      alert(`Failed to delete: ${formatApiError(err)}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.plate_number.toLowerCase().includes(q) ||
      (v.owner_name && v.owner_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="Vehicles"
        subtitle="Manage authorized vehicles and security watchlist targets"
        onRefresh={fetchVehicles}
        isRefreshing={loading}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Vehicle
          </Button>
        }
      />

      {/* Filter / Search Bar */}
      {vehicles.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plate or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total: <span className="text-white font-bold">{vehicles.length}</span> vehicles
          </span>
        </div>
      )}

      {error && (
        <ErrorMessage
          title="Vehicle Registry Offline"
          message={error}
          onRetry={fetchVehicles}
        />
      )}

      {/* Vehicles Table / Cards */}
      {loading && vehicles.length === 0 ? (
        <CardSkeleton count={4} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="No Registered Vehicles"
          description="Add a known or watchlist license plate to enable automatic vehicle classification."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Vehicle
            </Button>
          }
        />
      ) : filteredVehicles.length === 0 ? (
        <div className="p-8 text-center bg-surface border border-surface-border rounded-xl text-slate-400 text-xs">
          No vehicles match your search.
        </div>
      ) : (
        <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/40">
                  <th className="py-3.5 pl-4">License Plate</th>
                  <th className="py-3.5">Owner / Description</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Registered On</th>
                  <th className="py-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {filteredVehicles.map((veh) => {
                  const isWatchlist = veh.status === 'WATCHLIST' || veh.status === 'FLAGGED';

                  return (
                    <tr key={veh.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                            <Car className="w-4 h-4 text-cyan-400" />
                          </div>
                          <span className="text-yellow-300 font-bold text-sm tracking-wider font-mono">
                            {veh.plate_number}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <p className="text-slate-100 font-semibold">{veh.owner_name || '—'}</p>
                        {veh.notes && <p className="text-[10px] text-slate-400">{veh.notes}</p>}
                      </td>
                      <td className="py-3.5">
                        {isWatchlist ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                            <Flame className="w-3 h-3 text-red-400" />
                            WATCHLIST / FLAGGED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            KNOWN
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-400">
                        {veh.created_at ? new Date(veh.created_at).toLocaleDateString() : 'Active'}
                      </td>
                      <td className="py-3.5 text-right pr-4">
                        <button
                          onClick={() => handleDelete(veh.id, veh.plate_number)}
                          disabled={isDeleting === veh.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                          title="Delete Vehicle"
                        >
                          {isDeleting === veh.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
                  <Car className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Add Vehicle</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded bg-red-950/60 border border-red-800 text-red-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  License Plate Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL01AB1234 or HR26DK8337"
                  value={formPlate}
                  onChange={(e) => setFormPlate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-yellow-300 focus:outline-none focus:border-blue-500 font-mono font-bold uppercase text-sm"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Owner Name / Fleet Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma / Security Patrol #1"
                  value={formOwner}
                  onChange={(e) => setFormOwner(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Classification Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('KNOWN')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                      formStatus === 'KNOWN'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>KNOWN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStatus('WATCHLIST')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                      formStatus === 'WATCHLIST'
                        ? 'bg-red-950/90 text-red-300 border-red-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-red-400" />
                    <span>FLAGGED</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Authorized visitor / Stolen vehicle report"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting || !formPlate.trim()}
                >
                  {isSubmitting ? 'Saving...' : 'Save Vehicle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
