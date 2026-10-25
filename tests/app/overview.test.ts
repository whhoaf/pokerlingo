import { describe, expect, it } from 'vitest';
import { overview, skillAccuracy, type AppData } from '../../src/app/data';
import { createCurriculum, type SkillRecord } from '../../src/engine/curriculum';
import { dayKey } from '../../src/engine/day';
import { reviewCard } from '../../src/engine/scheduler';
import { DEFAULT_SETTINGS } from '../../src/storage/repo';
import { fakeSkill } from '../helpers/fakeSkills';

const NOW = new Date(2026, 9, 25, 12, 0);
const curriculum = createCurriculum([fakeSkill('S1'), fakeSkill('S2')]);

function rec(id: string, dueOffsetMs: number): SkillRecord {
  const card = reviewCard(undefined, NOW, 'easy').card;
  return { skillId: id, card: { ...card, due: new Date(NOW.getTime() + dueOffsetMs).toISOString() }, introducedAt: NOW.toISOString() };
}

function data(partial: Partial<AppData> = {}): AppData {
  return { records: new Map(), settings: DEFAULT_SETTINGS, sessions: [], logs: [], lastExportAt: null, ...partial };
}

const finished = (key: string, answered = 10) => ({
  dayKey: key,
  startedAt: NOW.toISOString(),
  endedAt: NOW.toISOString(),
  answered,
  correct: answered,
  finished: true,
});

describe('overview', () => {
  it('is a first run with no data, and a session has something to do', () => {
    const o = overview(data(), curriculum, NOW);
    expect(o.firstRun).toBe(true);
    expect(o.hasWork).toBe(true);
    expect(o.dueCount).toBe(0);
    expect(o.streak).toBe(0);
  });

  it('counts due skills and finds the next review', () => {
    const records = new Map([
      ['S1', rec('S1', -1000)],
      ['S2', rec('S2', 3 * 86_400_000)],
    ]);
    const o = overview(data({ records }), curriculum, NOW);
    expect(o.dueCount).toBe(1);
    expect(o.nextDue).toBe(records.get('S2')!.card.due);
    expect(o.firstRun).toBe(false);
  });

  it('has nothing to do when everything is introduced and not due', () => {
    const records = new Map([
      ['S1', rec('S1', 86_400_000)],
      ['S2', rec('S2', 86_400_000)],
    ]);
    expect(overview(data({ records }), curriculum, NOW).hasWork).toBe(false);
  });

  it('can still learn a new skill when none is due', () => {
    const records = new Map([['S1', rec('S1', 86_400_000)]]);
    expect(overview(data({ records }), curriculum, NOW).hasWork).toBe(true);
  });

  it('knows when today is done and counts the streak', () => {
    const today = dayKey(NOW);
    const sessions = [finished('2026-10-23'), finished('2026-10-24'), finished(today)];
    const o = overview(data({ sessions }), curriculum, NOW);
    expect(o.doneToday).toBe(true);
    expect(o.streak).toBe(3);
    expect(o.finishedSessions).toBe(3);
  });

  it('does not count an unfinished or empty session', () => {
    const today = dayKey(NOW);
    const sessions = [{ ...finished(today), finished: false }, finished('2026-10-24', 0)];
    const o = overview(data({ sessions }), curriculum, NOW);
    expect(o.doneToday).toBe(false);
    expect(o.streak).toBe(0);
  });
});

describe('skillAccuracy', () => {
  it('counts answers for one skill', () => {
    const log = (skillId: string, correct: boolean) => ({ skillId, at: NOW.toISOString(), correct, rating: 3, ms: 1, seed: 1, practice: false });
    const logs = [log('S1', true), log('S1', false), log('S2', true), log('S1', true)];
    expect(skillAccuracy(logs, 'S1')).toEqual({ answered: 3, correct: 2 });
    expect(skillAccuracy(logs, 'S9')).toEqual({ answered: 0, correct: 0 });
  });
});
