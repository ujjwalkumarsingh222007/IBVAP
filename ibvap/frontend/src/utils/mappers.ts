import { Event, EventType } from '../types/event';
import { Camera, CameraStatus } from '../types/camera';
import { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import { Detection, ObjectCategory } from '../types/detection';
import { WatchlistEntry, WatchlistCategory, PriorityLevel, WatchlistStatus } from '../types/watchlist';

/**
 * Data Mapper utilities to convert raw FastAPI backend response payloads safely to UI contracts.
 * Protects components against unexpected field names, missing keys, or raw null values.
 */

export function mapApiEventToEvent(raw: any): Event {
  if (!raw || typeof raw !== 'object') {
    return {
      camera_id: 'CAM-01',
      event_type: 'OBJECT_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.90,
      metadata: {},
    };
  }

  const eventType: EventType = [
    'OBJECT_DETECTED',
    'VEHICLE_DETECTED',
    'PERSON_DETECTED',
    'ANPR_DETECTED',
    'INTRUSION_DETECTED',
    'WATCHLIST_MATCH',
    'SUSPICIOUS_ACTIVITY',
  ].includes(raw.event_type || raw.eventType)
    ? (raw.event_type || raw.eventType)
    : 'OBJECT_DETECTED';

  return {
    id: raw.id ? String(raw.id) : `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
    camera_id: raw.camera_id || raw.cameraId || raw.camera || 'CAM-01',
    event_type: eventType,
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.92,
    metadata: raw.metadata || raw.details || {},
    status: raw.status || 'PROCESSED',
  };
}

export function mapApiCameraToCamera(raw: any): Camera {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'CAM-01',
      name: 'Camera Stream',
      location: 'Border Post',
      stream_url: 'rtsp://192.168.1.1:554/live',
      status: 'ONLINE',
      fps: 30,
      resolution: '1920x1080',
      zone: 'Sector North',
      last_ping: new Date().toISOString(),
      ai_enabled: true,
    };
  }

  const rawStatus = String(raw.status || '').toUpperCase();
  const status: CameraStatus = ['ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE'].includes(rawStatus)
    ? (rawStatus as CameraStatus)
    : 'ONLINE';

  const rawStreamUrl = raw.stream_url || raw.streamUrl || raw.url || 'rtsp://192.168.10.101:554/live';
  const maskedStreamUrl = rawStreamUrl.replace(/:[^:@]+@/, ':****@');

  return {
    id: raw.id || raw.camera_id || raw.cameraId || `CAM-0${Math.floor(1 + Math.random() * 9)}`,
    name: raw.name || raw.camera_name || 'Border Surveillance Camera',
    location: raw.location || raw.site || 'Border Post Alpha',
    stream_url: maskedStreamUrl,
    status,
    fps: raw.fps || 30,
    resolution: raw.resolution || '1920x1080',
    zone: raw.zone || raw.sector || 'Sector North',
    last_ping: raw.last_ping || raw.lastPing || new Date().toISOString(),
    thumbnail_url: raw.thumbnail_url || raw.thumbnail,
    ai_enabled: raw.ai_enabled ?? raw.aiEnabled ?? true,
    last_detection_time: raw.last_detection_time || raw.lastDetectionTime,
    detection_count_today: raw.detection_count_today || raw.detectionCount || 0,
    notes: raw.notes || raw.description,
  };
}

export function mapApiAlertToAlert(raw: any): Alert {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'ALT-101',
      title: 'Security Alert',
      description: 'Surveillance alert triggered',
      severity: 'HIGH',
      status: 'UNACKNOWLEDGED',
      camera_id: 'CAM-01',
      event_type: 'OBJECT_DETECTED',
      timestamp: new Date().toISOString(),
    };
  }

  const rawSeverity = String(raw.severity || '').toUpperCase();
  const severity: AlertSeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawSeverity)
    ? (rawSeverity as AlertSeverity)
    : 'HIGH';

  const rawStatus = String(raw.status || '').toUpperCase();
  const status: AlertStatus = ['UNACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].includes(rawStatus)
    ? (rawStatus as AlertStatus)
    : 'UNACKNOWLEDGED';

  return {
    id: raw.id ? String(raw.id) : `ALT-${Math.floor(500 + Math.random() * 500)}`,
    title: raw.title || raw.name || 'Security Warning',
    description: raw.description || raw.message || 'Alert threshold triggered',
    severity,
    status,
    camera_id: raw.camera_id || raw.cameraId || 'CAM-01',
    event_type: raw.event_type || raw.eventType || 'SURVEILLANCE_ALERT',
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    acknowledged_by: raw.acknowledged_by || raw.acknowledgedBy,
    acknowledged_at: raw.acknowledged_at || raw.acknowledgedAt,
    resolved_by: raw.resolved_by || raw.resolvedBy,
    resolved_at: raw.resolved_at || raw.resolvedAt,
    resolution_notes: raw.resolution_notes || raw.resolutionNotes,
    metadata: raw.metadata,
  };
}

export function mapApiDetectionToDetection(raw: any): Detection {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'DET-101',
      tracking_id: 'TRK-1001',
      camera_id: 'CAM-01',
      camera_name: 'Border Gate Camera',
      object_class: 'vehicle',
      confidence: 0.95,
      bbox: { x: 100, y: 100, width: 200, height: 150 },
      timestamp: new Date().toISOString(),
    };
  }

  const objectClass: ObjectCategory = raw.object_class || raw.class_name || raw.label || 'vehicle';
  const bbox = raw.bbox || raw.bounding_box || { x: 100, y: 100, width: 200, height: 150 };

  return {
    id: raw.id ? String(raw.id) : `DET-${Math.floor(900 + Math.random() * 100)}`,
    tracking_id: raw.tracking_id || raw.trackingId || `TRK-${Math.floor(8000 + Math.random() * 1000)}`,
    camera_id: raw.camera_id || raw.cameraId || 'CAM-01',
    camera_name: raw.camera_name || raw.cameraName || 'Border Feed',
    object_class: objectClass,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.94,
    bbox: Array.isArray(bbox) ? { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] } : bbox,
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
    snapshot_url: raw.snapshot_url || raw.imageUrl,
    event_reference_id: raw.event_reference_id || raw.eventId,
    details: raw.details || raw.notes,
  };
}

export function mapApiWatchlistToWatchlistEntry(raw: any): WatchlistEntry {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'WL-101',
      category: 'WANTED_VEHICLE',
      identifier: 'KA-05-MN-9921',
      name: 'Suspect Target',
      priority: 'HIGH',
      status: 'ACTIVE',
      notes: 'Watchlist hit',
      created_at: new Date().toISOString(),
      matches_count: 1,
    };
  }

  const category: WatchlistCategory = raw.category || 'WANTED_VEHICLE';
  const priority: PriorityLevel = raw.priority || 'HIGH';
  const status: WatchlistStatus = raw.status || 'ACTIVE';

  return {
    id: raw.id ? String(raw.id) : `WL-${Math.floor(8000 + Math.random() * 1000)}`,
    category,
    identifier: raw.identifier || raw.license_plate || raw.plate_number || 'UNKNOWN-ID',
    name: raw.name || raw.description || 'Target Profile',
    vehicle_type: raw.vehicle_type || raw.vehicleType,
    priority,
    status,
    notes: raw.notes || raw.details || 'Watchlist record',
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    matches_count: raw.matches_count || raw.matchesCount || 0,
    last_seen: raw.last_seen || raw.lastSeen,
    last_seen_camera: raw.last_seen_camera || raw.lastSeenCamera,
  };
}
