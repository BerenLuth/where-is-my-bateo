import type { LatLon, Snapshot } from '../../server/src/types';

export type { Snapshot, Vehicle, Line, LatLon, VehicleKind } from '../../server/src/types';

export interface Loaded {
  snapshot: Snapshot;
  /** Add to the client clock to get server time, in seconds. */
  skew: number;
}

export async function fetchSnapshot(): Promise<Loaded> {
  const res = await fetch('/api/snapshot');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const snapshot: Snapshot = await res.json();
  const skew = (snapshot.serverTime ?? snapshot.fetchedAt) - Date.now() / 1000;
  return { snapshot, skew };
}

const shapeCache = new Map<string, Promise<LatLon[]>>();

export function fetchShape(id: string): Promise<LatLon[]> {
  let p = shapeCache.get(id);
  if (!p) {
    p = fetch(`/api/shapes/${encodeURIComponent(id)}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    shapeCache.set(id, p);
  }
  return p;
}
