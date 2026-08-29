import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  Search,
  User,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { RegisterPersonModal } from '../components/people/RegisterPersonModal';
import { personsApi, PersonItem } from '../api/personsApi';
import { registryStorage } from '../services/registryStorage';
import { formatApiError } from '../api';

export const People: React.FC = () => {
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      const data = await personsApi.getPersons();
      setPeople(data);
      setError(null);

      // Sync with clientside registry storage
      data.forEach((p) => {
        registryStorage.addPerson({
          id: p.person_code || `P-${p.id}`,
          name: p.name,
          status: p.status as 'KNOWN' | 'FLAGGED',
          notes: p.notes,
          photoUrl: p.face_image_path,
        });
      });
    } catch (err) {
      setError(formatApiError(err));
      // Fallback to local storage
      const local = registryStorage.getPeople().map((lp, idx) => ({
        id: idx + 1,
        person_code: lp.id,
        name: lp.name,
        status: lp.status,
        notes: lp.notes,
        face_image_path: lp.photoUrl,
        created_at: lp.created_at,
      }));
      setPeople(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete registered person '${name}'?`)) return;
    setIsDeleting(id);
    try {
      await personsApi.deletePerson(id);
      await fetchPeople();
    } catch (err) {
      alert(`Failed to delete: ${formatApiError(err)}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredPeople = people.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.person_code && p.person_code.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 font-mono">
      <Header
        title="People"
        subtitle="Manage registered individuals for biometric face recognition"
        onRefresh={fetchPeople}
        isRefreshing={loading}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Register Person
          </Button>
        }
      />

      {/* Top Filter & Search Bar */}
      {people.length > 0 && (
        <div className="bg-surface border border-surface-border rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total: <span className="text-white font-bold">{people.length}</span> registered
          </span>
        </div>
      )}

      {error && (
        <ErrorMessage
          title="Registry Offline"
          message={error}
          onRetry={fetchPeople}
        />
      )}

      {/* People Grid */}
      {loading && people.length === 0 ? (
        <CardSkeleton count={4} />
      ) : people.length === 0 ? (
        <EmptyState
          title="No Registered People"
          description="Register a person with live face scan to enable biometric recognition."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRegisterModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Register Person
            </Button>
          }
        />
      ) : filteredPeople.length === 0 ? (
        <div className="p-8 text-center bg-surface border border-surface-border rounded-xl text-slate-400 text-xs">
          No registered individuals match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPeople.map((person) => {
            const isFlagged = person.status === 'FLAGGED';

            return (
              <div
                key={person.id}
                className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-md flex flex-col justify-between hover:border-slate-500 transition-all group"
              >
                {/* Photo Preview */}
                <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
                  {person.face_image_path ? (
                    <img
                      src={person.face_image_path}
                      alt={person.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <User className="w-16 h-16 text-slate-600" />
                  )}

                  <div className="absolute top-2 left-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shadow-md ${
                        isFlagged
                          ? 'bg-red-950/90 text-red-300 border border-red-800 animate-pulse'
                          : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {isFlagged ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          FLAGGED
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                          KNOWN
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 truncate font-sans">
                      {person.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {person.person_code || `P-${person.id}`}
                    </p>
                  </div>

                  {person.notes && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {person.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                    <span>
                      {person.created_at
                        ? new Date(person.created_at).toLocaleDateString()
                        : 'Registered'}
                    </span>
                    <button
                      onClick={() => handleDelete(person.id, person.name)}
                      disabled={isDeleting === person.id}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      title="Delete Person"
                    >
                      {isDeleting === person.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Person Modal with Live Webcam Scanning */}
      <RegisterPersonModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={fetchPeople}
      />
    </div>
  );
};

export default People;
