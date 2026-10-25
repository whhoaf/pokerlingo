import { describe, expect, it } from 'vitest';
import { D1, d1Tolerance } from '../../src/skills/D/D1';
import { SEEDS, checkGrading, checkQuestionBasics, num } from '../helpers/skillChecks';

// Written out here so the test does not borrow the skill's own table.
const FRACTIONS: Record<string, number> = {
  'a third of the pot': 1 / 3,
  'half the pot': 1 / 2,
  'two thirds of the pot': 2 / 3,
  'three quarters of the pot': 3 / 4,
  'the whole pot': 1,
};

describe('D1 turn a pot fraction into chips', () => {
  it('is valid for 500 seeds', () => {
    const fractionsSeen = new Set<string>();
    let smallest = Infinity;
    let largest = 0;
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(D1, seed);
      const pot = q.table.pot!;
      expect(q.table.hole).toBeUndefined();
      expect(q.table.board ?? []).toHaveLength(0);
      expect(pot).toBeGreaterThanOrEqual(20);
      expect(pot).toBeLessThanOrEqual(600);
      expect(pot % 5).toBe(0);
      smallest = Math.min(smallest, pot);
      largest = Math.max(largest, pot);
      expect(q.prompt).toContain(`The pot is ${pot}.`);
      expect(q.input).toEqual({ kind: 'number', unit: 'chips' });

      const words = Object.keys(FRACTIONS).filter((w) => q.prompt.includes(`bet of ${w}`));
      expect(words, q.prompt).toHaveLength(1);
      fractionsSeen.add(words[0]!);
      const exact = pot * FRACTIONS[words[0]!]!;

      // Right within 5 chips or 5%, whichever is larger, edges included.
      const tolerance = Math.max(5, exact * 0.05);
      expect(d1Tolerance(exact)).toBeCloseTo(tolerance, 10);
      checkGrading(
        q,
        [
          num(exact),
          num(Math.round(exact)),
          num(exact + tolerance),
          num(exact - tolerance),
          num(exact + tolerance * 0.9),
        ],
        [num(exact + tolerance + 0.5), num(exact - tolerance - 0.5), num(exact * 2), num(0), num(exact + 100)],
      );

      const r = q.grade(num(exact));
      expect(r.correctLabel).toBe(`${Number.isInteger(exact) ? exact : (Math.round(exact * 10) / 10).toFixed(1)} chips`);
    }
    expect([...fractionsSeen].sort()).toEqual(Object.keys(FRACTIONS).sort());
    expect(smallest).toBeLessThanOrEqual(30);
    expect(largest).toBeGreaterThanOrEqual(580);
  });

  it('uses 5 chips for small answers and 5% for large ones', () => {
    expect(d1Tolerance(6.67)).toBe(5);
    expect(d1Tolerance(100)).toBe(5);
    expect(d1Tolerance(300)).toBe(15);
    expect(d1Tolerance(600)).toBe(30);
  });

  it('has a worked example that is right', () => {
    const ex = D1.explainer.example;
    expect(ex.table.pot).toBe(150);
    expect(ex.prompt).toContain('two thirds of the pot');
    expect((150 * 2) / 3).toBe(100);
    expect(ex.answer).toBe('100 chips');
    expect(d1Tolerance(100)).toBe(5);
    expect(ex.working).toEqual(['150 / 3 = 50', '50 x 2 = 100', 'Within 5 chips counts as right']);
    // The explainer's pot of 120 sums.
    const body = D1.explainer.body.join(' ');
    expect(body).toContain('a third is 40, half is 60, two thirds is 80 and three quarters is 90');
    expect([120 / 3, 120 / 2, (120 * 2) / 3, (120 * 3) / 4]).toEqual([40, 60, 80, 90]);
  });

  it('has no prerequisites', () => {
    expect(D1.prereqs).toEqual([]);
    expect(D1.area).toBe('D');
  });
});
