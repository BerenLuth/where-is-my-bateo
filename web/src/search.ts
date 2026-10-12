import type { Line, Vehicle } from './api';

export type Selection =
  | { kind: 'line'; id: string }
  | { kind: 'vehicle'; id: string }
  | { kind: 'destination'; text: string };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export interface Suggestions {
  lines: Line[];
  vehicles: Vehicle[];
  destinations: string[];
}

const LIMIT = 6;

export function suggest(query: string, lines: Line[], vehicles: Vehicle[]): Suggestions {
  const q = norm(query);
  if (!q) return { lines: [], vehicles: [], destinations: [] };
  const matchedLines = lines
    .filter((l) => norm(l.name).startsWith(q) || norm(l.longName).includes(q))
    // Exact and prefix matches on the short name come first.
    .sort((a, b) => Number(norm(b.name) === q) - Number(norm(a.name) === q) || a.name.localeCompare(b.name, 'it', { numeric: true }))
    .slice(0, LIMIT);
  const matchedVehicles = vehicles
    .filter((v) => norm(v.label).startsWith(q) || v.id === q)
    .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }))
    .slice(0, LIMIT);
  const destinations = [...new Set(vehicles.map((v) => v.headsign).filter((h): h is string => !!h))]
    .filter((h) => norm(h).includes(q))
    .sort()
    .slice(0, LIMIT);
  return { lines: matchedLines, vehicles: matchedVehicles, destinations };
}

export function matches(sel: Selection | null, v: Vehicle): boolean {
  if (!sel) return true;
  switch (sel.kind) {
    case 'line':
      return v.lineId === sel.id;
    case 'vehicle':
      return v.id === sel.id;
    case 'destination':
      return v.headsign === sel.text;
  }
}
