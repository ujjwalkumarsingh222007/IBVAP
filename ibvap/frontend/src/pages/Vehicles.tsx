import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Car, RefreshCw, CheckCircle2, ShieldAlert, Trash2, Search } from 'lucide-react';
import { vehicleApi } from '../api/vehicleApi';
import { Vehicle } from '../types';
import { RegisterVehicleModal } from '../components/vehicles/RegisterVehicleModal';
import { EditVehicleModal } from '../components/vehicles/EditVehicleModal';
import { ViewVehicleModal } from '../components/vehicles/ViewVehicleModal';
import { formatTimestamp } from '../utils/formatters';

export const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'KNOWN' | 'FLAGGED'>('ALL');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal states
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vehicleApi.getVehicles();
      setVehicles(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleDeleteVehicle = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this vehicle registration?')) return;
    try {
      await vehicleApi.deleteVehicle(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchVehicles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete vehicle');
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredVehicles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVehicles.map((v) => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = `Are you sure you want to delete ${selectedIds.size} selected vehicle(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await vehicleApi.bulkDeleteVehicles(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchVehicles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: 'KNOWN' | 'FLAGGED' | 'WATCHLIST') => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      await vehicleApi.bulkUpdateVehicleStatus(Array.from(selectedIds), newStatus);
      setSelectedIds(new Set());
      await fetchVehicles();
    } catch (err: any) {
      alert(err.message || 'Failed to update status for selected vehicles');
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.owner_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'KNOWN' && v.status === 'KNOWN') ||
      (statusFilter === 'FLAGGED' && (v.status === 'FLAGGED' || v.status === 'WATCHLIST'));
    return matchesSearch && matchesStatus;
  });

  const isAllSelected = filteredVehicles.length > 0 && selectedIds.size === filteredVehicles.length;
  const knownCount = vehicles.filter((v) => v.status === 'KNOWN').length;
  const flaggedCount = vehicles.filter((v) => v.status === 'FLAGGED' || v.status === 'WATCHLIST').length;

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              ANPR / NUMBER PLATE REGISTRY
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-bold">
              {vehicles.length} VEHICLES
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Authorized vehicle fleet whitelist, OCR normalization patterns, and flagged watchlist.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchVehicles}
            className="p-2 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 transition-colors border border-surface-border"
            title="Refresh database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-3.5 py-1.5 rounded bg-tactical-blue hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-tactical cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Register License Plate
          </button>
        </div>
      </div>

      {/* 2. Status Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">TOTAL REGISTERED</div>
            <div className="text-xl font-bold text-white mt-0.5">{vehicles.length}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
            <Car className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">AUTHORIZED (KNOWN)</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{knownCount}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">WATCHLIST (FLAGGED)</div>
            <div className="text-xl font-bold text-red-400 mt-0.5">{flaggedCount}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-red-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filters */}
      <div className="p-3 rounded-lg bg-surface border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-tactical">
        <div className="flex-1 max-w-md relative">
          <Search className="w-3.5 h-3.5 text-tactical-slate absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by license plate or owner (e.g. UP19EQ1001)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-subtle border border-surface-border text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-tactical-blue font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-tactical-slate uppercase font-bold">STATUS:</span>
          <div className="flex items-center gap-1 bg-surface-subtle border border-surface-border p-1 rounded">
            {(['ALL', 'KNOWN', 'FLAGGED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  statusFilter === st
                    ? 'bg-tactical-blue text-white'
                    : 'text-tactical-slate hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="p-2.5 rounded-lg bg-surface-elevated border border-tactical-blue flex items-center justify-between text-xs animate-fade-in shadow-tactical">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="font-bold text-tactical-blue">{selectedIds.size}</span>
            <span>VEHICLES SELECTED</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('KNOWN')}
              className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 text-[11px] font-bold"
            >
              Mark KNOWN
            </button>
            <button
              onClick={() => handleBulkStatusChange('FLAGGED')}
              className="px-2.5 py-1 rounded bg-red-950/40 border border-red-500/50 text-red-300 hover:bg-red-900/60 text-[11px] font-bold"
            >
              Mark FLAGGED
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* 5. Dense Tactical Vehicles Table */}
      <div className="bg-surface border border-surface-border rounded-lg overflow-hidden shadow-tactical">
        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-tactical-slate">
            <Car className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <div className="text-xs font-semibold">NO MATCHING VEHICLES FOUND</div>
            <div className="text-[10px] text-tactical-slate/70 mt-0.5">Try adjusting search parameters.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-subtle text-tactical-slate text-[10px] uppercase">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-surface-border bg-surface text-tactical-blue focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">LICENSE PLATE</th>
                  <th className="py-2.5 px-3">REGISTERED OWNER</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">DESIGNATION / NOTES</th>
                  <th className="py-2.5 px-3">REGISTERED</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {filteredVehicles.map((vehicle) => {
                  const isSelected = selectedIds.has(vehicle.id);
                  const isKnown = vehicle.status === 'KNOWN';

                  return (
                    <tr
                      key={vehicle.id}
                      className={`hover:bg-surface-subtle/70 transition-colors ${
                        isSelected ? 'bg-surface-subtle' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(vehicle.id)}
                          className="rounded border-surface-border bg-surface text-tactical-blue focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Stylized Indian License Plate Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center rounded border border-slate-700 bg-black overflow-hidden font-mono shadow-sm">
                          <div className="bg-blue-800 text-white text-[9px] px-1 py-0.5 font-bold border-r border-slate-700 flex flex-col items-center justify-center leading-none">
                            <span>IND</span>
                          </div>
                          <div className="px-2 py-0.5 text-xs font-bold text-white tracking-widest">
                            {vehicle.plate_number}
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-2.5 px-3 font-bold text-slate-100">
                        {vehicle.owner_name}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isKnown
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          {vehicle.status}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3 text-tactical-slate truncate max-w-xs text-[11px]">
                        {vehicle.notes || '—'}
                      </td>

                      {/* Enrolled */}
                      <td className="py-2.5 px-3 text-tactical-slate text-[11px]">
                        {formatTimestamp(vehicle.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewVehicle(vehicle)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 border border-surface-border text-[10px]"
                          title="Inspect Vehicle"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setEditVehicle(vehicle)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-surface-elevated text-tactical-blue border border-surface-border text-[10px]"
                          title="Edit Details"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-red-950/40 text-red-400 border border-surface-border text-[10px]"
                          title="Delete Record"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Modal */}
      {isRegisterModalOpen && (
        <RegisterVehicleModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={() => {
            setIsRegisterModalOpen(false);
            fetchVehicles();
          }}
        />
      )}

      {/* View Modal */}
      {viewVehicle && (
        <ViewVehicleModal
          isOpen={Boolean(viewVehicle)}
          vehicle={viewVehicle}
          onClose={() => setViewVehicle(null)}
          onEdit={(v) => {
            setViewVehicle(null);
            setEditVehicle(v);
          }}
        />
      )}

      {/* Edit Modal */}
      {editVehicle && (
        <EditVehicleModal
          isOpen={Boolean(editVehicle)}
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSuccess={() => {
            setEditVehicle(null);
            fetchVehicles();
          }}
        />
      )}
    </div>
  );
};
