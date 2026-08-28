import { apiClient } from './apiClient';
import { WatchlistEntry, CreateWatchlistInput, UpdateWatchlistInput } from '../types/watchlist';
import { MOCK_WATCHLIST } from '../data/mockData';
import { mapApiWatchlistToWatchlistEntry } from '../utils/mappers';

let inMemoryWatchlist = [...MOCK_WATCHLIST];

export const watchlistService = {
  /**
   * Fetch border watchlist registry GET /api/v1/watchlist
   */
  async getWatchlist(): Promise<{ data: WatchlistEntry[]; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.get<unknown[]>('/watchlist');
      const mappedEntries = Array.isArray(data) ? data.map(mapApiWatchlistToWatchlistEntry) : [];
      return { data: mappedEntries, isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for GET /api/v1/watchlist. Using mock development fallback.', error);
      return { data: inMemoryWatchlist, isLive: false };
    }
  },

  /**
   * Add new watchlist target entry POST /api/v1/watchlist
   */
  async addWatchlistEntry(input: CreateWatchlistInput): Promise<{ data: WatchlistEntry; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.post<Record<string, any>>('/watchlist', input);
      return { data: mapApiWatchlistToWatchlistEntry(data), isLive };
    } catch (error) {
      console.warn('[IBVAP API Service] Backend unreachable for POST /api/v1/watchlist.', error);
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
      return { data: newEntry, isLive: false };
    }
  },

  /**
   * Update existing watchlist entry PATCH /api/v1/watchlist/:id
   */
  async updateWatchlistEntry(id: string, input: UpdateWatchlistInput): Promise<{ data: WatchlistEntry; isLive: boolean }> {
    try {
      const { data, isLive } = await apiClient.patch<Record<string, any>>(`/watchlist/${id}`, input);
      return { data: mapApiWatchlistToWatchlistEntry(data), isLive };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for PATCH /api/v1/watchlist/${id}.`, error);
      inMemoryWatchlist = inMemoryWatchlist.map(w => w.id === id ? { ...w, ...input } : w);
      const updated = inMemoryWatchlist.find(w => w.id === id)!;
      return { data: updated, isLive: false };
    }
  },

  /**
   * Delete watchlist entry DELETE /api/v1/watchlist/:id
   */
  async deleteWatchlistEntry(id: string): Promise<{ success: boolean; isLive: boolean }> {
    try {
      await apiClient.del(`/watchlist/${id}`);
      return { success: true, isLive: true };
    } catch (error) {
      console.warn(`[IBVAP API Service] Backend unreachable for DELETE /api/v1/watchlist/${id}.`, error);
      inMemoryWatchlist = inMemoryWatchlist.filter(w => w.id !== id);
      return { success: true, isLive: false };
    }
  },
};
