// The day rolls over at 4am local time, so a late-night session counts for the day it started.

const ROLLOVER_HOURS = 4;

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for the local date of (now minus 4 hours). */
export function dayKey(now: Date): string {
  const shifted = new Date(now.getTime() - ROLLOVER_HOURS * 3_600_000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

/** Move a day key by whole days. Pure calendar arithmetic, no time zone involved. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Consecutive days with a finished session, ending today. If today has none
 * yet, a streak that ran up to yesterday still counts, because today is not over.
 */
export function currentStreak(finishedDayKeys: readonly string[], today: string): number {
  const days = new Set(finishedDayKeys);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
