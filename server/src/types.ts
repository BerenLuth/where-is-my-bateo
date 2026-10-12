export type LatLon = [number, number];

export type VehicleKind = 'bus' | 'tram' | 'boat';

export interface Line {
  id: string;
  name: string;
  longName: string;
  color: string;
  textColor: string;
  kind: VehicleKind;
}

export interface Ghost {
  /** Route-shape polyline from the fix to the next stop. */
  path: LatLon[];
  /** Unix seconds: when the fix was taken. */
  t0: number;
  /** Unix seconds: expected arrival at the next stop. */
  t1: number;
}

export interface Vehicle {
  id: string;
  /** Fleet number shown to riders. */
  label: string;
  lat: number;
  lon: number;
  bearing: number | null;
  /** Unix seconds of the fix. */
  timestamp: number;
  kind: VehicleKind;
  inService: boolean;
  tripId: string | null;
  lineId: string | null;
  headsign: string | null;
  shapeId: string | null;
  /** Seconds late (positive) or early (negative); null when unknown. */
  delay: number | null;
  nextStop: { id: string; name: string; eta: number | null } | null;
  ghost: Ghost | null;
}

export interface Snapshot {
  /** Unix seconds: the feed's own timestamp (oldest across feeds). */
  feedTimestamp: number;
  /** Unix seconds: when the server last fetched the feeds. */
  fetchedAt: number;
  /** Unix seconds at response time; lets the client correct for clock skew. */
  serverTime?: number;
  vehicles: Vehicle[];
  lines: Line[];
}
