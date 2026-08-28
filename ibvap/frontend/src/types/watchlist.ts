export type WatchlistCategory = 'WANTED_VEHICLE' | 'SUSPECT_PERSON' | 'STOLEN_PLATE' | 'RESTRICTED_ACCESS' | 'VIP';
export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WatchlistEntry {
  id: string;
  category: WatchlistCategory;
  identifier: string; // License plate string or Person ID
  name: string;
  priority: PriorityLevel;
  notes: string;
  created_at: string;
  matches_count: number;
  last_seen?: string;
  last_seen_camera?: string;
  image_url?: string;
}

export interface CreateWatchlistInput {
  category: WatchlistCategory;
  identifier: string;
  name: string;
  priority: PriorityLevel;
  notes: string;
  image_url?: string;
}
