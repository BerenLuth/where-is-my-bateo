import { useEffect, useRef } from 'react';

const PARAM = 'v';
/** Marks the history entry this app pushed for an open vehicle, so closing it can pop it again. */
const MARK = 'vehicleEntry';

function pathWith(id: string | null): string {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set(PARAM, id);
  else u.searchParams.delete(PARAM);
  return u.pathname + u.search + u.hash;
}

/** The vehicle id in the current URL (`?v=`), e.g. from a shared link. */
export const vehicleFromUrl = (): string | null => new URLSearchParams(window.location.search).get(PARAM);

/** Absolute link that opens the app on this vehicle. */
export const vehicleLink = (id: string): string => window.location.origin + pathWith(id);

/**
 * Mirrors the open vehicle into `?v=` and gives it its own history entry, so the browser back
 * button closes it. Switching vehicles replaces that entry; closing pops it. With no vehicle open
 * there is no extra entry and back behaves normally.
 *
 * `onUrlChange` gets the vehicle id the URL now points to after back/forward (null: close it).
 */
export function useVehicleUrl(openId: string | null, onUrlChange: (id: string | null) => void) {
  const cb = useRef(onUrlChange);
  cb.current = onUrlChange;

  useEffect(() => {
    const onPop = () => cb.current(vehicleFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const inUrl = vehicleFromUrl();
    const ours = window.history.state?.[MARK] === true;
    if (openId) {
      if (!ours) {
        // Opened from a shared link: put a vehicle-less entry underneath so back closes it
        // instead of leaving the app.
        if (inUrl) window.history.replaceState(null, '', pathWith(null));
        window.history.pushState({ [MARK]: true }, '', pathWith(openId));
      } else if (inUrl !== openId) {
        window.history.replaceState(window.history.state, '', pathWith(openId));
      }
    } else if (inUrl) {
      if (ours) window.history.back(); // the popstate that follows finds no vehicle: a no-op
      else window.history.replaceState(window.history.state, '', pathWith(null));
    }
  }, [openId]);
}
