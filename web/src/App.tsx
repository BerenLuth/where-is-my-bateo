import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchShape, type Vehicle, type VehicleKind } from './api';
import { MapView, type Focus, type ShapeOverlay } from './MapView';
import { Panel } from './Panel';
import { SearchBox } from './SearchBox';
import { matches, type Selection } from './search';
import { t } from './i18n';
import { useNow, useOnline, useSnapshot } from './useSnapshot';
import { useTheme } from './useTheme';
import { useVehicleUrl, vehicleFromUrl } from './useVehicleUrl';

const MAX_SHAPES = 6;

export function App() {
  const { loaded, error, busy, refresh, cooldownUntil } = useSnapshot();
  const skew = loaded?.skew ?? 0;
  const now = useNow(skew);
  const online = useOnline();
  const errorText = online ? t.loadError : t.offline;
  const { theme, toggle: toggleTheme } = useTheme();
  const [selection, setSelection] = useState<Selection | null>(() => {
    const id = vehicleFromUrl();
    return id ? { kind: 'vehicle', id } : null;
  });
  const [pickedVehicle, setPickedVehicle] = useState<string | null>(null);
  const [showGhosts, setShowGhosts] = useState(true);
  const [showOut, setShowOut] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false); // bottom sheet on small screens; always visible on desktop
  const [kinds, setKinds] = useState<Record<VehicleKind, boolean>>({ bus: true, tram: true, boat: true });
  const [focus, setFocus] = useState<Focus | null>(null);
  const [shapes, setShapes] = useState<ShapeOverlay[]>([]);

  const snapshot = loaded?.snapshot ?? null;
  const allVehicles = useMemo(() => (snapshot?.vehicles ?? []).filter((v) => kinds[v.kind]), [snapshot, kinds]);
  const lines = useMemo(() => new Map((snapshot?.lines ?? []).map((l) => [l.id, l])), [snapshot]);

  const selected = useMemo(() => (selection ? allVehicles.filter((v) => matches(selection, v)) : []), [selection, allVehicles]);
  const visible = useMemo(() => {
    if (!snapshot) return [];
    if (selection) return selected.filter((v) => v.inService || showOut || selection.kind === 'vehicle' || v.id === pickedVehicle);
    return allVehicles.filter((v) => v.inService || showOut);
  }, [snapshot, allVehicles, selection, selected, showOut, pickedVehicle]);

  const openId = pickedVehicle ?? (selection?.kind === 'vehicle' ? selection.id : null);
  const selectedVehicle: Vehicle | null = useMemo(
    () => snapshot?.vehicles.find((v) => v.id === openId) ?? null,
    [snapshot, openId],
  );

  const focusOn = useCallback((vs: Vehicle[]) => {
    setFocus((f) => ({ nonce: (f?.nonce ?? 0) + 1, points: vs.map((v) => [v.lat, v.lon]) }));
  }, []);

  const select = (s: Selection) => {
    setSelection(s);
    setPickedVehicle(null);
    const vs = allVehicles.filter((v) => matches(s, v) && (v.inService || s.kind === 'vehicle'));
    focusOn(vs);
  };

  const pickVehicle = (id: string) => {
    setPickedVehicle(id);
    if (!selection) setSelection({ kind: 'vehicle', id });
    const v = snapshot?.vehicles.find((x) => x.id === id);
    if (v) focusOn([v]);
  };

  const clear = () => {
    setSelection(null);
    setPickedVehicle(null);
  };

  // Back closes the open vehicle (keeping a line or destination selection); forward reopens it.
  useVehicleUrl(openId, (id) => {
    if (id) return pickVehicle(id);
    setPickedVehicle(null);
    setSelection((s) => (s?.kind === 'vehicle' ? null : s));
  });

  // A shared link (?v=) opened the app: fly to that vehicle once data arrives, or drop it if it is gone.
  const deepLink = useRef(openId);
  useEffect(() => {
    const id = deepLink.current;
    if (!snapshot || !id) return;
    deepLink.current = null;
    const v = snapshot.vehicles.find((x) => x.id === id);
    if (v) focusOn([v]);
    else clear();
  }, [snapshot, focusOn]);

  // Draw the route shapes of whatever is selected.
  const shapeKey = useMemo(() => {
    if (!selection) return '';
    const ids = new Set(visible.filter((v) => v.inService && v.shapeId).map((v) => `${v.shapeId}|${v.lineId}`));
    return [...ids].slice(0, MAX_SHAPES).join(',');
  }, [selection, visible]);

  useEffect(() => {
    let cancelled = false;
    const parts = shapeKey ? shapeKey.split(',') : [];
    Promise.all(
      parts.map(async (p) => {
        const [id, lineId] = p.split('|');
        return { id, color: lines.get(lineId)?.color ?? '#555', pts: await fetchShape(id) };
      }),
    )
      .then((s) => !cancelled && setShapes(s))
      .catch(() => !cancelled && setShapes([]));
    return () => {
      cancelled = true;
    };
  }, [shapeKey, lines]);

  const feedAge = snapshot ? Math.max(0, Math.round(now - snapshot.feedTimestamp)) : 0;
  const cooling = Date.now() < cooldownUntil;
  const inService = allVehicles.filter((v) => v.inService).length;

  return (
    <div className="app">
      <header className="bar">
        <h1>{t.appName}</h1>
        <SearchBox lines={snapshot?.lines ?? []} vehicles={allVehicles} onSelect={select} />
        <div className="status">
          {snapshot && (
            <>
              <span>{t.vehiclesCount(inService)}</span>
              <span className={feedAge > 120 ? 'warn-text' : ''}>{t.updatedAgo(feedAge)}</span>
            </>
          )}
          <button
            className="theme"
            onClick={toggleTheme}
            title={theme === 'dark' ? t.switchToLight : t.switchToDark}
            aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button onClick={refresh} disabled={busy || cooling} title={t.refresh} aria-label={t.refresh}>
            <span className={busy ? 'spin' : ''}>⟳</span>
          </button>
          <button
            className="opts"
            onClick={() => setOptionsOpen((o) => !o)}
            aria-expanded={optionsOpen}
            aria-label={t.options}
            title={t.options}
          >
            ⚙
          </button>
        </div>
      </header>

      <main>
        {snapshot && (
          <MapView
            vehicles={visible}
            lines={lines}
            showGhosts={showGhosts}
            theme={theme}
            selectedId={selectedVehicle?.id ?? null}
            skew={skew}
            focus={focus}
            shapes={shapes}
            onSelect={pickVehicle}
          />
        )}
        {!snapshot && <div className="splash">{error || !online ? errorText : t.loading}</div>}
        {snapshot && (error || !online) && <div className="toast">{errorText}</div>}

        <Panel
          selection={selection}
          lines={lines}
          vehicles={selection?.kind === 'vehicle' ? [] : selected.filter((v) => v.inService || showOut)}
          selectedVehicle={selectedVehicle}
          now={now}
          onSelectVehicle={pickVehicle}
          onClear={clear}
        />

        {optionsOpen && <div className="backdrop" onClick={() => setOptionsOpen(false)} />}
        <div className={`legend${optionsOpen ? ' open' : ''}`}>
          <div className="legend-head">
            <strong>{t.optionsTitle}</strong>
            <button onClick={() => setOptionsOpen(false)} aria-label={t.clearSelection}>✕</button>
          </div>
          {snapshot && (
            <div className="legend-status muted">
              {t.vehiclesCount(inService)} · <span className={feedAge > 120 ? 'warn-text' : ''}>{t.updatedAgo(feedAge)}</span>
            </div>
          )}
          <label><input type="checkbox" checked={showGhosts} onChange={(e) => setShowGhosts(e.target.checked)} /> {t.showGhosts}</label>
          <label><input type="checkbox" checked={showOut} onChange={(e) => setShowOut(e.target.checked)} /> {t.showOutOfService}</label>
          <div className="kinds">
            {(Object.keys(kinds) as VehicleKind[]).map((k) => (
              <label key={k}>
                <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} /> {t.kinds[k]}
              </label>
            ))}
          </div>
          <div className="keys">
            <span><i className="key solid" /> {t.legendFix}</span>
            <span><i className="key ghost" /> {t.legendGhost}</span>
            <span><i className="key stale" /> {t.legendStale}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
