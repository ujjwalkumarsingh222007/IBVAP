export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'UNACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  camera_id: string;
  event_type: string;
  timestamp: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  metadata?: Record<string, unknown>;
}
