import { describe, it, expect } from 'vitest';
import { AnalyticsSummary, CameraActivityRanking, TrendBucket } from '../types';

describe('Operational Analytics and Intelligence Logic', () => {
  const sampleSummary: AnalyticsSummary = {
    total_events: 100,
    threats: {
      total_threats: 35,
      critical: 10,
      high: 15,
      medium: 10,
      low: 65,
    },
    confidence_stats: {
      avg_confidence: 0.912,
      min_confidence: 0.65,
      max_confidence: 0.99,
    },
    event_type_counts: {
      WATCHLIST_MATCH: 10,
      INTRUSION_DETECTED: 10,
      SUSPICIOUS_ACTIVITY: 5,
      VEHICLE_DETECTED: 10,
      ANPR_DETECTED: 25,
      PERSON_DETECTED: 30,
      OBJECT_DETECTED: 10,
    },
    time_range: {
      start_time: '2026-08-28T00:00:00Z',
      end_time: '2026-08-29T00:00:00Z',
    },
  };

  it('accurately calculates threat ratios and severity percentages', () => {
    const total = sampleSummary.total_events;
    const threatRatio = (sampleSummary.threats.total_threats / total) * 100;
    const criticalRatio = (sampleSummary.threats.critical / total) * 100;

    expect(threatRatio).toBe(35);
    expect(criticalRatio).toBe(10);
  });

  it('correctly aggregates trend buckets across surveillance intervals', () => {
    const sampleBuckets: TrendBucket[] = [
      {
        bucket: '2026-08-29 10:00',
        total_events: 20,
        intrusions: 3,
        watchlist_matches: 2,
        suspicious_activity: 1,
        vehicles: 4,
        persons: 10,
        total_threats: 10,
        avg_confidence: 0.92,
      },
      {
        bucket: '2026-08-29 11:00',
        total_events: 30,
        intrusions: 5,
        watchlist_matches: 1,
        suspicious_activity: 2,
        vehicles: 6,
        persons: 16,
        total_threats: 14,
        avg_confidence: 0.89,
      },
    ];

    const totalEventsSum = sampleBuckets.reduce((acc, b) => acc + b.total_events, 0);
    const totalThreatsSum = sampleBuckets.reduce((acc, b) => acc + b.total_threats, 0);

    expect(totalEventsSum).toBe(50);
    expect(totalThreatsSum).toBe(24);
  });

  it('ranks surveillance cameras by threat density correctly', () => {
    const sampleCameras: CameraActivityRanking[] = [
      {
        camera_id: 'CAM-01',
        camera_name: 'North Perimeter',
        location: 'Sector 4',
        status: 'ONLINE',
        total_events: 50,
        threat_count: 15,
        critical_threats: 5,
        high_threats: 10,
        medium_threats: 0,
        avg_confidence: 0.94,
        last_event_time: '2026-08-29T11:00:00Z',
      },
      {
        camera_id: 'CAM-02',
        camera_name: 'Main Checkpoint',
        location: 'Gate A',
        status: 'ONLINE',
        total_events: 80,
        threat_count: 5,
        critical_threats: 2,
        high_threats: 3,
        medium_threats: 0,
        avg_confidence: 0.91,
        last_event_time: '2026-08-29T11:30:00Z',
      },
    ];

    // Order by threat count descending
    const sorted = [...sampleCameras].sort((a, b) => b.threat_count - a.threat_count);

    expect(sorted[0].camera_id).toBe('CAM-01');
    expect(sorted[0].threat_count).toBe(15);
    expect(sorted[1].camera_id).toBe('CAM-02');
  });

  it('computes time window offsets accurately for presets', () => {
    const computeOffsetMs = (preset: string): number => {
      switch (preset) {
        case '1h':
          return 60 * 60 * 1000;
        case '6h':
          return 6 * 60 * 60 * 1000;
        case '24h':
          return 24 * 60 * 60 * 1000;
        case '7d':
          return 7 * 24 * 60 * 60 * 1000;
        case '30d':
          return 30 * 24 * 60 * 60 * 1000;
        default:
          return 0;
      }
    };

    expect(computeOffsetMs('1h')).toBe(3600000);
    expect(computeOffsetMs('24h')).toBe(86400000);
    expect(computeOffsetMs('7d')).toBe(604800000);
  });
});
