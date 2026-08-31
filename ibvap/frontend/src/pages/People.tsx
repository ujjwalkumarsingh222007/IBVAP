import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Users, RefreshCw, UserCheck, ShieldAlert, Trash2, Search } from 'lucide-react';
import { peopleApi } from '../api/peopleApi';
import { Person } from '../types';
import { FaceScanModal } from '../components/people/FaceScanModal';
import { EditPersonModal } from '../components/people/EditPersonModal';
import { ViewPersonModal } from '../components/people/ViewPersonModal';
import { formatTimestamp } from '../utils/formatters';

export const People: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'KNOWN' | 'FLAGGED'>('ALL');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal states
  const [viewPerson, setViewPerson] = useState<Person | null>(null);
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const data = await peopleApi.getPeople();
      setPeople(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleDeletePerson = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this biometric person profile?')) return;
    try {
      await peopleApi.deletePerson(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchPeople();
    } catch (err: any) {
      alert(err.message || 'Failed to delete person');
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
    if (selectedIds.size === filteredPeople.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPeople.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = `Are you sure you want to delete ${selectedIds.size} selected profile(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await peopleApi.bulkDeletePeople(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchPeople();
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: 'KNOWN' | 'FLAGGED') => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      await peopleApi.bulkUpdateStatus(Array.from(selectedIds), newStatus);
      setSelectedIds(new Set());
      await fetchPeople();
    } catch (err: any) {
      alert(err.message || 'Failed to update status for selected profiles');
    } finally {
      setLoading(false);
    }
  };

  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.person_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isAllSelected = filteredPeople.length > 0 && selectedIds.size === filteredPeople.length;
  const knownCount = people.filter((p) => p.status === 'KNOWN').length;
  const flaggedCount = people.filter((p) => p.status === 'FLAGGED').length;

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* 1. Header & Actions */}
      <div className="bg-surface border border-surface-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactical">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide uppercase">
              BIOMETRIC IDENTITY REPOSITORY
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-tactical-blue border border-surface-border font-bold">
              {people.length} ENROLLED
            </span>
          </div>
          <p className="text-[11px] text-tactical-slate mt-0.5">
            Facial descriptors, authorized personnel whitelist, and security watchlist.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPeople}
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
            Enroll Person (Biometrics)
          </button>
        </div>
      </div>

      {/* 2. Status Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">TOTAL ENROLLED</div>
            <div className="text-xl font-bold text-white mt-0.5">{people.length}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-tactical-blue">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-[10px] text-tactical-slate uppercase font-bold">AUTHORIZED (KNOWN)</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{knownCount}</div>
          </div>
          <div className="w-8 h-8 rounded bg-surface-elevated border border-surface-border flex items-center justify-center text-emerald-400">
            <UserCheck className="w-4 h-4" />
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

      {/* 3. Search & Filter Bar */}
      <div className="p-3 rounded-lg bg-surface border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-tactical">
        <div className="flex-1 max-w-md relative">
          <Search className="w-3.5 h-3.5 text-tactical-slate absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or person code (e.g. P-01683EE3)..."
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
            <span>PROFILES SELECTED</span>
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

      {/* 5. Dense Tactical People Table */}
      <div className="bg-surface border border-surface-border rounded-lg overflow-hidden shadow-tactical">
        {filteredPeople.length === 0 ? (
          <div className="p-12 text-center text-tactical-slate">
            <Users className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <div className="text-xs font-semibold">NO MATCHING PERSON PROFILES</div>
            <div className="text-[10px] text-tactical-slate/70 mt-0.5">Try refining your search query or filters.</div>
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
                  <th className="py-2.5 px-3">PHOTO</th>
                  <th className="py-2.5 px-3">PERSON CODE</th>
                  <th className="py-2.5 px-3">FULL NAME</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">BIOMETRICS</th>
                  <th className="py-2.5 px-3">ENROLLED</th>
                  <th className="py-2.5 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {filteredPeople.map((person) => {
                  const isSelected = selectedIds.has(person.id);
                  const isKnown = person.status === 'KNOWN';
                  const imgUrl = person.face_image_path
                    ? (person.face_image_path.startsWith('http')
                        ? person.face_image_path
                        : `http://127.0.0.1:8000${person.face_image_path.startsWith('/') ? '' : '/'}${person.face_image_path}`)
                    : null;

                  return (
                    <tr
                      key={person.id}
                      className={`hover:bg-surface-subtle/70 transition-colors ${
                        isSelected ? 'bg-surface-subtle' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(person.id)}
                          className="rounded border-surface-border bg-surface text-tactical-blue focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Face Thumbnail */}
                      <td className="py-2 px-3">
                        <div className="w-9 h-9 rounded bg-surface-elevated border border-surface-border overflow-hidden flex items-center justify-center shrink-0">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={person.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Users className="w-4 h-4 text-tactical-slate" />
                          )}
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-2 px-3 font-bold text-tactical-blue">
                        {person.person_code}
                      </td>

                      {/* Name */}
                      <td className="py-2 px-3 font-bold text-slate-100">
                        {person.name}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isKnown
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          {person.status}
                        </span>
                      </td>

                      {/* Biometrics Status */}
                      <td className="py-2 px-3 text-tactical-slate text-[11px]">
                        <span className="text-emerald-400 font-bold">1306-D</span> VECTOR ACTIVE
                      </td>

                      {/* Enrolled Time */}
                      <td className="py-2 px-3 text-tactical-slate text-[11px]">
                        {formatTimestamp(person.created_at)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-2 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewPerson(person)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-surface-elevated text-slate-300 border border-surface-border text-[10px]"
                          title="Inspect Profile"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setEditPerson(person)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-surface-elevated text-tactical-blue border border-surface-border text-[10px]"
                          title="Edit Profile"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePerson(person.id)}
                          className="px-2 py-1 rounded bg-surface-subtle hover:bg-red-950/40 text-red-400 border border-surface-border text-[10px]"
                          title="Delete Profile"
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

      {/* Face Registration Modal */}
      {isRegisterModalOpen && (
        <FaceScanModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={() => {
            setIsRegisterModalOpen(false);
            fetchPeople();
          }}
        />
      )}

      {/* View Modal */}
      {viewPerson && (
        <ViewPersonModal
          isOpen={Boolean(viewPerson)}
          person={viewPerson}
          onClose={() => setViewPerson(null)}
          onEdit={(p) => {
            setViewPerson(null);
            setEditPerson(p);
          }}
        />
      )}

      {/* Edit Modal */}
      {editPerson && (
        <EditPersonModal
          isOpen={Boolean(editPerson)}
          person={editPerson}
          onClose={() => setEditPerson(null)}
          onSuccess={() => {
            setEditPerson(null);
            fetchPeople();
          }}
        />
      )}
    </div>
  );
};
