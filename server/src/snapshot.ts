import type { transit_realtime as rt } from 'gtfs-realtime-bindings';
import { MAX_GHOST_FIX_AGE_SECONDS } from './feeds.js';
import { project, slice } from './geo.js';
import type { StaticData } from './static.js';
import type { Ghost, Snapshot, Vehicle } from './types.js';
import type { FeedConfig } from './feeds.js';

type Num = number | { toNumber(): number } | null | undefined;
const num = (v: Num): number | null => (v == null ? null : typeof v === 'number' ? v : v.toNumber());

/** Ghosts further than this from the route shape, or longer than this, are not trusted. */
const MAX_OFFSET_M = 150;
const MAX_GHOST_LENGTH_M = 5000;

interface Pending {
  stopId: string;
  stopSequence: number | null;
  delay: number | null;
  eta: number | null;
}

/** Index trip updates by trip id and by vehicle id. */
function indexTripUpdates(feed: rt.IFeedMessage) {
  const byTrip = new Map<string, rt.ITripUpdate>();
  const byVehicle = new Map<string, rt.ITripUpdate>();
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    if (!tu) continue;
    if (tu.trip?.tripId) byTrip.set(tu.trip.tripId, tu);
    if (tu.vehicle?.id) byVehicle.set(tu.vehicle.id, tu);
  }
  return { byTrip, byVehicle };
}

/** The next stop the vehicle has not served yet, with its delay and ETA. */
function nextStopUpdate(tu: rt.ITripUpdate, currentStopSequence: number | null): Pending | null {
  const updates = tu.stopTimeUpdate ?? [];
  const u =
    updates.find((s) => currentStopSequence != null && s.stopSequence != null && s.stopSequence >= currentStopSequence) ??
    updates[0];
  if (!u?.stopId) return null;
  const ev = u.arrival ?? u.departure;
  return {
    stopId: u.stopId,
    stopSequence: u.stopSequence ?? null,
    delay: num(ev?.delay) ?? num(tu.delay),
    eta: num(ev?.time),
  };
}

function buildGhost(
  data: StaticData,
  shapeId: string | null,
  lat: number,
  lon: number,
  t0: number,
  next: Pending | null,
  stopPos: [number, number] | undefined,
): Ghost | null {
  if (!shapeId || !next?.eta || !stopPos || next.eta <= t0) return null;
  const shape = data.shapes.get(shapeId);
  if (!shape) return null;
  const fix = project(shape, [lat, lon]);
  if (!fix || fix.offset > MAX_OFFSET_M) return null;
  const stop = project(shape, stopPos, fix.along - 30);
  if (!stop || stop.offset > MAX_OFFSET_M) return null;
  const to = Math.max(stop.along, fix.along);
  if (to - fix.along > MAX_GHOST_LENGTH_M) return null;
  return { path: slice(shape, fix.along, to), t0, t1: next.eta };
}

export function buildSnapshot(
  feed: Pick<FeedConfig, 'mode' | 'defaultKind' | 'staticTripId'>,
  data: StaticData,
  positions: rt.IFeedMessage,
  tripUpdates: rt.IFeedMessage | null,
  fetchedAt: number,
): Snapshot {
  // Ids are prefixed with the mode so buses and boats can share one map without clashes.
  const pre = (id: string) => `${feed.mode}:${id}`;
  const tus = tripUpdates ? indexTripUpdates(tripUpdates) : null;
  const feedTimestamp = num(positions.header?.timestamp) ?? fetchedAt;
  const vehicles: Vehicle[] = [];

  for (const e of positions.entity ?? []) {
    const v = e.vehicle;
    if (!v?.position || !v.vehicle?.id) continue;
    const id = v.vehicle.id;
    const timestamp = num(v.timestamp) ?? feedTimestamp;
    const tripId = v.trip?.tripId ?? null;
    const trip = tripId ? data.trips.get(tripId) ?? data.trips.get(feed.staticTripId?.(tripId) ?? '') : undefined;
    const tu = (tripId && tus?.byTrip.get(tripId)) || tus?.byVehicle.get(id) || null;
    const next = tu ? nextStopUpdate(tu, v.currentStopSequence ?? null) : null;
    const stop = next ? data.stops.get(next.stopId) : undefined;
    const lat = v.position.latitude;
    const lon = v.position.longitude;
    const fresh = feedTimestamp - timestamp <= MAX_GHOST_FIX_AGE_SECONDS;

    const line = trip ? data.lines.get(trip.lineId) : undefined;

    vehicles.push({
      id: pre(id),
      label: v.vehicle.label || id,
      lat,
      lon,
      bearing: v.position.bearing ?? null,
      timestamp,
      kind: line?.kind ?? feed.defaultKind,
      inService: !!trip,
      tripId: trip ? tripId : null,
      lineId: trip ? pre(trip.lineId) : null,
      headsign: trip?.headsign ?? null,
      shapeId: trip?.shapeId ? pre(trip.shapeId) : null,
      delay: trip ? next?.delay ?? null : null,
      nextStop: next && stop ? { id: next.stopId, name: stop.name, eta: next.eta } : null,
      ghost: trip && fresh ? buildGhost(data, trip.shapeId, lat, lon, timestamp, next, stop?.pos) : null,
    });
  }

  const lines = [...data.lines.values()].map((l) => ({ ...l, id: pre(l.id) }));
  return { feedTimestamp, fetchedAt, vehicles, lines };
}

/** Combine per-mode snapshots into one; the feed timestamp is the oldest of them. */
export function mergeSnapshots(snaps: Snapshot[]): Snapshot {
  return {
    feedTimestamp: Math.min(...snaps.map((s) => s.feedTimestamp)),
    fetchedAt: Math.min(...snaps.map((s) => s.fetchedAt)),
    vehicles: snaps.flatMap((s) => s.vehicles),
    lines: snaps.flatMap((s) => s.lines),
  };
}
