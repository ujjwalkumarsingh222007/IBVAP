import { EventType } from '../types/event';
import { AlertSeverity, AlertStatus } from '../types/alert';
import { CameraStatus } from '../types/camera';

/**
 * Format ISO timestamp string into clean surveillance log format
 */
export function formatTimestamp(isoString: string): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

/**
 * Format decimal confidence score to percentage string
 */
export function formatConfidence(confidence: number): string {
  if (confidence === undefined || confidence === null) return '0%';
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get color badge styling for event types
 */
export function getEventTypeBadge(eventType: EventType | string): { bg: string; text: string; border: string } {
  switch (eventType) {
    case 'WATCHLIST_MATCH':
      return { bg: 'bg-red-950/80', text: 'text-red-400', border: 'border-red-600/50' };
    case 'INTRUSION_DETECTED':
      return { bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-600/50' };
    case 'SUSPICIOUS_ACTIVITY':
      return { bg: 'bg-yellow-950/80', text: 'text-yellow-400', border: 'border-yellow-600/50' };
    case 'ANPR_DETECTED':
      return { bg: 'bg-blue-950/80', text: 'text-blue-400', border: 'border-blue-600/50' };
    case 'VEHICLE_DETECTED':
      return { bg: 'bg-cyan-950/80', text: 'text-cyan-400', border: 'border-cyan-600/50' };
    case 'PERSON_DETECTED':
      return { bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-600/50' };
    default:
      return { bg: 'bg-slate-900', text: 'text-slate-300', border: 'border-slate-700' };
  }
}

/**
 * Get color badge styling for Alert Severity
 */
export function getSeverityBadge(severity: AlertSeverity | string): { bg: string; text: string; dot: string } {
  switch (severity) {
    case 'CRITICAL':
      return { bg: 'bg-red-500/10 text-red-400 border border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' };
    case 'HIGH':
      return { bg: 'bg-orange-500/10 text-orange-400 border border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' };
    case 'MEDIUM':
      return { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' };
    case 'LOW':
      return { bg: 'bg-blue-500/10 text-blue-400 border border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' };
    default:
      return { bg: 'bg-slate-800 text-slate-300 border border-slate-700', text: 'text-slate-300', dot: 'bg-slate-400' };
  }
}

/**
 * Get color badge styling for Alert Status
 */
export function getAlertStatusBadge(status: AlertStatus | string): { bg: string; text: string } {
  switch (status) {
    case 'UNACKNOWLEDGED':
      return { bg: 'bg-red-950 text-red-300 border border-red-800', text: 'text-red-400' };
    case 'INVESTIGATING':
      return { bg: 'bg-amber-950 text-amber-300 border border-amber-800', text: 'text-amber-400' };
    case 'RESOLVED':
      return { bg: 'bg-emerald-950 text-emerald-300 border border-emerald-800', text: 'text-emerald-400' };
    case 'DISMISSED':
      return { bg: 'bg-slate-900 text-slate-400 border border-slate-800', text: 'text-slate-400' };
    default:
      return { bg: 'bg-slate-900 text-slate-300', text: 'text-slate-300' };
  }
}

/**
 * Get color badge styling for Camera Status
 */
export function getCameraStatusBadge(status: CameraStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'ONLINE':
      return { bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' };
    case 'OFFLINE':
      return { bg: 'bg-red-500/10 text-red-400 border border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' };
    case 'DEGRADED':
      return { bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' };
    case 'MAINTENANCE':
      return { bg: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' };
  }
}
