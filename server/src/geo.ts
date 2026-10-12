import type { LatLon } from './types.js';

export interface Shape {
  pts: LatLon[];
  /** Cumulative distance in metres at each point. */
  cum: number[];
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distance(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function buildShape(pts: LatLon[]): Shape {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distance(pts[i - 1], pts[i]));
  return { pts, cum };
}

export interface Projection {
  /** Distance along the shape in metres. */
  along: number;
  /** Distance from the shape to the projected point in metres. */
  offset: number;
}

/** Project p onto the shape, ignoring segments that end before `minAlong`. */
export function project(shape: Shape, p: LatLon, minAlong = 0): Projection | null {
  const { pts, cum } = shape;
  const cosLat = Math.cos(rad(p[0]));
  let best: Projection | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    if (cum[i + 1] < minAlong) continue;
    // Local equirectangular plane, in metres.
    const ax = rad(pts[i][1] - p[1]) * cosLat * R;
    const ay = rad(pts[i][0] - p[0]) * R;
    const bx = rad(pts[i + 1][1] - p[1]) * cosLat * R;
    const by = rad(pts[i + 1][0] - p[0]) * R;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || off < best.offset) {
      best = { offset: off, along: cum[i] + t * (cum[i + 1] - cum[i]) };
    }
  }
  return best;
}

export function pointAt(shape: Shape, along: number): LatLon {
  const { pts, cum } = shape;
  if (along <= 0) return pts[0];
  if (along >= cum[cum.length - 1]) return pts[pts.length - 1];
  let i = 1;
  while (cum[i] < along) i++;
  const t = (along - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])];
}

/** Polyline of the shape between two distances along it. */
export function slice(shape: Shape, from: number, to: number): LatLon[] {
  const out: LatLon[] = [pointAt(shape, from)];
  for (let i = 0; i < shape.pts.length; i++) {
    if (shape.cum[i] > from && shape.cum[i] < to) out.push(shape.pts[i]);
  }
  out.push(pointAt(shape, to));
  return out;
}
