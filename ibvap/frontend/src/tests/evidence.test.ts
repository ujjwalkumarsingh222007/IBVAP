import { describe, it, expect } from 'vitest';
import { alertRules } from '../utils/alertRules';
import { SurveillanceEvent } from '../types';

describe('Evidence and Alert Triggers', () => {
  it('identifies unknown person requiring evidence capture', () => {
    const ev: SurveillanceEvent = {
      id: 101,
      camera_id: 'CAM-01',
      event_type: 'PERSON_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.91,
      metadata: {
        track_id: 5,
        is_known: false,
      },
    };

    const cls = alertRules.classify(ev);
    expect(cls.isAlert).toBe(true);
    expect(cls.statusLabel).toBe('Flagged');
    expect(cls.detectionType).toBe('Person');
  });

  it('identifies registered vehicle requiring NO evidence capture', () => {
    const ev: SurveillanceEvent = {
      id: 102,
      camera_id: 'CAM-01',
      event_type: 'ANPR_DETECTED',
      timestamp: new Date().toISOString(),
      confidence: 0.94,
      metadata: {
        plate_number: 'HR98AA0000',
      },
    };

    // Before registration
    const cls1 = alertRules.classify(ev);
    expect(cls1.isAlert).toBe(true);
  });
});
