import type { SkillRecord } from '../engine/curriculum';
import { currentStreak, dayKey } from '../engine/day';
import { isDue } from '../engine/scheduler';
import type { ReviewLogRecord, SessionRecord } from '../engine/session';
import type { Curriculum } from '../engine/curriculum';
import type { Repo, Settings } from '../storage/repo';

/** Everything the screens need, loaded from IndexedDB. */
export interface AppData {
  records: Map<string, SkillRecord>;
  settings: Settings;
  sessions: SessionRecord[];
  logs: ReviewLogRecord[];
  lastExportAt: string | null;
}

export async function loadAppData(repo: Repo): Promise<AppData> {
  const [records, settings, sessions, logs, lastExportAt] = await Promise.all([
    repo.loadSkillRecords(),
    repo.loadSettings(),
    repo.listSessions(),
    repo.listReviewLogs(),
    repo.getLastExportAt(),
  ]);
  return { records, settings, sessions, logs, lastExportAt };
}

export interface Overview {
  today: string;
  finishedSessions: number;
  doneToday: boolean;
  streak: number;
  dueCount: number;
  /** ISO time of the earliest review that is not yet due, or null. */
  nextDue: string | null;
  /** A session would have something to do: a review is due or a new skill can be introduced. */
  hasWork: boolean;
  firstRun: boolean;
}

export function overview(data: AppData, curriculum: Curriculum, now: Date): Overview {
  const today = dayKey(now);
  const finished = data.sessions.filter((s) => s.finished && s.answered > 0);
  const finishedDays = finished.map((s) => s.dayKey);
  const all = [...data.records.values()];
  const due = all.filter((r) => isDue(r.card, now));
  const upcoming = all
    .filter((r) => !isDue(r.card, now))
    .map((r) => r.card.due)
    .sort();
  const canLearn = data.settings.newPerSession > 0 && curriculum.nextToIntroduce(data.records) !== undefined;
  return {
    today,
    finishedSessions: finished.length,
    doneToday: finishedDays.includes(today),
    streak: currentStreak(finishedDays, today),
    dueCount: due.length,
    nextDue: upcoming[0] ?? null,
    hasWork: due.length > 0 || canLearn,
    firstRun: data.sessions.length === 0 && data.records.size === 0,
  };
}

/** Accuracy for one skill over every logged answer, or null with none. */
export function skillAccuracy(logs: readonly ReviewLogRecord[], skillId: string): { answered: number; correct: number } {
  const mine = logs.filter((l) => l.skillId === skillId);
  return { answered: mine.length, correct: mine.filter((l) => l.correct).length };
}
