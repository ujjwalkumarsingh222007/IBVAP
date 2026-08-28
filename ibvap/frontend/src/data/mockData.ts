import { Camera } from '../types/camera';
import { Event } from '../types/event';
import { Alert } from '../types/alert';
import { Detection } from '../types/detection';
import { WatchlistEntry } from '../types/watchlist';
import { DashboardStatistics, HourlyDetectionTrend, ThreatDistribution } from '../types/analytics';

/**
 * Realistic mock dataset for IBVAP UI Demonstration.
 * Note: Cleanly separated from API services to prepare for Member 3 FastAPI integration.
 */

export const MOCK_DASHBOARD_STATS: DashboardStatistics = {
  active_cameras: 12,
  total_cameras: 14,
  total_detections_today: 1482,
  detections_change_percent: +14.2,
  active_alerts: 5,
  critical_alerts: 2,
  watchlist_matches_today: 3,
};

export const MOCK_CAMERAS: Camera[] = [
  {
    id: 'CAM-01',
    name: 'North Border Sector 4 - Main Gate',
    location: 'Border Post Alpha-1',
    stream_url: 'rtsp://192.168.10.101:554/live/stream1',
    status: 'ONLINE',
    fps: 30,
    resolution: '1920x1080',
    zone: 'Sector North',
    last_ping: '2026-08-28T21:20:00Z',
    ai_enabled: true,
  },
  {
    id: 'CAM-02',
    name: 'Perimeter Wall South Fence',
    location: 'Perimeter Sensor Tower 7',
    stream_url: 'rtsp://192.168.10.102:554/live/stream1',
    status: 'ONLINE',
    fps: 25,
    resolution: '1920x1080',
    zone: 'Sector South',
    last_ping: '2026-08-28T21:20:02Z',
    ai_enabled: true,
  },
  {
    id: 'CAM-03',
    name: 'Checkpoint Bravo Vehicle Lane',
    location: 'Vehicle Inspection Bay 2',
    stream_url: 'rtsp://192.168.10.103:554/live/stream1',
    status: 'ONLINE',
    fps: 60,
    resolution: '3840x2160',
    zone: 'Inspection Hub',
    last_ping: '2026-08-28T21:20:05Z',
    ai_enabled: true,
  },
  {
    id: 'CAM-04',
    name: 'East River Crossing Watchtower',
    location: 'River Security Outpost 3',
    stream_url: 'rtsp://192.168.10.104:554/live/stream1',
    status: 'ONLINE',
    fps: 30,
    resolution: '1920x1080',
    zone: 'Sector East',
    last_ping: '2026-08-28T21:19:55Z',
    ai_enabled: true,
  },
  {
    id: 'CAM-05',
    name: 'West Perimeter Thermal Optic',
    location: 'Thermal Array West 1',
    stream_url: 'rtsp://192.168.10.105:554/live/thermal',
    status: 'DEGRADED',
    fps: 15,
    resolution: '1280x720',
    zone: 'Sector West',
    last_ping: '2026-08-28T21:18:40Z',
    ai_enabled: true,
  },
  {
    id: 'CAM-06',
    name: 'Freight Customs Bay Alpha',
    location: 'Customs Yard Gate B',
    stream_url: 'rtsp://192.168.10.106:554/live/stream1',
    status: 'OFFLINE',
    fps: 0,
    resolution: '1920x1080',
    zone: 'Logistics Zone',
    last_ping: '2026-08-28T18:45:10Z',
    ai_enabled: false,
  },
];

export const MOCK_EVENTS: Event[] = [
  {
    id: 'EVT-1009',
    camera_id: 'CAM-03',
    event_type: 'WATCHLIST_MATCH',
    timestamp: '2026-08-28T21:15:30Z',
    confidence: 0.98,
    metadata: {
      license_plate: 'KA-05-MN-9921',
      vehicle_type: 'SUV (Dark Gray)',
      threat_level: 'CRITICAL',
      matched_watchlist_id: 'WL-8802',
    },
  },
  {
    id: 'EVT-1008',
    camera_id: 'CAM-02',
    event_type: 'INTRUSION_DETECTED',
    timestamp: '2026-08-28T21:02:14Z',
    confidence: 0.94,
    metadata: {
      person_count: 2,
      zone_id: 'Restricted Perimeter Zone 4',
      threat_level: 'HIGH',
      bounding_box: [120, 340, 280, 510],
    },
  },
  {
    id: 'EVT-1007',
    camera_id: 'CAM-01',
    event_type: 'ANPR_DETECTED',
    timestamp: '2026-08-28T20:55:00Z',
    confidence: 0.96,
    metadata: {
      license_plate: 'DL-01-AB-1234',
      speed_kmh: 42,
      vehicle_type: 'Sedan',
    },
  },
  {
    id: 'EVT-1006',
    camera_id: 'CAM-05',
    event_type: 'SUSPICIOUS_ACTIVITY',
    timestamp: '2026-08-28T20:41:20Z',
    confidence: 0.87,
    metadata: {
      details: 'Loitering near perimeter barrier fence > 180s',
      threat_level: 'MEDIUM',
    },
  },
  {
    id: 'EVT-1005',
    camera_id: 'CAM-04',
    event_type: 'PERSON_DETECTED',
    timestamp: '2026-08-28T20:30:10Z',
    confidence: 0.92,
    metadata: {
      person_count: 1,
      zone_id: 'River Watchtower Walkway',
    },
  },
  {
    id: 'EVT-1004',
    camera_id: 'CAM-01',
    event_type: 'VEHICLE_DETECTED',
    timestamp: '2026-08-28T20:12:05Z',
    confidence: 0.95,
    metadata: {
      vehicle_type: 'Commercial Truck',
      speed_kmh: 28,
    },
  },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'ALT-501',
    title: 'CRITICAL WATCHLIST MATCH DETECTED',
    description: 'Black SUV (Plate KA-05-MN-9921) flagged in Stolen Vehicle Database matched at Checkpoint Bravo.',
    severity: 'CRITICAL',
    status: 'UNACKNOWLEDGED',
    camera_id: 'CAM-03',
    event_type: 'WATCHLIST_MATCH',
    timestamp: '2026-08-28T21:15:30Z',
  },
  {
    id: 'ALT-502',
    title: 'Perimeter Intrusion Alarm',
    description: '2 Unauthorized individuals detected crossing Restricted Perimeter Zone 4 boundary.',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    camera_id: 'CAM-02',
    event_type: 'INTRUSION_DETECTED',
    timestamp: '2026-08-28T21:02:14Z',
    acknowledged_by: 'Officer J. Miller (Control Room 1)',
  },
  {
    id: 'ALT-503',
    title: 'Suspicious Loitering Warning',
    description: 'Subject lingering adjacent to West Perimeter fence for extended period.',
    severity: 'MEDIUM',
    status: 'UNACKNOWLEDGED',
    camera_id: 'CAM-05',
    event_type: 'SUSPICIOUS_ACTIVITY',
    timestamp: '2026-08-28T20:41:20Z',
  },
  {
    id: 'ALT-504',
    title: 'Camera Stream Signal Degraded',
    description: 'Frame rate drop below 15 FPS on West Thermal Camera stream.',
    severity: 'LOW',
    status: 'RESOLVED',
    camera_id: 'CAM-05',
    event_type: 'SYSTEM_WARNING',
    timestamp: '2026-08-28T19:30:00Z',
    acknowledged_by: 'System Auto-Monitor',
  },
];

export const MOCK_DETECTIONS: Detection[] = [
  {
    id: 'DET-901',
    camera_id: 'CAM-03',
    camera_name: 'Checkpoint Bravo Vehicle Lane',
    object_class: 'License Plate',
    confidence: 0.98,
    bbox: { x: 450, y: 620, width: 140, height: 45 },
    timestamp: '2026-08-28T21:15:30Z',
    details: 'KA-05-MN-9921',
  },
  {
    id: 'DET-902',
    camera_id: 'CAM-02',
    camera_name: 'Perimeter Wall South Fence',
    object_class: 'Person',
    confidence: 0.94,
    bbox: { x: 210, y: 180, width: 75, height: 185 },
    timestamp: '2026-08-28T21:02:14Z',
    details: 'Climbing stance / Backpack detected',
  },
  {
    id: 'DET-903',
    camera_id: 'CAM-01',
    camera_name: 'North Border Sector 4',
    object_class: 'Vehicle',
    confidence: 0.96,
    bbox: { x: 300, y: 250, width: 420, height: 260 },
    timestamp: '2026-08-28T20:55:00Z',
    details: 'Sedan (White / Clear Plate)',
  },
  {
    id: 'DET-904',
    camera_id: 'CAM-04',
    camera_name: 'East River Crossing Watchtower',
    object_class: 'Person',
    confidence: 0.91,
    bbox: { x: 580, y: 310, width: 60, height: 150 },
    timestamp: '2026-08-28T20:30:10Z',
    details: 'Patrol officer walking north',
  },
];

export const MOCK_WATCHLIST: WatchlistEntry[] = [
  {
    id: 'WL-8802',
    category: 'WANTED_VEHICLE',
    identifier: 'KA-05-MN-9921',
    name: 'Dark Gray SUV (Armed Robbery Suspect)',
    priority: 'CRITICAL',
    notes: 'Interstate highway bulletin alert. High risk flag.',
    created_at: '2026-08-20T10:00:00Z',
    matches_count: 3,
    last_seen: '2026-08-28T21:15:30Z',
    last_seen_camera: 'CAM-03',
  },
  {
    id: 'WL-8803',
    category: 'STOLEN_PLATE',
    identifier: 'HR-26-DQ-7718',
    name: 'Stolen Commercial Transport Plate',
    priority: 'HIGH',
    notes: 'Flagged by Central Transport Registry.',
    created_at: '2026-08-25T14:30:00Z',
    matches_count: 1,
    last_seen: '2026-08-27T08:12:00Z',
    last_seen_camera: 'CAM-01',
  },
  {
    id: 'WL-8804',
    category: 'SUSPECT_PERSON',
    identifier: 'SUBJ-4409',
    name: 'Target Profile - Alpha Intruders',
    priority: 'HIGH',
    notes: 'Repeat border fence breach POI.',
    created_at: '2026-08-15T09:00:00Z',
    matches_count: 2,
    last_seen: '2026-08-28T21:02:14Z',
    last_seen_camera: 'CAM-02',
  },
];

export const MOCK_HOURLY_TRENDS: HourlyDetectionTrend[] = [
  { hour: '14:00', persons: 45, vehicles: 120, anpr: 110, intrusions: 0 },
  { hour: '15:00', persons: 52, vehicles: 135, anpr: 128, intrusions: 1 },
  { hour: '16:00', persons: 68, vehicles: 142, anpr: 139, intrusions: 0 },
  { hour: '17:00', persons: 85, vehicles: 180, anpr: 175, intrusions: 0 },
  { hour: '18:00', persons: 70, vehicles: 165, anpr: 155, intrusions: 2 },
  { hour: '19:00', persons: 40, vehicles: 95, anpr: 90, intrusions: 1 },
  { hour: '20:00', persons: 25, vehicles: 60, anpr: 58, intrusions: 1 },
  { hour: '21:00', persons: 18, vehicles: 42, anpr: 40, intrusions: 2 },
];

export const MOCK_THREAT_DISTRIBUTION: ThreatDistribution[] = [
  { category: 'Vehicle Detections', count: 940, color: '#00f2ff' },
  { category: 'ANPR Plate Matches', count: 412, color: '#3b82f6' },
  { category: 'Person Detections', count: 115, color: '#10b981' },
  { category: 'Perimeter Intrusions', count: 10, color: '#f59e0b' },
  { category: 'Watchlist Matches', count: 5, color: '#ef4444' },
];
