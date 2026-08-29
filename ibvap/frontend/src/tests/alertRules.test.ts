import { describe, it, expect, beforeEach } from 'vitest';
import { alertRules } from '../utils/alertRules';
import { registryStorage } from '../services/registryStorage';
import { SurveillanceEvent } from '../types';

describe('Alert vs Event Separation & Classification Rules', () => {
  beforeEach(() => {
    registryStorage.clearAll();
  });

  it('TEST 1: Registered Known Person generates NO alert', () => {
    // Register Rahul Sharma as Known
    registryStorage.addPerson({
      id: 'P001',
      name: 'Rahul Sharma',
      status: 'KNOWN',
    });

    const event: SurveillanceEvent = {
      id: 1,
      camera_id: 'CAM-GATE-01',
      event_type: 'PERSON_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.94,
      metadata: {
        person_name: 'Rahul Sharma',
        is_known: true,
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Person');
    expect(classification.identity).toBe('Rahul Sharma');
    expect(classification.statusLabel).toBe('Known');
    expect(classification.isAlert).toBe(false); // Known person NEVER creates an alert

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(0);
  });

  it('TEST 2: Unregistered / Unknown Person generates Flagged Person Found alert', () => {
    const event: SurveillanceEvent = {
      id: 2,
      camera_id: 'CAM-GATE-01',
      event_type: 'PERSON_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.91,
      metadata: {
        track_id: 12,
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Person');
    expect(classification.identity).toBe('Unknown');
    expect(classification.statusLabel).toBe('Flagged');
    expect(classification.isAlert).toBe(true);
    expect(classification.alertTitle).toBe('Flagged Person Found');

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(1);
  });

  it('TEST 3: Registered Vehicle generates NO alert', () => {
    registryStorage.addVehicle({
      id: 'VEH-01',
      plate_number: 'HR98AA0000',
      owner_name: 'Rahul',
      status: 'REGISTERED',
    });

    const event: SurveillanceEvent = {
      id: 3,
      camera_id: 'CAM-GATE-01',
      event_type: 'ANPR_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.93,
      metadata: {
        plate_number: 'HR98AA0000',
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Vehicle');
    expect(classification.statusLabel).toBe('Registered');
    expect(classification.isAlert).toBe(false);

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(0);
  });

  it('TEST 4: Unregistered Vehicle generates Unknown Vehicle Found alert', () => {
    const event: SurveillanceEvent = {
      id: 4,
      camera_id: 'CAM-GATE-01',
      event_type: 'ANPR_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      metadata: {
        plate_number: 'DL01AB9999',
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Vehicle');
    expect(classification.statusLabel).toBe('Alert');
    expect(classification.isAlert).toBe(true);
    expect(classification.alertTitle).toBe('Unknown Vehicle Found');

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(1);
  });

  it('TEST 5: Watchlist Vehicle generates Watchlist Vehicle Found critical alert', () => {
    const event: SurveillanceEvent = {
      id: 5,
      camera_id: 'CAM-GATE-01',
      event_type: 'WATCHLIST_MATCH',
      timestamp: new Date().toISOString(),
      confidence: 0.95,
      metadata: {
        plate_number: 'TN09AB1234',
        watchlist_match: true,
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Vehicle');
    expect(classification.statusLabel).toBe('Watchlist');
    expect(classification.isAlert).toBe(true);
    expect(classification.alertTitle).toBe('Watchlist Vehicle Found');

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(1);
  });

  it('TEST 6: Intrusion Detection generates Intrusion Detected alert', () => {
    const event: SurveillanceEvent = {
      id: 6,
      camera_id: 'CAM-TOWER-01',
      event_type: 'INTRUSION_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.96,
      metadata: {
        fence_zone: 'Sector 4 North',
      },
    };

    const classification = alertRules.classify(event);
    expect(classification.detectionType).toBe('Intrusion');
    expect(classification.identity).toBe('Sector 4 North');
    expect(classification.statusLabel).toBe('Alert');
    expect(classification.isAlert).toBe(true);
    expect(classification.alertTitle).toBe('Intrusion Detected');

    const alerts = alertRules.filterAlerts([event]);
    expect(alerts.length).toBe(1);
  });

  it('TEST 7: Duplicate alert cooldown suppresses rapid repeated alerts', () => {
    const cam = 'CAM-01';
    const alertKey = 'UNKNOWN_PERSON_1';

    const emit1 = alertRules.shouldEmitAlert(cam, alertKey, 5000);
    expect(emit1).toBe(true);

    // Immediate second call should be suppressed
    const emit2 = alertRules.shouldEmitAlert(cam, alertKey, 5000);
    expect(emit2).toBe(false);
  });
});
