import { describe, expect, it } from 'vitest';
import { correctChoiceIds } from '../../src/app/choices';
import { gridLabel } from '../../src/app/components/RangeGrid';
import { revealFocus, ringLabel, seatPosition } from '../../src/app/components/SeatRing';
import { spotRing } from '../../src/skills/A/common';
import { HAND_CLASSES } from '../../src/engine/ranges';
import type { GradeResult, Question, RangeGridView, SeatRing } from '../../src/engine/types';
import { DASHES } from '../helpers/dashes';

function choiceQuestion(labels: [string, string][]): Question {
  return {
    skillId: 'X1',
    seed: 1,
    prompt: 'Q',
    table: {},
    input: { kind: 'choice', options: labels.map(([id, label]) => ({ id, label })) },
    grade: () => ({ correct: true, correctLabel: '', reason: '' }),
  };
}

const result = (extra: Partial<GradeResult>): GradeResult => ({ correct: true, correctLabel: 'Raise', reason: 'Because.', ...extra });

describe('correctChoiceIds', () => {
  const q = choiceQuestion([
    ['raise', 'Raise'],
    ['fold', 'Fold'],
  ]);

  it('uses the ids a skill names', () => {
    expect(correctChoiceIds(q, result({ correctIds: ['raise', 'fold'], correctLabel: 'Raise or fold' }))).toEqual(['raise', 'fold']);
  });

  it('falls back to the button whose label is the answer', () => {
    expect(correctChoiceIds(q, result({}))).toEqual(['raise']);
    expect(correctChoiceIds(q, result({ correctLabel: 'Nothing like it' }))).toBeUndefined();
  });

  it('says nothing before an answer or for a number question', () => {
    expect(correctChoiceIds(q, null)).toBeUndefined();
    expect(correctChoiceIds({ ...q, input: { kind: 'number', unit: 'chips' } }, result({}))).toBeUndefined();
  });
});

describe('the table picture', () => {
  it('puts the first seat at the bottom and goes clockwise', () => {
    const bottom = seatPosition(0, 8);
    expect(bottom.left).toBeCloseTo(50, 5);
    expect(bottom.top).toBeGreaterThan(70);
    // The next seat is to the left of the bottom one, and halfway round it is at the top.
    expect(seatPosition(1, 8).left).toBeLessThan(50);
    expect(seatPosition(1, 8).top).toBeLessThan(bottom.top);
    expect(seatPosition(4, 8).top).toBeLessThan(20);
    expect(seatPosition(7, 8).left).toBeGreaterThan(50);
  });

  it('keeps every seat of every table size inside the picture and apart from the others', () => {
    for (let n = 6; n <= 9; n++) {
      const spots = Array.from({ length: n }, (_, k) => seatPosition(k, n));
      for (const s of spots) {
        expect(s.left).toBeGreaterThan(5);
        expect(s.left).toBeLessThan(95);
        expect(s.top).toBeGreaterThan(5);
        expect(s.top).toBeLessThan(85);
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          // 338 by 236 px picture: seats are at least a pill apart in one direction.
          const dx = Math.abs(spots[i]!.left - spots[j]!.left) * 3.38;
          const dy = Math.abs(spots[i]!.top - spots[j]!.top) * 2.36;
          expect(dx > 60 || dy > 36, `${n} players, seats ${i} and ${j}`).toBe(true);
        }
      }
    }
  });

  it('describes the table in words for a screen reader', () => {
    const ring: SeatRing = {
      focus: 2,
      seats: [
        { name: 'UTG', role: 'limp', tag: 'Limp' },
        { name: 'HJ', role: 'fold' },
        { name: 'CO', role: 'you', tag: 'You' },
        { name: 'BTN', button: true },
        { name: 'SB' },
        { name: 'BB' },
      ],
    };
    const text = ringLabel(ring);
    expect(text).toContain('Table of 6 players.');
    expect(text).toContain('The dealer button is on BTN.');
    expect(text).toContain('UTG: limped.');
    expect(text).toContain('CO: you.');
    expect(text).not.toContain('HJ');
    expect(text).not.toMatch(DASHES);
  });

  it('names the highlighted seat once the answer is checked, and changes nothing else', () => {
    const ring: SeatRing = { focus: 1, seats: [{ name: null }, { name: null, role: 'focus' }, { name: null, button: true }, { name: null }, { name: null }, { name: null }] };
    const shown = revealFocus(ring, 'HJ');
    expect(shown.seats[1]).toEqual({ name: 'HJ', role: 'focus' });
    expect(shown.seats.filter((s) => s.name !== null)).toHaveLength(1);
    expect(shown.focus).toBe(1);
    expect(ring.seats[1]!.name).toBeNull(); // the question itself is untouched
    expect(ringLabel(shown)).toContain('HJ: highlighted.');
    // A seat that already has a name keeps it.
    const named: SeatRing = { focus: 0, seats: [{ name: 'CO', role: 'you' }, { name: 'BTN', button: true }] };
    expect(revealFocus(named, 'BB')).toEqual(named);
  });

  it('shows the raise size in chips on the raiser, when the question has one', () => {
    const spot = { players: 6, hero: 'BTN', limpers: [], raiser: 'CO' };
    const withSize = spotRing({ ...spot, raiseTo: 8 }).seats.find((s) => s.role === 'raise');
    expect(withSize).toMatchObject({ name: 'CO', tag: '8 chips' });
    expect(ringLabel(spotRing({ ...spot, raiseTo: 8 }))).toContain('CO: raised to 8 chips.');
    expect(ringLabel(spotRing(spot))).toContain('CO: raised.');
    const without = spotRing(spot).seats.find((s) => s.role === 'raise');
    expect(without).toMatchObject({ name: 'CO', tag: 'Raise' });
  });

  it('does not name a hidden seat', () => {
    const ring: SeatRing = { focus: 0, seats: [{ name: null, role: 'focus' }, { name: null }, { name: null, button: true }, { name: null }, { name: null }, { name: null }] };
    const text = ringLabel(ring);
    expect(text).toContain('The dealer button is on seat 3.');
    expect(text).toContain('One seat: highlighted.');
  });
});

describe('the chart picture', () => {
  const cells: RangeGridView['cells'] = {};
  for (const c of HAND_CLASSES) cells[c] = { action: 'fold', borderline: false };
  cells['AKs'] = { action: 'raise', borderline: false };
  cells['77'] = { action: 'raise', borderline: true };
  const grid: RangeGridView = {
    title: 'Folded to you',
    cells,
    legend: [
      { action: 'raise', label: 'Raise' },
      { action: 'fold', label: 'Fold' },
    ],
    yours: 'AKs',
  };

  it('says what the chart says about your hand', () => {
    expect(gridLabel(grid)).toBe('Chart: Folded to you. Your hand AKs: Raise.');
    expect(gridLabel({ ...grid, yours: '77' })).toBe('Chart: Folded to you. Your hand 77: Raise, a borderline hand.');
    expect(gridLabel({ ...grid, yours: undefined })).toBe('Chart: Folded to you.');
  });
});
