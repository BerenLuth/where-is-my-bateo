import type { VehicleKind } from './types.js';

export interface FeedConfig {
  mode: string;
  vehiclePositionsUrl: string;
  tripUpdatesUrl: string;
  staticZipUrl: string;
  /** Kind of vehicle for entries that have no line (out of service). */
  defaultKind: VehicleKind;
  /** Maps a realtime trip id to its static GTFS id when the two feeds disagree on naming. */
  staticTripId?: (realtimeTripId: string) => string;
}

const base = 'https://actv.avmspa.it/sites/default/files/attachments/opendata';

export const FEEDS: Record<string, FeedConfig> = {
  aut: {
    mode: 'aut',
    vehiclePositionsUrl: 'https://tpl.actv.it/aut/GTFSRT/vehiclePositions',
    tripUpdatesUrl: 'https://tpl.actv.it/aut/GTFSRT/tripUpdates',
    staticZipUrl: `${base}/automobilistico/actv_aut.zip`,
    defaultKind: 'bus',
  },
  nav: {
    mode: 'nav',
    vehiclePositionsUrl: 'https://tpl.actv.it/nav/GTFSRT/vehiclePositions',
    tripUpdatesUrl: 'https://tpl.actv.it/nav/GTFSRT/tripUpdates',
    staticZipUrl: `${base}/navigazione/actv_nav.zip`,
    defaultKind: 'boat',
    // The boat realtime feed says AUT_ACTV_653_123 where the static GTFS says NAV_ACTV_653_123.
    staticTripId: (id) => id.replace(/^AUT_/, 'NAV_'),
  },
};

export const REALTIME_CACHE_SECONDS = 20;
export const STATIC_REFRESH_HOURS = 24;
export const MAX_GHOST_FIX_AGE_SECONDS = 120;
