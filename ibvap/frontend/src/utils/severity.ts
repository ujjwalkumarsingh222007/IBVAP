import { EventType } from '../types';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SeverityConfig {
  level: SeverityLevel;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  borderColor: string;
  glowColor: string;
  pulse: boolean;
}

/**
 * Strict mapping of surveillance event types to system severity levels.
 *
 * WATCHLIST_MATCH     → CRITICAL
 * INTRUSION_DETECTED  → HIGH
 * SUSPICIOUS_ACTIVITY → HIGH
 * VEHICLE_DETECTED    → MEDIUM
 * PERSON_DETECTED     → LOW
 * OBJECT_DETECTED     → LOW
 * ANPR_DETECTED       → LOW
 */
export function getEventSeverity(eventType: string | EventType): SeverityLevel {
  switch (eventType) {
    case 'WATCHLIST_MATCH':
      return 'CRITICAL';
    case 'INTRUSION_DETECTED':
    case 'SUSPICIOUS_ACTIVITY':
      return 'HIGH';
    case 'VEHICLE_DETECTED':
      return 'MEDIUM';
    case 'PERSON_DETECTED':
    case 'OBJECT_DETECTED':
    case 'ANPR_DETECTED':
      return 'LOW';
    default:
      return 'LOW';
  }
}

export function getSeverityConfig(level: SeverityLevel): SeverityConfig {
  switch (level) {
    case 'CRITICAL':
      return {
        level: 'CRITICAL',
        label: 'CRITICAL',
        badgeBg: 'bg-red-950/80',
        badgeText: 'text-red-400',
        badgeBorder: 'border-red-600',
        borderColor: 'border-red-600/70',
        glowColor: 'from-red-950/40',
        pulse: true,
      };
    case 'HIGH':
      return {
        level: 'HIGH',
        label: 'HIGH THREAT',
        badgeBg: 'bg-rose-950/70',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-700/80',
        borderColor: 'border-rose-600/60',
        glowColor: 'from-rose-950/30',
        pulse: false,
      };
    case 'MEDIUM':
      return {
        level: 'MEDIUM',
        label: 'MEDIUM',
        badgeBg: 'bg-amber-950/70',
        badgeText: 'text-amber-400',
        badgeBorder: 'border-amber-700/80',
        borderColor: 'border-amber-600/50',
        glowColor: 'from-amber-950/20',
        pulse: false,
      };
    case 'LOW':
    default:
      return {
        level: 'LOW',
        label: 'INFORMATIONAL',
        badgeBg: 'bg-slate-900',
        badgeText: 'text-slate-400',
        badgeBorder: 'border-slate-800',
        borderColor: 'border-surface-border',
        glowColor: '',
        pulse: false,
      };
  }
}

/**
 * Returns numeric priority score for sorting events by urgency (higher = more urgent).
 */
export function getSeverityWeight(level: SeverityLevel): number {
  switch (level) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
    default:
      return 1;
  }
}
