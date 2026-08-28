export interface DashboardStatistics {
  active_cameras: number;
  total_cameras: number;
  total_detections_today: number;
  vehicles_detected_today: number;
  persons_detected_today: number;
  detections_change_percent: number;
  active_alerts: number;
  critical_alerts: number;
  watchlist_matches_today: number;
}

export interface HourlyDetectionTrend {
  hour: string; // e.g. "08:00"
  persons: number;
  vehicles: number;
  anpr: number;
  intrusions: number;
}

export interface EventTypeDistribution {
  type: string;
  count: number;
  color: string;
}

export interface CameraEventBreakdown {
  camera_id: string;
  camera_name: string;
  events_count: number;
}

export interface AlertSeverityDistribution {
  severity: string;
  count: number;
  color: string;
}

export interface ThreatDistribution {
  category: string;
  count: number;
  color: string;
}
