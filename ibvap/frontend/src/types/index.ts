// IBVAP V2 — Type Definitions

export type EntityStatus = 'KNOWN' | 'UNKNOWN' | 'FLAGGED';

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ThreatStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Camera {
  id: number;
  camera_id: string;
  name: string;
  location?: string | null;
  status: CameraStatus;
  created_at: string;
  updated_at: string;
}

export interface CameraCreatePayload {
  camera_id: string;
  name: string;
  location?: string;
  status?: CameraStatus;
}

export interface CameraUpdatePayload {
  name?: string;
  location?: string;
  status?: CameraStatus;
}

export interface BoundingBoxRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AIDetection {
  class_name: string;
  confidence: number;
  track_id?: number | null;
  bbox?: BoundingBoxRect | { x1: number; y1: number; x2: number; y2: number } | null;
  plate_number?: string | null;
  person_name?: string | null;
  person_id?: string | null;
  status?: EntityStatus | string;
  is_known?: boolean;
  is_flagged?: boolean;
  face_similarity?: number;
  should_emit_alert?: boolean;
  should_capture_evidence?: boolean;
  watchlist_match?: boolean;
  position?: { x: number; y: number } | null;
}

export interface AIProcessFrameResponse {
  status: string;
  camera_id: string;
  processed: boolean;
  detections_count: number;
  detections: AIDetection[];
  events_count: number;
  events: SurveillanceEventPayload[];
  correlated_threat?: CorrelatedThreat | null;
}

export interface SurveillanceEventPayload {
  id?: number;
  camera_id: string;
  event_type: string;
  timestamp: string;
  confidence: number;
  metadata: {
    track_id?: number;
    class_name?: string;
    person_name?: string;
    person_id?: string;
    status?: string;
    plate_number?: string;
    bbox?: number[] | BoundingBoxRect;
    position?: { x: number; y: number };
    fence_zone?: string;
    [key: string]: any;
  };
  created_at?: string;
}

export interface CorrelatedThreat {
  id: number;
  threat_id: string;
  camera_id: string;
  severity: ThreatSeverity;
  score: number;
  title: string;
  reason: string;
  status: ThreatStatus;
  first_event_time: string;
  last_event_time: string;
  event_count: number;
  threat_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Person {
  id: number;
  person_code: string;
  name: string;
  status: 'KNOWN' | 'FLAGGED';
  face_image_path?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PersonRegisterResponse {
  status: string;
  person_id: string;
  name: string;
  person_status: string;
  face_image_url?: string | null;
  message: string;
}

export interface FaceValidationResponse {
  valid: boolean;
  message: string;
  angle?: string;
  faces_count: number;
  face_bbox?: { x: number; y: number; w: number; h: number } | null;
  guidance?: 'PERFECT' | 'MOVE_CLOSER' | 'MOVE_BACK' | 'MOVE_LEFT' | 'MOVE_RIGHT' | 'MOVE_UP' | 'MOVE_DOWN' | 'IMPROVE_LIGHTING' | 'HOLD_STILL' | 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_UP' | 'LOOK_DOWN' | string;
  detected_pose?: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | string;
  quality_score?: number;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  owner_name: string;
  status: 'KNOWN' | 'FLAGGED' | 'WATCHLIST';
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VehicleRegisterPayload {
  plate_number: string;
  owner_name?: string;
  status: 'KNOWN' | 'FLAGGED' | 'WATCHLIST';
  notes?: string;
}

export interface EvidenceItem {
  id: number;
  camera_id: string;
  timestamp: string;
  detection_type: 'person' | 'vehicle' | string;
  status: 'KNOWN' | 'UNKNOWN' | 'FLAGGED' | string;
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

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  service: string;
  database: 'connected' | 'disconnected' | 'unknown';
  version: string;
  uptime_seconds?: number;
  active_cameras?: number;
  total_events?: number;
  ai_pipeline_status?: string;
  anpr_detector?: string | null;
  ocr_engine?: string | null;
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

export interface RealtimeAlert {
  id: string;
  type: 'UNKNOWN_PERSON' | 'FLAGGED_PERSON' | 'UNKNOWN_VEHICLE' | 'FLAGGED_VEHICLE' | 'INTRUSION';
  title: string;
  description: string;
  camera_id: string;
  timestamp: string;
  severity: ThreatSeverity;
  imageUrl?: string;
  person_name?: string;
  plate_number?: string;
  confidence?: number;
}
