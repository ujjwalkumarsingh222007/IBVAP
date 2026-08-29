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

// ---------------------------------------------------------------------------
// Phase 3B Analytics & Threat Intelligence Types
// ---------------------------------------------------------------------------

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ThreatCounts {
  total_threats: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ConfidenceStats {
  avg_confidence: number;
  min_confidence: number;
  max_confidence: number;
}

export interface AnalyticsSummary {
  total_events: number;
  threats: ThreatCounts;
  confidence_stats: ConfidenceStats;
  event_type_counts: Record<string, number>;
  time_range: {
    start_time?: string | null;
    end_time?: string | null;
  };
}

export interface TrendBucket {
  bucket: string;
  total_events: number;
  intrusions: number;
  watchlist_matches: number;
  suspicious_activity: number;
  vehicles: number;
  persons: number;
  total_threats: number;
  avg_confidence: number;
}

export interface AnalyticsTrends {
  interval: string;
  trends: TrendBucket[];
}

export interface CameraActivityRanking {
  camera_id: string;
  camera_name?: string | null;
  location?: string | null;
  status?: string | null;
  total_events: number;
  threat_count: number;
  critical_threats: number;
  high_threats: number;
  medium_threats: number;
  avg_confidence: number;
  last_event_time?: string | null;
}

export interface AnalyticsCameras {
  cameras: CameraActivityRanking[];
}

export interface EventTypeDistributionItem {
  event_type: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDistribution {
  total_events: number;
  distribution: EventTypeDistributionItem[];
  threat_breakdown: ThreatCounts;
}

export interface AnalyticsQueryParams {
  start_time?: string;
  end_time?: string;
  camera_id?: string;
  event_type?: string;
  interval?: 'hourly' | 'daily';
}

// ---------------------------------------------------------------------------
// Phase 3C Audit & Demo Types
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: number;
  user_id?: number | null;
  username: string;
  action: string;
  endpoint: string;
  timestamp: string;
  success: boolean;
  details?: string | null;
}

export interface DemoResetResponse {
  status: string;
  message: string;
  events_cleared: number;
  cameras_restored: number;
}

// ---------------------------------------------------------------------------
// Phase 3C Live AI Processing Types
// ---------------------------------------------------------------------------

export interface AIDetectionItem {
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  track_id?: number | null;
  plate_number?: string | null;
  raw_ocr_text?: string | null;
  plate_confidence?: number | null;
  ocr_confidence?: number | null;
  watchlist_match?: boolean | null;
  watchlist_status?: string | null;
  watchlist_reason?: string | null;
  is_known?: boolean;
  is_flagged?: boolean;
  person_name?: string | null;
  person_id?: string | null;
  status?: string | null;
  face_similarity?: number | null;
}

export interface AIFrameProcessResponse {
  status: string;
  camera_id: string;
  processed: boolean;
  detections_count: number;
  detections: AIDetectionItem[];
  events_count: number;
  events: SurveillanceEvent[];
  correlated_threat?: {
    id: number;
    threat_id: string;
    camera_id: string;
    severity: string;
    score: number;
    title: string;
    reason: string;
    status: string;
    first_event_time: string;
    last_event_time: string;
    event_count: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Phase 3D Threat Intelligence & Correlation Types
// ---------------------------------------------------------------------------

export type ThreatStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface ThreatTimelineItem {
  id?: number;
  timestamp: string;
  event_type: string;
  camera_id: string;
  description: string;
  confidence: number;
  metadata: EventMetadata;
}

export interface Threat {
  id: number;
  threat_id: string;
  camera_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  title: string;
  reason: string;
  status: ThreatStatus;
  first_event_time: string;
  last_event_time: string;
  event_count: number;
  threat_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ThreatDetail extends Threat {
  events: SurveillanceEvent[];
  timeline: ThreatTimelineItem[];
}

export interface ThreatStats {
  total_threats: number;
  active_threats: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  acknowledged: number;
  resolved: number;
}

export interface ThreatStatusUpdateInput {
  status: ThreatStatus;
  reason?: string;
}

export interface RegisteredPerson {
  id: string;
  name: string;
  photoUrl?: string;
  status: 'KNOWN' | 'FLAGGED';
  notes?: string;
  created_at: string;
}

export interface RegisteredVehicle {
  id: string;
  plate_number: string;
  owner_name: string;
  status: 'REGISTERED' | 'WATCHLIST';
  notes?: string;
  created_at: string;
}

export interface EvidenceItem {
  id: number;
  camera_id: string;
  timestamp: string;
  detection_type: 'person' | 'vehicle' | string;
  status: 'UNKNOWN' | 'FLAGGED' | 'KNOWN' | string;
  confidence: number;
  image_path: string;
  crop_image_path?: string | null;
  bbox_x1?: number | null;
  bbox_y1?: number | null;
  bbox_x2?: number | null;
  bbox_y2?: number | null;
  person_id?: string | null;
  vehicle_id?: string | null;
  plate_number?: string | null;
  reason?: string | null;
  event_id?: number | null;
  created_at?: string | null;
}

export interface EvidenceFilterParams {
  limit?: number;
  offset?: number;
  camera_id?: string;
  detection_type?: string;
  status?: string;
}

