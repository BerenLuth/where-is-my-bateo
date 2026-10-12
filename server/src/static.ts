import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShape, type Shape } from './geo.js';
import type { FeedConfig } from './feeds.js';
import { STATIC_REFRESH_HOURS } from './feeds.js';
import type { Line, LatLon } from './types.js';

export interface TripInfo {
  lineId: string;
  headsign: string;
  shapeId: string | null;
}

export interface StopInfo {
  name: string;
  pos: LatLon;
}

export interface StaticData {
  lines: Map<string, Line>;
  trips: Map<string, TripInfo>;
  shapes: Map<string, Shape>;
  stops: Map<string, StopInfo>;
}

type Row = Record<string, string>;

const cacheDir = process.env.CACHE_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');

function rows(zip: AdmZip, name: string): Row[] {
  const entry = zip.getEntry(name);
  if (!entry) throw new Error(`${name} missing from GTFS zip`);
  return parse(entry.getData(), { columns: true, skip_empty_lines: true, bom: true });
}

export function parseStatic(zip: AdmZip): StaticData {
  const lines = new Map<string, Line>();
  for (const r of rows(zip, 'routes.txt')) {
    lines.set(r.route_id, {
      id: r.route_id,
      name: r.route_short_name,
      longName: r.route_long_name,
      color: `#${r.route_color || '555555'}`,
      textColor: `#${r.route_text_color || 'FFFFFF'}`,
      kind: r.route_type === '0' ? 'tram' : r.route_type === '4' ? 'boat' : 'bus',
    });
  }

  const trips = new Map<string, TripInfo>();
  for (const r of rows(zip, 'trips.txt')) {
    trips.set(r.trip_id, { lineId: r.route_id, headsign: r.trip_headsign, shapeId: r.shape_id || null });
  }

  const raw = new Map<string, [number, LatLon][]>();
  for (const r of rows(zip, 'shapes.txt')) {
    let list = raw.get(r.shape_id);
    if (!list) raw.set(r.shape_id, (list = []));
    list.push([Number(r.shape_pt_sequence), [Number(r.shape_pt_lat), Number(r.shape_pt_lon)]]);
  }
  const shapes = new Map<string, Shape>();
  for (const [id, list] of raw) {
    list.sort((a, b) => a[0] - b[0]);
    shapes.set(id, buildShape(list.map((p) => p[1])));
  }

  const stops = new Map<string, StopInfo>();
  for (const r of rows(zip, 'stops.txt')) {
    stops.set(r.stop_id, { name: r.stop_name, pos: [Number(r.stop_lat), Number(r.stop_lon)] });
  }
  return { lines, trips, shapes, stops };
}

async function loadZip(feed: FeedConfig): Promise<AdmZip> {
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${feed.mode}.zip`);
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < STATIC_REFRESH_HOURS * 3600e3;
  if (!fresh) {
    console.log(`[${feed.mode}] downloading static GTFS…`);
    const res = await fetch(feed.staticZipUrl);
    if (!res.ok) throw new Error(`static GTFS: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return new AdmZip(file);
}

export async function loadStatic(feed: FeedConfig): Promise<StaticData> {
  const data = parseStatic(await loadZip(feed));
  console.log(`[${feed.mode}] static GTFS: ${data.lines.size} lines, ${data.trips.size} trips, ${data.shapes.size} shapes, ${data.stops.size} stops`);
  return data;
}
