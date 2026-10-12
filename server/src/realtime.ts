import GtfsRealtime from 'gtfs-realtime-bindings';
import { REALTIME_CACHE_SECONDS, type FeedConfig } from './feeds.js';
import { buildSnapshot } from './snapshot.js';
import type { StaticData } from './static.js';
import type { Snapshot } from './types.js';

const FeedMessage = GtfsRealtime.transit_realtime.FeedMessage;

async function fetchFeed(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));
}

/** Serves a cached snapshot, refetching at most once per cache window. */
export class SnapshotService {
  private cached: Snapshot | null = null;
  private inflight: Promise<Snapshot> | null = null;

  constructor(
    private feed: FeedConfig,
    private data: StaticData,
  ) {}

  setStatic(data: StaticData) {
    this.data = data;
  }

  get staticData() {
    return this.data;
  }

  async get(): Promise<Snapshot> {
    const now = Date.now() / 1000;
    if (this.cached && now - this.cached.fetchedAt < REALTIME_CACHE_SECONDS) return this.cached;
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    try {
      return await this.inflight;
    } catch (err) {
      if (this.cached) {
        console.warn(`[${this.feed.mode}] refresh failed, serving stale snapshot:`, err);
        return this.cached;
      }
      throw err;
    }
  }

  private async refresh(): Promise<Snapshot> {
    const [positions, tripUpdates] = await Promise.all([
      fetchFeed(this.feed.vehiclePositionsUrl),
      // Delays are a nice-to-have: positions still work without them.
      fetchFeed(this.feed.tripUpdatesUrl).catch((err) => {
        console.warn(`[${this.feed.mode}] tripUpdates unavailable:`, err.message);
        return null;
      }),
    ]);
    this.cached = buildSnapshot(this.feed, this.data, positions, tripUpdates, Date.now() / 1000);
    return this.cached;
  }
}
