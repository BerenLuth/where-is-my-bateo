import { DELAY_THRESHOLDS as T } from './config';
import { t } from './i18n';

export type DelayClass = 'unknown' | 'early' | 'ok' | 'late' | 'verylate';

export function delayClass(sec: number | null): DelayClass {
  if (sec == null) return 'unknown';
  if (sec < -T.onTime) return 'early';
  if (sec <= T.green) return 'ok';
  if (sec <= T.amber) return 'late';
  return 'verylate';
}

export function delayMinutes(sec: number): number {
  return Math.round(Math.abs(sec) / 60);
}

export function delayLabel(sec: number | null): string {
  if (sec == null) return t.noDelayInfo;
  if (Math.abs(sec) <= T.onTime) return t.onTime;
  return sec > 0 ? t.late(delayMinutes(sec)) : t.early(delayMinutes(sec));
}

/** Compact text for the map badge. */
export function delayBadge(sec: number | null): string {
  if (sec == null || Math.abs(sec) <= T.onTime) return '';
  return `${sec > 0 ? '+' : '−'}${delayMinutes(sec)}`;
}
