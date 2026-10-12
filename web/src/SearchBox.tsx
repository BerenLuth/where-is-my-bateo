import { useMemo, useState } from 'react';
import type { Line, Vehicle } from './api';
import { t } from './i18n';
import { suggest, type Selection } from './search';

interface Props {
  lines: Line[];
  vehicles: Vehicle[];
  onSelect: (s: Selection) => void;
}

export function SearchBox({ lines, vehicles, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const sug = useMemo(() => suggest(query, lines, vehicles), [query, lines, vehicles]);
  const total = sug.lines.length + sug.vehicles.length + sug.destinations.length;

  const pick = (s: Selection) => {
    onSelect(s);
    setQuery('');
    setOpen(false);
  };

  const firstPick = (): Selection | null =>
    sug.lines[0]
      ? { kind: 'line', id: sug.lines[0].id }
      : sug.vehicles[0]
        ? { kind: 'vehicle', id: sug.vehicles[0].id }
        : sug.destinations[0]
          ? { kind: 'destination', text: sug.destinations[0] }
          : null;

  return (
    <div className="search">
      <input
        type="search"
        value={query}
        placeholder={t.searchPlaceholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const s = firstPick();
            if (s) pick(s);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label={t.searchPlaceholder}
      />
      {open && query && (
        <div className="suggestions">
          {total === 0 && <div className="empty">{t.noResults}</div>}
          {sug.lines.length > 0 && <h4>{t.groupLines}</h4>}
          {sug.lines.map((l) => (
            <button key={l.id} onMouseDown={() => pick({ kind: 'line', id: l.id })}>
              <span className="chip" style={{ background: l.color, color: l.textColor }}>{l.name}</span>
              <span>{l.longName}</span>
            </button>
          ))}
          {sug.vehicles.length > 0 && <h4>{t.groupVehicles}</h4>}
          {sug.vehicles.map((v) => (
            <button key={v.id} onMouseDown={() => pick({ kind: 'vehicle', id: v.id })}>
              <span className="chip plain">{v.label}</span>
              <span>{v.headsign ? `→ ${v.headsign}` : t.outOfServiceLabel}</span>
            </button>
          ))}
          {sug.destinations.length > 0 && <h4>{t.groupDestinations}</h4>}
          {sug.destinations.map((d) => (
            <button key={d} onMouseDown={() => pick({ kind: 'destination', text: d })}>
              <span>→ {d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
