import { describe, it, expect } from 'vitest';
import { SurveillanceEvent } from '../types';

describe('Real-Time Surveillance Engine Logic', () => {
  const sampleEvents: SurveillanceEvent[] = [
    {
      id: 101,
      camera_id: 'CAM-GATE-01',
      event_type: 'WATCHLIST_MATCH',
      timestamp: '2026-08-29T10:00:00Z',
      confidence: 0.95,
      metadata: {
        plate_number: 'MH12DE1433',
        watchlist_status: 'STOLEN',
        watchlist_reason: 'Reported stolen vehicle in Pune district',
        ocr_confidence: 0.96,
        plate_confidence: 0.98,
      },
    },
    {
      id: 102,
      camera_id: 'CAM-PERIMETER-02',
      event_type: 'INTRUSION_DETECTED',
      timestamp: '2026-08-29T10:01:00Z',
      confidence: 0.88,
      metadata: {
        track_id: 12,
        class_name: 'person',
        bbox: [100, 150, 200, 350],
        position: { x: 150, y: 250 },
      },
    },
    {
      id: 103,
      camera_id: 'CAM-GATE-01',
      event_type: 'ANPR_DETECTED',
      timestamp: '2026-08-29T10:02:00Z',
      confidence: 0.92,
      metadata: {
        plate_number: 'DL01AB1234',
        validation_passed: true,
      },
    },
  ];

  it('prevents duplicate display of events using backend event ID as unique key', () => {
    const rawFeedWithDuplicates = [...sampleEvents, sampleEvents[0], sampleEvents[1]];
    const uniqueMap = new Map<number, SurveillanceEvent>();

    rawFeedWithDuplicates.forEach((ev) => {
      uniqueMap.set(ev.id, ev);
    });

    const deduplicated = Array.from(uniqueMap.values());
    expect(deduplicated).toHaveLength(3);
    expect(deduplicated.map((e) => e.id)).toEqual([101, 102, 103]);
  });

  it('correctly identifies newly appeared events between poll cycles', () => {
    const seenIds = new Set<number>([101, 102]);
    const incomingFeed = [
      ...sampleEvents,
      {
        id: 104,
        camera_id: 'CAM-SECTOR-04',
        event_type: 'SUSPICIOUS_ACTIVITY',
        timestamp: '2026-08-29T10:03:00Z',
        confidence: 0.84,
        metadata: {},
      },
    ];

    const newlyDetected = incomingFeed.filter((ev) => !seenIds.has(ev.id));
    expect(newlyDetected).toHaveLength(2);
    expect(newlyDetected.map((e) => e.id)).toEqual([103, 104]);
  });

  it('extracts ANPR and Watchlist events cleanly for ANPR intelligence hub', () => {
    const anprExtracted = sampleEvents.filter(
      (e) => e.event_type === 'ANPR_DETECTED' || e.event_type === 'WATCHLIST_MATCH'
    );

    expect(anprExtracted).toHaveLength(2);
    expect(anprExtracted[0].metadata?.plate_number).toBe('MH12DE1433');
    expect(anprExtracted[1].metadata?.plate_number).toBe('DL01AB1234');
  });

  it('safely extracts telemetry fields without generating undefined strings', () => {
    const eventWithPartialMeta = sampleEvents[1];
    const plate = eventWithPartialMeta.metadata?.plate_number ?? null;
    const track = eventWithPartialMeta.metadata?.track_id ?? null;
    const bbox = eventWithPartialMeta.metadata?.bbox ?? null;

    expect(plate).toBeNull();
    expect(track).toBe(12);
    expect(bbox).toEqual([100, 150, 200, 350]);
  });

  it('correctly determines system health status flags', () => {
    const onlineHealthyHealth = { status: 'healthy', database: 'connected', service: 'IBVAP Backend' };
    const degradedHealth = { status: 'healthy', database: 'disconnected', service: 'IBVAP Backend' };

    const isHealthy = onlineHealthyHealth.status === 'healthy' && onlineHealthyHealth.database === 'connected';
    const isDegraded = degradedHealth.status === 'healthy' && degradedHealth.database !== 'connected';

    expect(isHealthy).toBe(true);
    expect(isDegraded).toBe(true);
  });
});
