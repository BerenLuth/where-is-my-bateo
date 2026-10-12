import type { Line, Vehicle } from './api';
import { STALE_FIX_SECONDS } from './config';
import { delayClass, delayLabel } from './delay';
import { t } from './i18n';
import type { Selection } from './search';

interface Props {
  selection: Selection | null;
  lines: Map<string, Line>;
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  now: number;
  onSelectVehicle: (id: string) => void;
  onClear: () => void;
}

const time = (s: number) => new Date(s * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function LineChip({ line }: { line: Line | undefined }) {
  return line ? (
    <span className="chip" style={{ background: line.color, color: line.textColor }}>{line.name}</span>
  ) : null;
}

function VehicleCard({ v, line, now }: { v: Vehicle; line: Line | undefined; now: number }) {
  const age = Math.max(0, Math.round(now - v.timestamp));
  return (
    <div className="card">
      <div className="card-head">
        <LineChip line={line} />
        <strong>{t.vehicleN(v.label)}</strong>
        {v.kind !== 'bus' && <span className="tag">{t.kindOne[v.kind]}</span>}
      </div>
      {v.inService ? (
        <>
          <div className="row">{t.towards}: <strong>{v.headsign}</strong></div>
          <div className={`delay d-${delayClass(v.delay)}`}>{delayLabel(v.delay)}</div>
          {v.nextStop && (
            <div className="row">
              {t.nextStop}: <strong>{v.nextStop.name}</strong>
              {v.nextStop.eta && <span className="muted"> · {t.eta} {time(v.nextStop.eta)}</span>}
            </div>
          )}
        </>
      ) : (
        <div className="row muted">{t.outOfServiceLabel}</div>
      )}
      <div className="row muted">{t.fixAge(age)}</div>
      {age > STALE_FIX_SECONDS && <div className="warn">{t.staleWarning}</div>}
    </div>
  );
}

export function Panel({ selection, lines, vehicles, selectedVehicle, now, onSelectVehicle, onClear }: Props) {
  if (!selection) return null;
  const listed = selection.kind === 'vehicle' ? [] : vehicles;
  return (
    <aside className="panel">
      <button className="close" onClick={onClear} aria-label={t.clearSelection}>✕</button>
      {selectedVehicle && <VehicleCard v={selectedVehicle} line={lines.get(selectedVehicle.lineId ?? '')} now={now} />}
      {selection.kind !== 'vehicle' && (
        <>
          <div className="list-head">
            {selection.kind === 'line' && <LineChip line={lines.get(selection.id)} />}
            <strong>{selection.kind === 'line' ? lines.get(selection.id)?.longName : `→ ${selection.text}`}</strong>
            <span className="muted">{t.vehiclesCount(listed.length)}</span>
          </div>
          {listed.length === 0 && <div className="muted">{t.noVehiclesForSelection}</div>}
          <ul className="vlist">
            {[...listed]
              .sort((a, b) => (b.delay ?? -Infinity) - (a.delay ?? -Infinity))
              .map((v) => (
                <li key={v.id}>
                  <button onClick={() => onSelectVehicle(v.id)} className={selectedVehicle?.id === v.id ? 'on' : ''}>
                    <span className="chip plain">{v.label}</span>
                    <span className="grow">{v.headsign}</span>
                    <span className={`delay d-${delayClass(v.delay)}`}>{delayLabel(v.delay)}</span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </aside>
  );
}
