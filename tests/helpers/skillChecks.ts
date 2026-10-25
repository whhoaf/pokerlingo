import { expect } from 'vitest';
import { hasDuplicates, parseCard } from '../../src/engine/cards';
import type { Answer, Question, SkillDef } from '../../src/engine/types';
import { DASHES } from './dashes';

export const SEED_COUNT = 500;
export const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i + 1);


export function noDashes(text: string): void {
  expect(text, `dash found in: ${text}`).not.toMatch(DASHES);
}

export function allCards(q: Question): string[] {
  const t = q.table;
  return [...(t.hole ?? []), ...(t.board ?? []), ...(t.villain ?? [])];
}

/** Checks that hold for every question of every skill. */
export function checkQuestionBasics(skill: SkillDef, seed: number): Question {
  const q = skill.generate(seed);
  expect(q.skillId).toBe(skill.id);
  expect(q.seed).toBe(seed);

  const cards = allCards(q);
  for (const c of cards) parseCard(c); // throws on a bad card
  expect(hasDuplicates(cards), `duplicate cards for seed ${seed}: ${cards.join(' ')}`).toBe(false);
  expect([0, 3, 4, 5]).toContain((q.table.board ?? []).length);
  if (q.table.hole) expect(q.table.hole).toHaveLength(2);

  expect(q.prompt.length).toBeGreaterThan(0);
  noDashes(q.prompt);
  if (q.table.note) noDashes(q.table.note);

  // Fully determined by skill id and seed.
  const again = skill.generate(seed);
  expect(again.prompt).toBe(q.prompt);
  expect(again.table).toEqual(q.table);
  expect(again.input).toEqual(q.input);
  return q;
}

/** A right answer is correct, a wrong one is not, and the wrong kind of answer is not. */
export function checkGrading(q: Question, right: Answer[], wrong: Answer[]): void {
  for (const a of right) {
    const r = q.grade(a);
    expect(r.correct, `seed ${q.seed}: ${JSON.stringify(a)} should be right`).toBe(true);
    expectGoodFeedback(r);
  }
  for (const a of wrong) {
    const r = q.grade(a);
    expect(r.correct, `seed ${q.seed}: ${JSON.stringify(a)} should be wrong`).toBe(false);
    expectGoodFeedback(r);
  }
  const mismatched: Answer =
    q.input.kind === 'number' ? { kind: 'choice', id: 'right' } : { kind: 'number', value: 1 };
  expect(q.grade(mismatched).correct).toBe(false);
  if (q.input.kind === 'number') {
    expect(q.grade({ kind: 'number', value: Number.NaN }).correct).toBe(false);
  }
}

function expectGoodFeedback(r: ReturnType<Question['grade']>): void {
  expect(r.correctLabel.length).toBeGreaterThan(0);
  expect(r.reason.length).toBeGreaterThan(0);
  noDashes(r.correctLabel);
  noDashes(r.reason);
  for (const line of r.working ?? []) noDashes(line);
  if (r.highlight) expect(hasDuplicates(r.highlight)).toBe(false);
}

export const num = (value: number): Answer => ({ kind: 'number', value });
export const pick = (id: string): Answer => ({ kind: 'choice', id });
