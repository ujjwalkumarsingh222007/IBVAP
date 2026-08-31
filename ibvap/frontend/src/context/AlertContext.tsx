import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { RealtimeAlert, ThreatSeverity, AIDetection } from '../types';
import { soundManager } from '../utils/sound';
import { alertApi } from '../api/alertApi';

interface AlertContextValue {
  alerts: RealtimeAlert[];
  recentToasts: RealtimeAlert[];
  dismissToast: (id: string) => void;
  clearAllAlerts: () => void;
  triggerAlertFromDetection: (detection: AIDetection, cameraId: string) => void;
  syncBackendThreats: () => Promise<void>;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [recentToasts, setRecentToasts] = useState<RealtimeAlert[]>([]);
  
  // Cooldown tracker to prevent alert storms: key -> timestamp
  const alertCooldownRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setRecentToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    setRecentToasts([]);
  }, []);

  const addAlert = useCallback((alert: RealtimeAlert) => {
    setAlerts((prev) => [alert, ...prev.slice(0, 99)]);
    setRecentToasts((prev) => [alert, ...prev.slice(0, 3)]);
    soundManager.playAlert(alert.severity);

    // Auto dismiss toast after 6 seconds
    setTimeout(() => {
      setRecentToasts((prev) => prev.filter((t) => t.id !== alert.id));
    }, 6000);
  }, []);

  const triggerAlertFromDetection = useCallback(
    (detection: AIDetection, cameraId: string) => {
      const isKnown = detection.is_known || detection.status === 'KNOWN';
      // RULE: Known person or vehicle MUST NOT trigger an alert
      if (isKnown) return;

      const isFlagged = detection.is_flagged || detection.status === 'FLAGGED' || detection.watchlist_match;
      const isPerson = detection.class_name === 'person';
      const isVehicle = !isPerson && (detection.plate_number || ['car', 'truck', 'bus', 'vehicle', 'license_plate'].includes(detection.class_name));

      let alertType: RealtimeAlert['type'] = 'UNKNOWN_PERSON';
      let title = '';
      let severity: ThreatSeverity = isFlagged ? 'CRITICAL' : 'MEDIUM';

      if (isPerson) {
        if (isFlagged) {
          alertType = 'FLAGGED_PERSON';
          title = `🚨 FLAGGED PERSON FOUND`;
        } else {
          alertType = 'UNKNOWN_PERSON';
          title = `⚠️ UNKNOWN PERSON DETECTED`;
        }
      } else if (isVehicle) {
        if (isFlagged) {
          alertType = 'FLAGGED_VEHICLE';
          title = `🚨 FLAGGED VEHICLE DETECTED`;
        } else {
          alertType = 'UNKNOWN_VEHICLE';
          title = `⚠️ UNKNOWN VEHICLE DETECTED`;
        }
      } else {
        // Intrusion or other object
        if (detection.status === 'FLAGGED') {
          alertType = 'FLAGGED_PERSON';
          title = `🚨 SECURITY THREAT DETECTED`;
        } else {
          return;
        }
      }

      // Check cooldown key: per target & camera
      const targetIdentifier = detection.person_name || detection.plate_number || detection.track_id || 'unknown';
      const cooldownKey = `${cameraId}_${alertType}_${targetIdentifier}`;
      const now = Date.now();
      const lastTime = alertCooldownRef.current.get(cooldownKey) || 0;

      // 8 second cooldown per entity
      if (now - lastTime < 8000) {
        return;
      }
      alertCooldownRef.current.set(cooldownKey, now);

      const newAlert: RealtimeAlert = {
        id: `alert_${now}_${Math.random().toString(36).substring(2, 7)}`,
        type: alertType,
        title,
        description: detection.person_name
          ? `Identified as flagged individual: ${detection.person_name}`
          : detection.plate_number
          ? `License plate: ${detection.plate_number}`
          : `Unidentified subject active in camera field of view`,
        camera_id: cameraId,
        timestamp: new Date().toISOString(),
        severity,
        person_name: detection.person_name || undefined,
        plate_number: detection.plate_number || undefined,
        confidence: detection.confidence,
      };

      addAlert(newAlert);
    },
    [addAlert]
  );

  const syncBackendThreats = useCallback(async () => {
    try {
      const threats = await alertApi.getActiveThreats(undefined, 10);
      if (threats && threats.length > 0) {
        // Merge any new threats into alerts list
        setAlerts((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newOnes: RealtimeAlert[] = [];
          for (const t of threats) {
            const id = `threat_${t.threat_id}`;
            if (!existingIds.has(id)) {
              newOnes.push({
                id,
                type: t.severity === 'CRITICAL' ? 'FLAGGED_PERSON' : 'UNKNOWN_PERSON',
                title: t.title,
                description: t.reason,
                camera_id: t.camera_id,
                timestamp: t.last_event_time || t.created_at || new Date().toISOString(),
                severity: t.severity,
              });
            }
          }
          return [...newOnes, ...prev].slice(0, 100);
        });
      }
    } catch {
      // Backend not yet reachable, ignore silently
    }
  }, []);

  // Single subscription poller for backend threats (every 8 seconds)
  useEffect(() => {
    syncBackendThreats();
    const interval = setInterval(syncBackendThreats, 8000);
    return () => clearInterval(interval);
  }, [syncBackendThreats]);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        recentToasts,
        dismissToast,
        clearAllAlerts,
        triggerAlertFromDetection,
        syncBackendThreats,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = (): AlertContextValue => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
