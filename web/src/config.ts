export const POLL_SECONDS = 30;
export const REFRESH_COOLDOWN_SECONDS = 5;
/** Retry interval while no data has loaded yet. */
export const RETRY_SECONDS = 3;
/** A fix older than this is greyed out and gets no ghost. */
export const STALE_FIX_SECONDS = 120;
/** How long a ghost takes to glide to its corrected position after a new snapshot. */
export const GHOST_GLIDE_MS = 1500;

export const DELAY_THRESHOLDS = {
  /** Within ± this many seconds the vehicle is "on time". */
  onTime: 60,
  /** Up to this many seconds late stays green. */
  green: 180,
  /** Up to this many seconds late is amber; beyond is red. */
  amber: 300,
};

/** Override at build time (`VITE_TILE_URL`, `VITE_TILE_ATTRIBUTION`) to use another tile provider. */
export const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || '© OpenStreetMap · dati ACTV';

export const MAP_CENTER: [number, number] = [45.49, 12.25];
