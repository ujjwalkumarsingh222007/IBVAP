import { apiFetch } from './api';
import { WatchlistEntry, CreateWatchlistInput } from '../types/watchlist';
import { MOCK_WATCHLIST } from '../data/mockData';

export const watchlistService = {
  /**
   * Fetch border watchlist registry GET /api/v1/watchlist
   */
  async getWatchlist(): Promise<WatchlistEntry[]> {
    try {
      return await apiFetch<WatchlistEntry[]>('/watchlist');
    } catch (error) {
      console.warn('[IBVAP API] Backend unreachable for /api/v1/watchlist. Using fallback UI mock data.', error);
      return MOCK_WATCHLIST;
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
      return {
        id: `WL-${Math.floor(1000 + Math.random() * 9000)}`,
        category: input.category,
        identifier: input.identifier,
        name: input.name,
        priority: input.priority,
        notes: input.notes,
        created_at: new Date().toISOString(),
        matches_count: 0,
      };
    }
  },
};
