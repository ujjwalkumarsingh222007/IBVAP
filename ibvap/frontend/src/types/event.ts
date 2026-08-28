export type EventType =
  | 'OBJECT_DETECTED'
  | 'VEHICLE_DETECTED'
  | 'PERSON_DETECTED'
  | 'ANPR_DETECTED'
  | 'INTRUSION_DETECTED'
  | 'WATCHLIST_MATCH'
  | 'SUSPICIOUS_ACTIVITY';

export interface EventMetadata {
  bounding_box?: [number, number, number, number]; // [x1, y1, x2, y2]
  license_plate?: string;
  vehicle_type?: string;
  person_count?: number;
  speed_kmh?: number;
  threat_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  zone_id?: string;
  tracking_id?: string;
  details?: string;
  [key: string]: unknown;
}

export interface Event {
  id?: string;
  camera_id: string;
  event_type: EventType;
  timestamp: string;
  confidence: number; // 0.00 to 1.00
  metadata: EventMetadata;
  status?: 'PROCESSED' | 'PENDING' | 'FLAGGED';
}

export interface EventFilter {
  search_query?: string;
  event_type?: EventType | 'ALL';
  camera_id?: string | 'ALL';
  min_confidence?: number;
  start_date?: string;
  end_date?: string;
}
