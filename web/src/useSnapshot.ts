import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSnapshot, type Loaded } from './api';
import { POLL_SECONDS, REFRESH_COOLDOWN_SECONDS, RETRY_SECONDS } from './config';

export function useSnapshot() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      setLoaded(await fetchSnapshot());
      setError(false);
    } catch {
      setError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_SECONDS * 1000);
    return () => clearInterval(id);
  }, [load]);

  // While there is nothing to show (e.g. the server is still loading static GTFS), retry quickly.
  const hasData = loaded !== null;
  useEffect(() => {
    if (!error || hasData) return;
    const id = setInterval(load, RETRY_SECONDS * 1000);
    return () => clearInterval(id);
  }, [error, hasData, load]);

  /** Manual refresh; ignored during the cooldown. */
  const refresh = useCallback(() => {
    if (Date.now() < cooldownUntil) return;
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_SECONDS * 1000);
    load();
  }, [cooldownUntil, load]);

  return { loaded, error, busy, refresh, cooldownUntil };
}

/** Re-renders every second and returns the current time in seconds. */
export function useNow(skew = 0): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return now + skew;
}
