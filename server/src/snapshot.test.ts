import { describe, expect, it } from 'vitest';
import { buildShape } from './geo.js';
import { buildSnapshot, mergeSnapshots } from './snapshot.js';
import type { StaticData } from './static.js';

const data: StaticData = {
  lines: new Map([['L1', { id: 'L1', name: '1', longName: 'A - B', color: '#fff', textColor: '#000', kind: 'bus' }]]),
  trips: new Map([['T1', { lineId: 'L1', headsign: 'B', shapeId: 'S1' }]]),
  shapes: new Map([['S1', buildShape([[45, 12], [45, 12.01], [45, 12.02]])]]),
  stops: new Map([['stopB', { name: 'Stop B', pos: [45, 12.02] }]]),
};

const NOW = 1_000_000;
const positions = {
  header: { timestamp: NOW },
  entity: [
    {
      id: '1',
      vehicle: {
        trip: { tripId: 'T1' },
        vehicle: { id: 'v1', label: '587' },
        position: { latitude: 45, longitude: 12.005 },
        currentStopSequence: 2,
        timestamp: NOW - 10,
      },
    },
    { id: '2', vehicle: { vehicle: { id: 'v2', label: '9' }, position: { latitude: 45, longitude: 12 }, timestamp: NOW - 10 } },
    {
      id: '3',
      vehicle: {
        trip: { tripId: 'T1' },
        vehicle: { id: 'v3', label: '3' },
        position: { latitude: 45, longitude: 12.005 },
        timestamp: NOW - 500,
      },
    },
  ],
} as never;

const tripUpdates = {
  entity: [
    {
      id: 'a',
      tripUpdate: {
        trip: { tripId: 'T1' },
        stopTimeUpdate: [
          { stopSequence: 1, stopId: 'old', arrival: { delay: 0 } },
          { stopSequence: 2, stopId: 'stopB', arrival: { delay: 180, time: NOW + 120 } },
        ],
      },
    },
  ],
} as never;

describe('buildSnapshot', () => {
  const snap = buildSnapshot({ mode: 'aut', defaultKind: 'bus' }, data, positions, tripUpdates, NOW);
  const byId = Object.fromEntries(snap.vehicles.map((v) => [v.id.replace('aut:', ''), v]));

  it('joins position, trip and delay, using the next unserved stop', () => {
    expect(byId.v1).toMatchObject({ label: '587', kind: 'bus', lineId: 'aut:L1', shapeId: 'aut:S1', headsign: 'B', delay: 180, inService: true });
    expect(byId.v1.nextStop).toEqual({ id: 'stopB', name: 'Stop B', eta: NOW + 120 });
  });

  it('marks vehicles without a trip as out of service, with no delay or ghost', () => {
    expect(byId.v2).toMatchObject({ inService: false, lineId: null, delay: null, ghost: null });
  });

  it('builds a ghost path from the fix to the next stop', () => {
    const g = byId.v1.ghost!;
    expect(g.t1).toBe(NOW + 120);
    expect(g.path[g.path.length - 1]).toEqual([45, 12.02]);
  });

  it('gives no ghost to a stale fix', () => {
    expect(byId.v3.ghost).toBeNull();
  });

  it('still works without trip updates', () => {
    const s = buildSnapshot({ mode: 'aut', defaultKind: 'bus' }, data, positions, null, NOW);
    expect(s.vehicles.find((v) => v.id === 'aut:v1')!.delay).toBeNull();
  });

  it('gives out-of-service vehicles the feed default kind', () => {
    const boats = buildSnapshot({ mode: 'nav', defaultKind: 'boat' }, data, positions, null, NOW);
    expect(boats.vehicles.find((v) => v.id === 'nav:v2')!.kind).toBe('boat');
  });

  it('merges snapshots with the oldest timestamp', () => {
    const boats = buildSnapshot({ mode: 'nav', defaultKind: 'boat' }, data, { ...(positions as object), header: { timestamp: NOW - 40 } } as never, null, NOW - 5);
    const merged = mergeSnapshots([snap, boats]);
    expect(merged.feedTimestamp).toBe(NOW - 40);
    expect(new Set(merged.vehicles.map((v) => v.id)).size).toBe(snap.vehicles.length + boats.vehicles.length);
  });
});

describe('static trip id mapping', () => {
  it('finds the static trip when the realtime feed names it differently', () => {
    const renamed = {
      header: { timestamp: NOW },
      entity: [
        {
          id: '1',
          vehicle: {
            trip: { tripId: 'AUT_ACTV_1' },
            vehicle: { id: 'b1', label: '90' },
            position: { latitude: 45, longitude: 12.005 },
            timestamp: NOW,
          },
        },
      ],
    } as never;
    const d: StaticData = { ...data, trips: new Map([['NAV_ACTV_1', { lineId: 'L1', headsign: 'B', shapeId: 'S1' }]]) };
    const feed = { mode: 'nav', defaultKind: 'boat' as const, staticTripId: (id: string) => id.replace(/^AUT_/, 'NAV_') };
    const v = buildSnapshot(feed, d, renamed, null, NOW).vehicles[0];
    expect(v).toMatchObject({ inService: true, tripId: 'AUT_ACTV_1', lineId: 'nav:L1' });
  });
});
