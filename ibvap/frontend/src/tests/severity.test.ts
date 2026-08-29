import { describe, it, expect } from 'vitest';
import {
  getEventSeverity,
  getSeverityConfig,
  getSeverityWeight,
} from '../utils/severity';

describe('Threat Alert Severity Mapping', () => {
  it('correctly maps WATCHLIST_MATCH to CRITICAL', () => {
    expect(getEventSeverity('WATCHLIST_MATCH')).toBe('CRITICAL');
  });

  it('correctly maps INTRUSION_DETECTED and SUSPICIOUS_ACTIVITY to HIGH', () => {
    expect(getEventSeverity('INTRUSION_DETECTED')).toBe('HIGH');
    expect(getEventSeverity('SUSPICIOUS_ACTIVITY')).toBe('HIGH');
  });

  it('correctly maps VEHICLE_DETECTED to MEDIUM', () => {
    expect(getEventSeverity('VEHICLE_DETECTED')).toBe('MEDIUM');
  });

  it('correctly maps PERSON_DETECTED, OBJECT_DETECTED, and ANPR_DETECTED to LOW', () => {
    expect(getEventSeverity('PERSON_DETECTED')).toBe('LOW');
    expect(getEventSeverity('OBJECT_DETECTED')).toBe('LOW');
    expect(getEventSeverity('ANPR_DETECTED')).toBe('LOW');
    expect(getEventSeverity('UNKNOWN_EVENT')).toBe('LOW');
  });

  it('provides appropriate badge and style configurations for all levels', () => {
    const criticalConfig = getSeverityConfig('CRITICAL');
    expect(criticalConfig.level).toBe('CRITICAL');
    expect(criticalConfig.pulse).toBe(true);
    expect(criticalConfig.badgeText).toContain('text-red');

    const highConfig = getSeverityConfig('HIGH');
    expect(highConfig.level).toBe('HIGH');
    expect(highConfig.pulse).toBe(false);

    const mediumConfig = getSeverityConfig('MEDIUM');
    expect(mediumConfig.level).toBe('MEDIUM');

    const lowConfig = getSeverityConfig('LOW');
    expect(lowConfig.level).toBe('LOW');
  });

  it('correctly orders severity weights for priority sorting', () => {
    expect(getSeverityWeight('CRITICAL')).toBeGreaterThan(getSeverityWeight('HIGH'));
    expect(getSeverityWeight('HIGH')).toBeGreaterThan(getSeverityWeight('MEDIUM'));
    expect(getSeverityWeight('MEDIUM')).toBeGreaterThan(getSeverityWeight('LOW'));
  });
});
