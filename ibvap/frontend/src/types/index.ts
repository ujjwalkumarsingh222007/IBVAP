/**
 * TypeScript definitions for IBVAP Frontend matching Backend models and schemas.
 */

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  username: string;
}

export type EventType =
  | 'ALL'
  | 'OBJECT_DETECTED'
  | 'VEHICLE_DETECTED'
  | 'PERSON_DETECTED'
  | 'ANPR_DETECTED'
  | 'INTRUSION_DETECTED'
  | 'WATCHLIST_MATCH'
  | 'SUSPICIOUS_ACTIVITY';

export interface EventMetadata {
  track_id?: number;
  class_name?: string;
  bbox?: [number, number, number, number] | number[];
  position?: {
    x: number;
    y: number;
  };
  // ANPR Fields
  plate_number?: string;
  raw_ocr_text?: string;
  plate_confidence?: number;
  ocr_confidence?: number;
  vehicle_id?: string;
  watchlist_match?: boolean;
  watchlist_status?: string;
  watchlist_reason?: string;
  validation_passed?: boolean;
  validation_reason?: string;
  duplicate_suppressed?: boolean;
  [key: string]: unknown;
}

export interface SurveillanceEvent {
  id: number;
  camera_id: string;
  event_type: EventType | string;
  timestamp: string;
  confidence: number;
  metadata: EventMetadata;
  created_at?: string;
}

export interface DashboardSummary {
  total_events: number;
  total_intrusions: number;
  total_persons: number;
  total_vehicles: number;
  total_anpr: number;
  total_watchlist_matches: number;
  total_suspicious_activity: number;
  active_cameras: number;
  total_cameras: number;
}

export interface EventStats {
  total_events: number;
  total_intrusions: number;
  total_vehicles: number;
  total_persons: number;
  total_anpr: number;
  total_watchlist_matches: number;
  total_suspicious_activity: number;
}

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Camera {
  id: number;
  camera_id: string;
  name: string;
  location?: string | null;
  status: CameraStatus;
  created_at: string;
  updated_at: string;
}

export interface CameraCreateInput {
  camera_id: string;
  name: string;
  location?: string;
  status?: CameraStatus;
}

export interface CameraUpdateInput {
  name?: string;
  location?: string;
  status?: CameraStatus;
}

export interface HealthStatus {
  status: string;
  service: string;
  database: string;
}

export interface EventFilters {
  event_type?: string;
  camera_id?: string;
  confidence_min?: number;
  confidence_max?: number;
  limit?: number;
  offset?: number;
}

export interface EventCount {
  count: number;
}
