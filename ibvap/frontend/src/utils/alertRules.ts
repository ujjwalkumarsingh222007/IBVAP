/**
 * alertRules.ts — Centralized Alert vs Event Classification and Notification Logic.
 *
 * Core Rules:
 * - KNOWN PERSON / KNOWN VEHICLE -> Normal Detection -> NEVER AN ALERT.
 * - UNKNOWN PERSON -> "Unknown person detected" / "Flagged Person Found" -> ALERT.
 * - FLAGGED PERSON -> "Flagged Person Found" -> CRITICAL ALERT.
 * - UNKNOWN VEHICLE -> "Unknown Vehicle Found" -> ALERT.
 * - FLAGGED VEHICLE / WATCHLIST -> "Watchlist Vehicle Found" -> CRITICAL ALERT.
 * - INTRUSION -> "Intrusion Detected" -> ALERT.
 */

import { SurveillanceEvent } from '../types';
import { registryStorage } from '../services/registryStorage';

export interface EventClassification {
  detectionType: string;
  identity: string;
  statusLabel: string;
  badgeType: 'known' | 'flagged' | 'watchlist' | 'alert' | 'normal';
  isAlert: boolean;
  alertTitle: string;
  alertColor: string;
  alertBg: string;
  alertDot: string;
}

// In-memory duplicate suppression cache: alertKey -> timestamp (epoch ms)
const _recentAlertTimestamps = new Map<string, number>();

export const alertRules = {
  /**
   * Determine whether a surveillance event represents an active alert requiring operator attention.
   */
  classify(event: SurveillanceEvent): EventClassification {
    const etype = event.event_type;
    const meta = event.metadata || {};
    const plate = (meta.plate_number as string | undefined)?.replace(/\s+/g, '').toUpperCase();

    // 1. FLAGGED PERSON
    if (etype === 'FLAGGED_PERSON' || meta.is_flagged === true || meta.status === 'FLAGGED') {
      const pName = (meta.person_name as string) || 'Flagged Subject';
      return {
        detectionType: 'Person',
        identity: pName,
        statusLabel: 'Flagged',
        badgeType: 'flagged',
        isAlert: true,
        alertTitle: 'Flagged Person Found',
        alertColor: 'text-red-400',
        alertBg: 'bg-red-950/40 border-red-800/80',
        alertDot: 'bg-red-500',
      };
    }

    // 2. UNKNOWN PERSON
    if (etype === 'UNKNOWN_PERSON') {
      return {
        detectionType: 'Person',
        identity: 'Unknown',
        statusLabel: 'Flagged',
        badgeType: 'flagged',
        isAlert: true,
        alertTitle: 'Flagged Person Found',
        alertColor: 'text-amber-400',
        alertBg: 'bg-amber-950/40 border-amber-800/80',
        alertDot: 'bg-amber-500',
      };
    }

    // 3. WATCHLIST / FLAGGED VEHICLE
    const regVehicle = plate ? registryStorage.lookupVehicle(plate) : undefined;
    const isWatchlist =
      etype === 'FLAGGED_VEHICLE' ||
      etype === 'WATCHLIST_MATCH' ||
      meta.watchlist_match === true ||
      meta.is_flagged === true ||
      regVehicle?.status === 'WATCHLIST';

    if (isWatchlist) {
      return {
        detectionType: 'Vehicle',
        identity: plate || 'Watchlist Target',
        statusLabel: 'Watchlist',
        badgeType: 'watchlist',
        isAlert: true,
        alertTitle: 'Watchlist Vehicle Found',
        alertColor: 'text-red-400',
        alertBg: 'bg-red-950/40 border-red-800/80',
        alertDot: 'bg-red-500',
      };
    }

    // 4. UNKNOWN VEHICLE
    if (etype === 'UNKNOWN_VEHICLE') {
      return {
        detectionType: 'Vehicle',
        identity: plate || 'Unknown Vehicle',
        statusLabel: 'Alert',
        badgeType: 'alert',
        isAlert: true,
        alertTitle: 'Unknown Vehicle Found',
        alertColor: 'text-amber-400',
        alertBg: 'bg-amber-950/40 border-amber-800/80',
        alertDot: 'bg-amber-500',
      };
    }

    // 5. INTRUSION DETECTED
    if (etype === 'INTRUSION_DETECTED') {
      return {
        detectionType: 'Intrusion',
        identity: (meta.fence_zone as string) || 'Perimeter Line',
        statusLabel: 'Alert',
        badgeType: 'alert',
        isAlert: true,
        alertTitle: 'Intrusion Detected',
        alertColor: 'text-amber-400',
        alertBg: 'bg-amber-950/40 border-amber-800/80',
        alertDot: 'bg-amber-500',
      };
    }

    // 6. SUSPICIOUS ACTIVITY
    if (etype === 'SUSPICIOUS_ACTIVITY') {
      return {
        detectionType: 'Suspicious Activity',
        identity: 'Anomalous Dwell',
        statusLabel: 'Alert',
        badgeType: 'alert',
        isAlert: true,
        alertTitle: 'Suspicious Activity Detected',
        alertColor: 'text-amber-400',
        alertBg: 'bg-amber-950/40 border-amber-800/80',
        alertDot: 'bg-amber-500',
      };
    }

    // 7. PERSON DETECTION (Known vs Unknown fallback)
    if (etype === 'PERSON_DETECTED') {
      const explicitName = meta.person_name as string | undefined;
      const isExplicitKnown = meta.is_known === true || meta.status === 'KNOWN';

      let matchedPerson = explicitName ? registryStorage.lookupPerson(explicitName) : undefined;
      if (isExplicitKnown || (matchedPerson && matchedPerson.status === 'KNOWN')) {
        return {
          detectionType: 'Person',
          identity: matchedPerson?.name || explicitName || 'Known Person',
          statusLabel: 'Known',
          badgeType: 'known',
          isAlert: false, // Known person NEVER creates an alert
          alertTitle: 'Known Person Detected',
          alertColor: 'text-emerald-400',
          alertBg: 'bg-emerald-950/40 border-emerald-800/80',
          alertDot: 'bg-emerald-500',
        };
      }

      // If registered as FLAGGED
      if (matchedPerson && matchedPerson.status === 'FLAGGED') {
        return {
          detectionType: 'Person',
          identity: matchedPerson.name,
          statusLabel: 'Flagged',
          badgeType: 'flagged',
          isAlert: true,
          alertTitle: 'Flagged Person Found',
          alertColor: 'text-red-400',
          alertBg: 'bg-red-950/40 border-red-800/80',
          alertDot: 'bg-red-500',
        };
      }

      // Default unrecognized person -> alert
      return {
        detectionType: 'Person',
        identity: 'Unknown',
        statusLabel: 'Flagged',
        badgeType: 'flagged',
        isAlert: true,
        alertTitle: 'Flagged Person Found',
        alertColor: 'text-red-400',
        alertBg: 'bg-red-950/40 border-red-800/80',
        alertDot: 'bg-red-500',
      };
    }

    // 8. VEHICLE / ANPR DETECTION
    if (etype === 'ANPR_DETECTED' || etype === 'VEHICLE_DETECTED') {
      const isExplicitKnown = meta.is_known === true || meta.status === 'KNOWN';
      if (isExplicitKnown || (regVehicle && regVehicle.status === 'REGISTERED')) {
        return {
          detectionType: 'Vehicle',
          identity: plate ? `${plate} (${regVehicle?.owner_name || 'Known'})` : 'Registered Vehicle',
          statusLabel: 'Registered',
          badgeType: 'normal',
          isAlert: false, // Registered vehicle NEVER creates an alert
          alertTitle: 'Registered Vehicle Detected',
          alertColor: 'text-emerald-400',
          alertBg: 'bg-emerald-950/40 border-emerald-800/80',
          alertDot: 'bg-emerald-500',
        };
      }

      // Unregistered license plate -> Unknown Vehicle Alert
      return {
        detectionType: 'Vehicle',
        identity: plate || 'Unknown',
        statusLabel: 'Alert',
        badgeType: 'alert',
        isAlert: true,
        alertTitle: 'Unknown Vehicle Found',
        alertColor: 'text-amber-400',
        alertBg: 'bg-amber-950/40 border-amber-800/80',
        alertDot: 'bg-amber-500',
      };
    }

    // Default neutral detection
    return {
      detectionType: etype.replace('_', ' '),
      identity: '—',
      statusLabel: 'Normal',
      badgeType: 'normal',
      isAlert: false,
      alertTitle: 'Surveillance Detection',
      alertColor: 'text-slate-400',
      alertBg: 'bg-slate-900 border-slate-800',
      alertDot: 'bg-slate-500',
    };
  },

  /**
   * Filter an array of events to return ONLY actual alerts requiring operator attention.
   */
  filterAlerts(events: SurveillanceEvent[]): SurveillanceEvent[] {
    return events.filter((e) => this.classify(e).isAlert);
  },

  /**
   * Duplicate alert suppression cooldown (default: 10 seconds per camera & alert identity).
   * Returns true if alert should be emitted, false if suppressed as duplicate.
   */
  shouldEmitAlert(camera_id: string, alertKey: string, cooldownMs = 10000): boolean {
    const key = `${camera_id}::${alertKey}`;
    const now = Date.now();
    const lastTime = _recentAlertTimestamps.get(key);
    if (lastTime && now - lastTime < cooldownMs) {
      return false; // Suppress duplicate
    }
    _recentAlertTimestamps.set(key, now);
    return true;
  },
};
