import { describe, expect, it } from 'vitest';
import { createCurriculum, type SkillRecord } from '../../src/engine/curriculum';
import { PracticeRun, Session, type ReviewEvent, type SessionRecord } from '../../src/engine/session';
import { retrievability, reviewCard } from '../../src/engine/scheduler';
import type { Answer, SkillDef } from '../../src/engine/types';
import { RIGHT, WRONG, fakeSkill } from '../helpers/fakeSkills';

const MIN = 60_000;
const DAY = 86_400_000;
const START = new Date('2026-10-25T08:00:00Z');

function makeClock(start = START) {
  let t = start.getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

/** An introduced skill that was last reviewed `daysAgo` days before START and is now due. */
function dueRecord(id: string, daysAgo: number): SkillRecord {
  const reviewedAt = new Date(START.getTime() - daysAgo * DAY);
  const card = reviewCard(undefined, reviewedAt, 'easy').card;
  return { skillId: id, card: { ...card, due: new Date(START.getTime() - 1000).toISOString() }, introducedAt: reviewedAt.toISOString() };
}

/** An introduced skill that is not due for a long time. */
function futureRecord(id: string): SkillRecord {
  const card = reviewCard(undefined, START, 'easy').card;
  return { skillId: id, card, introducedAt: START.toISOString() };
}

interface Setup {
  skills?: SkillDef[];
  records?: SkillRecord[];
  sessionMinutes?: number;
  newPerSession?: number;
  seed?: number;
}

function setup(opts: Setup = {}) {
  const clock = makeClock();
  const skills = opts.skills ?? [fakeSkill('S1'), fakeSkill('S2'), fakeSkill('S3'), fakeSkill('S4')];
  const events: ReviewEvent[] = [];
  const ended: SessionRecord[] = [];
  const session = new Session({
    curriculum: createCurriculum(skills),
    records: new Map((opts.records ?? []).map((r) => [r.skillId, r])),
    settings: { sessionMinutes: opts.sessionMinutes ?? 10, newPerSession: opts.newPerSession ?? 2 },
    now: clock.now,
    seed: opts.seed ?? 1,
    onReview: (e) => events.push(e),
    onEnd: (r) => ended.push(r),
  });
  return { session, clock, events, ended };
}

/** Answer the current question and move on. */
function answer(session: Session, a: Answer) {
  const result = session.submit(a);
  session.advance();
  return result;
}

function current(session: Session) {
  const step = session.step;
  if (step.kind !== 'question') throw new Error(`Expected a question, got ${step.kind}`);
  return step;
}

/** Skill ids of the questions served until the session ends, answering each with `a`. */
function drain(session: Session, a: Answer = RIGHT, limit = 200): string[] {
  const served: string[] = [];
  while (session.step.kind !== 'ended' && served.length < limit) {
    if (session.step.kind === 'explainer') {
      session.advance();
      continue;
    }
    served.push(current(session).skillId);
    answer(session, a);
  }
  return served;
}

describe('due ordering', () => {
  it('serves the lowest retrievability first', () => {
    const recs = [dueRecord('S1', 6), dueRecord('S2', 30), dueRecord('S3', 12)];
    const { session } = setup({ records: recs });
    const order = [current(session).skillId];
    answer(session, RIGHT);
    order.push(current(session).skillId);
    answer(session, RIGHT);
    order.push(current(session).skillId);
    const byRisk = [...recs].sort(
      (a, b) => retrievability(a.card, START) - retrievability(b.card, START),
    );
    expect(order).toEqual(byRisk.map((r) => r.skillId));
    expect(order[0]).toBe('S2');
  });

  it('does not serve skills that are not due', () => {
    const { session } = setup({ records: [dueRecord('S1', 3), futureRecord('S2')], newPerSession: 0 });
    expect(drain(session)).toEqual(['S1']);
  });

  it('labels due questions as reviews', () => {
    const { session } = setup({ records: [dueRecord('S1', 3)] });
    expect(current(session).purpose).toBe('review');
  });

  it('serves each due skill once when all answers are right', () => {
    const { session } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 4), dueRecord('S3', 5)], newPerSession: 0 });
    expect(drain(session).sort()).toEqual(['S1', 'S2', 'S3']);
  });
});

describe('retries', () => {
  const many = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

  it('brings a missed skill back 2 to 4 questions later with a fresh seed', () => {
    const gaps = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const skills = many.map((id) => fakeSkill(id));
      const { session } = setup({ skills, seed, newPerSession: 0, records: many.map((id, i) => dueRecord(id, 10 + i)) });
      const first = current(session);
      const firstSkill = first.skillId;
      const firstSeed = first.question.seed;
      answer(session, WRONG);
      let gap = 0;
      for (let i = 1; i <= 6; i++) {
        const step = current(session);
        if (step.skillId === firstSkill) {
          expect(step.purpose).toBe('retry');
          expect(step.question.seed).not.toBe(firstSeed);
          gap = i; // question number after the miss: 1 is the very next one
          break;
        }
        answer(session, RIGHT);
      }
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(4);
      gaps.add(gap);
    }
    // The offset is random, so over 40 seeds all of 2, 3 and 4 should appear.
    expect([...gaps].sort()).toEqual([2, 3, 4]);
  });

  it('does not retry a right answer', () => {
    const { session } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 4)], newPerSession: 0 });
    expect(drain(session)).toHaveLength(2);
  });

  it('serves the retry straight away when nothing else is queued', () => {
    const { session } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    answer(session, WRONG);
    const step = current(session);
    expect(step.skillId).toBe('S1');
    expect(step.purpose).toBe('retry');
  });

  it('retries a skill that keeps being missed 3 times, then leaves it for the next session', () => {
    const { session, clock, ended } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    const purposes: string[] = [];
    while (session.step.kind === 'question') {
      purposes.push(current(session).purpose);
      clock.advance(MIN);
      answer(session, WRONG);
    }
    expect(purposes).toEqual(['review', 'retry', 'retry', 'retry']);
    expect(ended[0]!.finished).toBe(true);
    // Every attempt still counted for the schedule.
    expect(session.currentRecords().get('S1')!.card.reps).toBe(dueRecord('S1', 3).card.reps + 4);
  });

  it('does not let one failing skill starve the rest of the queue', () => {
    const ids = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    const { session } = setup({
      skills: ids.map((id) => fakeSkill(id)),
      records: ids.map((id, i) => dueRecord(id, 10 + i)),
      newPerSession: 0,
    });
    const served = drain(session, WRONG);
    for (const id of ids) expect(served).toContain(id);
    // Each skill appears once plus at most 3 retries.
    for (const id of ids) expect(served.filter((s) => s === id).length).toBeLessThanOrEqual(4);
  });

  it('updates the schedule on every answer, retries included', () => {
    const { session, events } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    answer(session, WRONG);
    answer(session, RIGHT);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.log.rating)).toEqual([1, 3]);
    expect(events.map((e) => e.log.correct)).toEqual([false, true]);
    expect(events[0]!.record?.card.lapses).toBe(1);
    expect(events[1]!.record?.card.reps).toBeGreaterThan(events[0]!.record!.card.reps);
  });
});

describe('new skills', () => {
  it('are not introduced while a review is due, including overdue ones from earlier days', () => {
    const { session } = setup({ records: [dueRecord('S1', 20)] });
    expect(current(session).purpose).toBe('review');
    answer(session, RIGHT);
    expect(current(session).purpose).toBe('probe');
    expect(current(session).skillId).toBe('S2');
  });

  it('wait for pending retries too', () => {
    const { session } = setup({ records: [dueRecord('S1', 20)] });
    answer(session, WRONG);
    expect(current(session).purpose).toBe('retry');
    answer(session, RIGHT);
    expect(current(session).purpose).toBe('probe');
  });

  it('start straight away on a first run, with the first skill', () => {
    const { session } = setup();
    const step = current(session);
    expect(step.purpose).toBe('probe');
    expect(step.skillId).toBe('S1');
  });

  it('are not introduced with under 2 minutes left', () => {
    const { session, clock } = setup({ records: [dueRecord('S1', 3)], sessionMinutes: 10 });
    clock.advance(8 * MIN + 1);
    answer(session, RIGHT);
    expect(session.step.kind).toBe('ended');
  });

  it('are introduced with exactly 2 minutes left', () => {
    const { session, clock } = setup({ records: [dueRecord('S1', 3)], sessionMinutes: 10 });
    clock.advance(8 * MIN);
    answer(session, RIGHT);
    expect(current(session).purpose).toBe('probe');
  });

  it('stop at the new-skills cap', () => {
    const { session, events } = setup({ newPerSession: 2 });
    // Know both probes for each skill: two skills placed, then the session is done.
    const served = drain(session, RIGHT);
    expect(served).toEqual(['S1', 'S1', 'S2', 'S2']);
    expect(events.filter((e) => e.record).map((e) => e.record!.skillId)).toEqual(['S1', 'S2']);
  });

  it('respect a cap of 1 and of 3', () => {
    expect(drain(setup({ newPerSession: 1 }).session)).toHaveLength(2);
    expect(drain(setup({ newPerSession: 3 }).session)).toHaveLength(6);
  });

  it('follow intro order and skip locked skills', () => {
    const skills = [fakeSkill('S1'), fakeSkill('S2', ['S1']), fakeSkill('S3', ['S2'])];
    const { session } = setup({ skills, newPerSession: 3 });
    expect([...new Set(drain(session))]).toEqual(['S1', 'S2', 'S3']);
  });

  it('never introduce a locked skill', () => {
    // S2 needs S1, and S1 is not introduced because the cap is zero.
    const { session } = setup({ skills: [fakeSkill('S1'), fakeSkill('S2', ['S1'])], newPerSession: 0 });
    expect(session.step.kind).toBe('ended');
  });

  it('place a skill with Easy when both probes are right', () => {
    const { session, events } = setup({ newPerSession: 1 });
    answer(session, RIGHT);
    expect(session.step.kind).toBe('question');
    const result = session.submit(RIGHT);
    expect(result.correct).toBe(true);
    const step = current(session);
    expect(step.placed).toBe(true);
    const placement = events.at(-1)!;
    expect(placement.record?.card.state).toBe(2); // Review
    expect(placement.record?.card.scheduled_days).toBeGreaterThanOrEqual(5);
    expect(placement.log.rating).toBe(4);
    expect(placement.record?.introducedAt).toBe(START.toISOString());
  });

  it('show the explainer then practise when a probe is missed', () => {
    const { session } = setup({ newPerSession: 1 });
    answer(session, RIGHT);
    answer(session, WRONG);
    expect(session.step.kind).toBe('explainer');
    session.advance();
    expect(current(session).purpose).toBe('practice');
  });

  it('show the explainer when the first probe is missed and the second is right', () => {
    const { session } = setup({ newPerSession: 1 });
    answer(session, WRONG);
    answer(session, RIGHT);
    expect(session.step.kind).toBe('explainer');
  });

  it('practise until one is right, and rate the skill Good from that answer', () => {
    const { session, events } = setup({ newPerSession: 1 });
    answer(session, WRONG);
    answer(session, WRONG);
    session.advance(); // explainer
    answer(session, WRONG); // practice 1
    answer(session, RIGHT); // practice 2
    expect(session.step.kind).toBe('ended');
    const finals = events.filter((e) => e.record);
    expect(finals).toHaveLength(1);
    expect(finals[0]!.log.rating).toBe(3);
    expect(finals[0]!.record!.card.state).toBe(1); // Learning
  });

  it('stop practising after 3 questions and rate Again from the last one', () => {
    const { session, events } = setup({ newPerSession: 1 });
    answer(session, WRONG);
    answer(session, WRONG);
    session.advance();
    const practiced: string[] = [];
    while (session.step.kind === 'question') {
      practiced.push(current(session).purpose);
      answer(session, WRONG);
    }
    expect(practiced).toEqual(['practice', 'practice', 'practice']);
    const finals = events.filter((e) => e.record);
    expect(finals).toHaveLength(1);
    expect(finals[0]!.log.rating).toBe(1);
  });

  it('only the last practice answer changes the schedule', () => {
    const { session, events } = setup({ newPerSession: 1 });
    answer(session, WRONG);
    answer(session, WRONG);
    session.advance();
    answer(session, WRONG);
    answer(session, RIGHT);
    expect(events.filter((e) => !e.record).every((e) => e.log.rating === 0)).toBe(true);
    expect(events).toHaveLength(4);
  });

  it('log every probe and practice answer', () => {
    const { session, events } = setup({ newPerSession: 1 });
    answer(session, RIGHT);
    answer(session, WRONG);
    session.advance();
    answer(session, RIGHT);
    expect(events.map((e) => e.log.correct)).toEqual([true, false, true]);
    expect(events.every((e) => e.log.skillId === 'S1')).toBe(true);
  });
});

describe('timer', () => {
  it('lets the current question finish, then ends', () => {
    const { session, clock, ended } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 4)], newPerSession: 0 });
    clock.advance(10 * MIN + 5000);
    // The timer is past zero but the question on screen can still be answered.
    expect(session.remainingMs()).toBe(0);
    expect(session.step.kind).toBe('question');
    const result = session.submit(RIGHT);
    expect(result.correct).toBe(true);
    session.advance();
    expect(session.step.kind).toBe('ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.finished).toBe(true);
  });

  it('does not end before zero', () => {
    const { session, clock } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 4)], newPerSession: 0 });
    clock.advance(10 * MIN - 1);
    answer(session, RIGHT);
    expect(session.step.kind).toBe('question');
  });

  it('reports the time left', () => {
    const { session, clock } = setup({ sessionMinutes: 5 });
    expect(session.remainingMs()).toBe(5 * MIN);
    clock.advance(2 * MIN);
    expect(session.remainingMs()).toBe(3 * MIN);
  });

  it('drops pending retries when time runs out', () => {
    const { session, clock } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    clock.advance(11 * MIN);
    answer(session, WRONG);
    expect(session.step.kind).toBe('ended');
  });

  it('leaves unanswered due skills due', () => {
    const recs = [dueRecord('S1', 30), dueRecord('S2', 20), dueRecord('S3', 10)];
    const { session, clock } = setup({ records: recs, newPerSession: 0 });
    clock.advance(11 * MIN);
    answer(session, RIGHT);
    const left = session.currentRecords();
    expect(left.get('S2')!.card).toEqual(recs[1]!.card);
    expect(left.get('S3')!.card).toEqual(recs[2]!.card);
  });

  it('rates the new skill from the last practice answer if time runs out mid practice', () => {
    const { session, clock, events } = setup({ newPerSession: 1 });
    answer(session, WRONG);
    answer(session, WRONG);
    session.advance();
    clock.advance(11 * MIN);
    answer(session, WRONG);
    expect(session.step.kind).toBe('ended');
    const finals = events.filter((e) => e.record);
    expect(finals).toHaveLength(1);
    expect(finals[0]!.log.rating).toBe(1);
  });

  it('does not record a skill whose probes were cut off', () => {
    const { session, clock, events } = setup({ newPerSession: 1 });
    clock.advance(11 * MIN);
    answer(session, RIGHT);
    expect(session.step.kind).toBe('ended');
    expect(events.filter((e) => e.record)).toHaveLength(0);
  });
});

describe('ending', () => {
  it('ends early and finished when nothing is left', () => {
    const { session, ended } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    answer(session, RIGHT);
    expect(session.step.kind).toBe('ended');
    expect(ended[0]!.finished).toBe(true);
  });

  it('ends at once with nothing due and no new skill allowed', () => {
    const { session, ended } = setup({ records: [futureRecord('S1')], newPerSession: 0 });
    expect(session.step.kind).toBe('ended');
    expect(ended[0]!.answered).toBe(0);
    expect(ended[0]!.finished).toBe(true);
  });

  it('ends when every skill has been introduced and nothing is due', () => {
    const { session } = setup({ skills: [fakeSkill('S1')], records: [futureRecord('S1')] });
    expect(session.step.kind).toBe('ended');
  });

  it('quit ends the session without counting it as finished', () => {
    const { session, ended } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 3)], newPerSession: 0 });
    answer(session, RIGHT);
    session.quit();
    expect(session.step.kind).toBe('ended');
    expect(ended[0]!.finished).toBe(false);
    expect(ended[0]!.answered).toBe(1);
  });

  it('writes one session record with the day key, times and counts', () => {
    const { session, clock, ended } = setup({ records: [dueRecord('S1', 3), dueRecord('S2', 4)], newPerSession: 0 });
    clock.advance(30_000);
    answer(session, RIGHT);
    clock.advance(30_000);
    answer(session, WRONG);
    clock.advance(30_000);
    answer(session, RIGHT); // retry
    expect(ended).toHaveLength(1);
    const rec = ended[0]!;
    expect(rec.startedAt).toBe(START.toISOString());
    expect(rec.endedAt).toBe(new Date(START.getTime() + 90_000).toISOString());
    expect(rec.answered).toBe(3);
    expect(rec.correct).toBe(2);
    expect(rec.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuses answers after the end', () => {
    const { session } = setup({ records: [futureRecord('S1')], newPerSession: 0 });
    expect(() => session.submit(RIGHT)).toThrow();
  });

  it('does not submit twice for one question', () => {
    const { session } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    session.submit(RIGHT);
    expect(() => session.submit(RIGHT)).toThrow();
  });

  it('summarises the session', () => {
    const { session, clock } = setup({
      records: [dueRecord('S1', 3), dueRecord('S2', 5), futureRecord('S3')],
      newPerSession: 0,
    });
    clock.advance(10_000);
    answer(session, RIGHT);
    answer(session, WRONG);
    answer(session, RIGHT);
    const step = session.step;
    if (step.kind !== 'ended') throw new Error('expected ended');
    const s = step.summary;
    expect(s.answered).toBe(3);
    expect(s.correct).toBe(2);
    expect(s.accuracy).toBeCloseTo(2 / 3);
    expect(s.finished).toBe(true);
    expect(s.newSkills).toEqual([]);
    // S3 is due in a week; S1 and S2 were just answered, S2 once wrong then right.
    expect(s.dueTomorrow).toBeGreaterThanOrEqual(0);
    expect(s.dueTomorrow).toBeLessThanOrEqual(3);
  });

  it('names the skills introduced', () => {
    const { session } = setup({ newPerSession: 2 });
    drain(session, RIGHT);
    const step = session.step;
    if (step.kind !== 'ended') throw new Error('expected ended');
    expect(step.summary.newSkills).toEqual(['S1', 'S2']);
  });

  it('has null accuracy with no answers', () => {
    const { session } = setup({ records: [futureRecord('S1')], newPerSession: 0 });
    const step = session.step;
    if (step.kind !== 'ended') throw new Error('expected ended');
    expect(step.summary.accuracy).toBeNull();
  });
});

describe('logging', () => {
  it('records time to answer, seed and practice flag', () => {
    const { session, clock, events } = setup({ records: [dueRecord('S1', 3)], newPerSession: 0 });
    const seed = current(session).question.seed;
    clock.advance(4200);
    answer(session, RIGHT);
    expect(events[0]!.log).toMatchObject({
      skillId: 'S1',
      correct: true,
      rating: 3,
      ms: 4200,
      seed,
      practice: false,
    });
    expect(events[0]!.log.at).toBe(new Date(START.getTime() + 4200).toISOString());
  });
});

describe('determinism', () => {
  it('serves the same questions for the same seed', () => {
    const run = (seed: number) => {
      const recs = [dueRecord('S1', 3), dueRecord('S2', 9), dueRecord('S3', 5)];
      const { session } = setup({ records: recs, seed, newPerSession: 0 });
      const seq: string[] = [];
      for (let i = 0; i < 6 && session.step.kind === 'question'; i++) {
        const s = current(session);
        seq.push(`${s.skillId}:${s.question.seed}`);
        answer(session, i % 2 === 0 ? WRONG : RIGHT);
      }
      return seq;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });
});

describe('PracticeRun', () => {
  it('never changes the schedule and logs practice: true', () => {
    const clock = makeClock();
    const events: ReviewEvent[] = [];
    const run = new PracticeRun({
      skill: fakeSkill('S1'),
      now: clock.now,
      seed: 3,
      onReview: (e) => events.push(e),
    });
    const first = run.question;
    clock.advance(2000);
    const result = run.submit(WRONG);
    expect(result.correct).toBe(false);
    run.next();
    expect(run.question.seed).not.toBe(first.seed);
    run.submit(RIGHT);
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.record).toBeUndefined();
      expect(e.log.practice).toBe(true);
      expect(e.log.rating).toBe(0);
    }
    expect(events[0]!.log.ms).toBe(2000);
    expect(run.stats).toEqual({ answered: 2, correct: 1 });
  });
});
