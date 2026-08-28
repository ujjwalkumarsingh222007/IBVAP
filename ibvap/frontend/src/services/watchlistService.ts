import { apiFetch } from './api';
import { WatchlistEntry, CreateWatchlistInput, UpdateWatchlistInput } from '../types/watchlist';
import { MOCK_WATCHLIST } from '../data/mockData';

let inMemoryWatchlist = [...MOCK_WATCHLIST];

export const watchlistService = {
  /**
   * Fetch border watchlist registry GET /api/v1/watchlist
   */
  async getWatchlist(): Promise<WatchlistEntry[]> {
    try {
      return await apiFetch<WatchlistEntry[]>('/watchlist');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/watchlist. Using fallback UI mock data.', error);
      return inMemoryWatchlist;
    }
  },

  /**
   * Add new watchlist target entry POST /api/v1/watchlist
   */
  async addWatchlistEntry(input: CreateWatchlistInput): Promise<WatchlistEntry> {
    try {
      return await apiFetch<WatchlistEntry>('/watchlist', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for POST /api/v1/watchlist.', error);
      const newEntry: WatchlistEntry = {
        id: `WL-${Math.floor(1000 + Math.random() * 9000)}`,
        category: input.category,
        identifier: input.identifier,
        name: input.name,
        vehicle_type: input.vehicle_type,
        priority: input.priority,
        status: input.status || 'ACTIVE',
        notes: input.notes,
        created_at: new Date().toISOString(),
        matches_count: 0,
      };
      inMemoryWatchlist = [newEntry, ...inMemoryWatchlist];
      return newEntry;
    }
  },

  /**
   * Update existing watchlist entry PUT/PATCH /api/v1/watchlist/:id
   */
  async updateWatchlistEntry(id: string, input: UpdateWatchlistInput): Promise<WatchlistEntry> {
    try {
      return await apiFetch<WatchlistEntry>(`/watchlist/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for PATCH /api/v1/watchlist/${id}.`, error);
      inMemoryWatchlist = inMemoryWatchlist.map(w => w.id === id ? { ...w, ...input } : w);
      return inMemoryWatchlist.find(w => w.id === id)!;
    }
  },

  /**
   * Delete watchlist entry DELETE /api/v1/watchlist/:id
   */
  async deleteWatchlistEntry(id: string): Promise<boolean> {
    try {
      await apiFetch<void>(`/watchlist/${id}`, { method: 'DELETE' });
      return true;
    } catch (error) {
      console.warn(`[IBVAP API] Backend unreachable for DELETE /api/v1/watchlist/${id}.`, error);
      inMemoryWatchlist = inMemoryWatchlist.filter(w => w.id !== id);
      return true;
    }
  },
};
