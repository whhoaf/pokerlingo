import { dayKey } from '../engine/day';
import type { MapState } from '../engine/curriculum';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** m:ss, rounded up so the clock does not show 0:00 until time is truly up. */
export function formatClock(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPercent(fraction: number | null): string {
  return fraction === null ? 'n/a' : `${Math.round(fraction * 100)}%`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** When a skill is next due, in words. Uses the 4am day boundary. */
export function formatDueIn(dueIso: string, now: Date): string {
  const due = new Date(dueIso);
  if (due.getTime() <= now.getTime()) return 'Due now';
  const days = dayNumber(dayKey(due)) - dayNumber(dayKey(now));
  if (days <= 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  if (days <= 14) return `In ${days} days`;
  return formatShortDate(dueIso);
}

export function stateLabel(state: MapState): string {
  return { locked: 'Locked', new: 'New', learning: 'Learning', reviewing: 'Reviewing', strong: 'Strong' }[state];
}
