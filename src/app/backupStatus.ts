const WEEK_MS = 7 * 86_400_000;

/**
 * Whether Home should ask for a backup: the last export is more than 7 days old,
 * or there has never been one and at least one session is finished.
 */
export function needsExport(lastExportAt: string | null, finishedSessions: number, now: Date): boolean {
  if (lastExportAt === null) return finishedSessions >= 1;
  const last = Date.parse(lastExportAt);
  if (Number.isNaN(last)) return finishedSessions >= 1;
  return now.getTime() - last > WEEK_MS;
}
