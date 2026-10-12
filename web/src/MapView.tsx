import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { LatLon, Line, Vehicle } from './api';
import { GHOST_GLIDE_MS, MAP_CENTER, STALE_FIX_SECONDS, TILE_ATTRIBUTION, TILE_URL } from './config';
import { delayBadge, delayClass } from './delay';

export interface Focus {
  nonce: number;
  points: LatLon[];
}

export interface ShapeOverlay {
  id: string;
  color: string;
  pts: LatLon[];
}

interface Props {
  vehicles: Vehicle[];
  lines: Map<string, Line>;
  showGhosts: boolean;
  selectedId: string | null;
  /** Add to the client clock (seconds) to get server time. */
  skew: number;
  focus: Focus | null;
  shapes: ShapeOverlay[];
  onSelect: (id: string) => void;
}

interface GhostPath {
  pts: LatLon[];
  cum: number[];
  t0: number;
  t1: number;
}

interface Entry {
  fix: L.Marker;
  ghost: L.Marker;
  tether: L.Polyline;
  v: Vehicle;
  path: GhostPath | null;
  ghostPos: L.LatLng | null;
  blend: { from: L.LatLng; start: number } | null;
  stale: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function fixIcon(v: Vehicle, line: Line | undefined, selected: boolean, stale: boolean): L.DivIcon {
  const badge = delayBadge(v.delay);
  const cls = ['veh', v.inService ? '' : 'off', v.kind === 'bus' ? '' : v.kind, selected ? 'sel' : '', stale ? 'stale' : '']
    .filter(Boolean)
    .join(' ');
  const arrow = v.bearing != null ? `<i class="arrow" style="transform:rotate(${v.bearing}deg)"></i>` : '';
  const text = v.inService ? esc(line?.name ?? '') : '';
  const b = badge ? `<b class="badge d-${delayClass(v.delay)}">${badge}</b>` : '';
  return L.divIcon({
    className: 'veh-wrap',
    html: `<div class="${cls}" style="--c:${line?.color ?? '#777'};--t:${line?.textColor ?? '#fff'}">${arrow}<span>${text}</span>${b}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function ghostIcon(line: Line | undefined): L.DivIcon {
  return L.divIcon({
    className: 'veh-wrap',
    html: `<div class="veh ghost" style="--c:${line?.color ?? '#777'};--t:${line?.textColor ?? '#fff'}"><span>${esc(line?.name ?? '')}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function preparePath(pts: LatLon[], t0: number, t1: number): GhostPath {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dy = pts[i][0] - pts[i - 1][0];
    const dx = (pts[i][1] - pts[i - 1][1]) * Math.cos((pts[i][0] * Math.PI) / 180);
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return { pts, cum, t0, t1 };
}

function pointOnPath(p: GhostPath, f: number): L.LatLng {
  const target = p.cum[p.cum.length - 1] * f;
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < target) i++;
  const span = p.cum[i] - p.cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (target - p.cum[i - 1]) / span));
  const a = p.pts[i - 1];
  const b = p.pts[i];
  return L.latLng(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
}

export function MapView({ vehicles, lines, showGhosts, selectedId, skew, focus, shapes, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const shapeLayerRef = useRef<L.LayerGroup | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const skewRef = useRef(skew);
  const onSelectRef = useRef(onSelect);
  skewRef.current = skew;
  onSelectRef.current = onSelect;

  // Map lifecycle and the ghost animation loop.
  useEffect(() => {
    const map = L.map(el.current!, { center: MAP_CENTER, zoom: 11, zoomControl: true });
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);
    shapeLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    let raf = 0;
    let last = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 66) return; // ~15 fps is plenty for a 30 s feed
      last = ts;
      const now = Date.now() / 1000 + skewRef.current;
      const layer = layerRef.current!;
      for (const e of entries.current.values()) {
        const stale = now - e.v.timestamp > STALE_FIX_SECONDS;
        if (stale !== e.stale) {
          e.stale = stale;
          e.fix.getElement()?.firstElementChild?.classList.toggle('stale', stale);
        }
        const show = !!e.path && !stale;
        if (!show) {
          if (layer.hasLayer(e.ghost)) layer.removeLayer(e.ghost).removeLayer(e.tether);
          e.ghostPos = null;
          continue;
        }
        const p = e.path!;
        let pos = pointOnPath(p, Math.min(1, Math.max(0, (now - p.t0) / (p.t1 - p.t0))));
        if (e.blend) {
          const k = (performance.now() - e.blend.start) / GHOST_GLIDE_MS;
          if (k >= 1) e.blend = null;
          else {
            const s = k * k * (3 - 2 * k);
            pos = L.latLng(
              e.blend.from.lat + (pos.lat - e.blend.from.lat) * s,
              e.blend.from.lng + (pos.lng - e.blend.from.lng) * s,
            );
          }
        }
        e.ghostPos = pos;
        e.ghost.setLatLng(pos);
        e.tether.setLatLngs([e.fix.getLatLng(), pos]);
        if (!layer.hasLayer(e.ghost)) layer.addLayer(e.tether).addLayer(e.ghost);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      entries.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with the vehicle list.
  useEffect(() => {
    const layer = layerRef.current!;
    const now = Date.now() / 1000 + skewRef.current;
    const seen = new Set<string>();
    for (const v of vehicles) {
      seen.add(v.id);
      const line = v.lineId ? lines.get(v.lineId) : undefined;
      const selected = v.id === selectedId;
      const stale = now - v.timestamp > STALE_FIX_SECONDS;
      let e = entries.current.get(v.id);
      if (!e) {
        const fix = L.marker([v.lat, v.lon], { keyboard: false }).on('click', () => onSelectRef.current(v.id));
        const ghost = L.marker([v.lat, v.lon], { keyboard: false, opacity: 0.6, zIndexOffset: -500 }).on('click', () =>
          onSelectRef.current(v.id),
        );
        const tether = L.polyline([], { color: line?.color ?? '#777', weight: 2, dashArray: '2 5', opacity: 0.8, interactive: false });
        e = { fix, ghost, tether, v, path: null, ghostPos: null, blend: null, stale };
        entries.current.set(v.id, e);
        fix.addTo(layer);
      }
      e.v = v;
      e.stale = stale;
      e.fix.setLatLng([v.lat, v.lon]).setIcon(fixIcon(v, line, selected, stale)).setZIndexOffset(selected ? 1000 : 0);
      e.tether.setStyle({ color: line?.color ?? '#777' });
      if (showGhosts && v.ghost) {
        e.ghost.setIcon(ghostIcon(line));
        e.blend = e.ghostPos ? { from: e.ghostPos, start: performance.now() } : null;
        e.path = preparePath(v.ghost.path, v.ghost.t0, v.ghost.t1);
      } else {
        e.path = null;
      }
    }
    for (const [id, e] of entries.current) {
      if (seen.has(id)) continue;
      layer.removeLayer(e.fix).removeLayer(e.ghost).removeLayer(e.tether);
      entries.current.delete(id);
    }
  }, [vehicles, lines, showGhosts, selectedId]);

  // Pan/zoom on request.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || focus.points.length === 0) return;
    if (focus.points.length === 1) map.flyTo(focus.points[0], Math.max(map.getZoom(), 15), { duration: 0.6 });
    else map.flyToBounds(L.latLngBounds(focus.points), { padding: [60, 60], maxZoom: 15, duration: 0.6 });
  }, [focus]);

  // Route shapes of the current selection.
  useEffect(() => {
    const group = shapeLayerRef.current!;
    group.clearLayers();
    for (const s of shapes) {
      L.polyline(s.pts, { color: s.color, weight: 5, opacity: 0.45, interactive: false }).addTo(group);
    }
  }, [shapes]);

  return <div ref={el} className="map" />;
}
