import { describe, expect, it } from 'vitest';
import { exactEquity, requiredEquity, ruleOf2And4 } from '../../src/engine/odds';
import { straightFlushOuts } from '../../src/engine/outs';
import { B6 } from '../../src/skills/B/B6';
import { B7 } from '../../src/skills/B/B7';
import { B8 } from '../../src/skills/B/B8';
import { B9, B9_MIN_GAP } from '../../src/skills/B/B9';
import { SEEDS, checkGrading, checkQuestionBasics, num, pick } from '../helpers/skillChecks';

describe('B6 rule of 2 and 4', () => {
  it('is valid for 500 seeds', () => {
    const toCome = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B6, seed);
      const { hole = [], board = [] } = q.table;
      const outs = straightFlushOuts(hole, board).length; // pokersolver brute force
      expect(outs).toBeGreaterThanOrEqual(4);

      const cards = board.length === 3 ? 2 : 1;
      toCome.add(cards);
      expect(q.table.note).toBe(cards === 1 ? 'One card to come' : 'Two cards to come. You are all in.');
      const expected = ruleOf2And4(outs, cards);
      expect(expected).toBe(outs * (cards === 1 ? 2 : 4));

      expect(q.input).toEqual({ kind: 'number', unit: '%' });
      // Within 2 points is right, including the edge. Beyond that is wrong.
      checkGrading(
        q,
        [num(expected), num(expected + 2), num(expected - 2), num(expected + 1.5)],
        [num(expected + 2.5), num(expected - 2.5), num(expected + 10), num(outs)],
      );

      const exact = exactEquity(outs, 52 - 2 - board.length, cards);
      const feedback = q.grade(num(expected));
      expect(feedback.working!.join(' ')).toContain(`${exact.toFixed(1)}%`);
      expect(feedback.correctLabel).toBe(`${expected}%`);
    }
    expect([...toCome].sort()).toEqual([1, 2]);
  });

  it('has a worked example that matches the engine', () => {
    const t = B6.explainer.example.table;
    const outs = straightFlushOuts(t.hole!, t.board!).length;
    expect(outs * 4).toBe(36);
    expect(exactEquity(outs, 47, 2).toFixed(1)).toBe('35.0');
  });
});

describe('B7 price of a call', () => {
  it('is valid for 500 seeds', () => {
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B7, seed);
      const { pot, bet } = q.table;
      expect(pot).toBeGreaterThanOrEqual(20);
      expect(pot).toBeLessThanOrEqual(400);
      expect(pot! % 5).toBe(0);
      expect(bet! % 5).toBe(0);
      expect(bet! / pot!).toBeGreaterThanOrEqual(0.2);
      expect(bet! / pot!).toBeLessThanOrEqual(1.6);
      expect(q.prompt).toContain(`pot is ${pot}`);
      expect(q.prompt).toContain(`bets ${bet}`);

      const price = (bet! / (pot! + 2 * bet!)) * 100; // computed independently of odds.ts
      expect(price).toBeCloseTo(requiredEquity(pot!, bet!), 10);

      expect(q.input).toEqual({ kind: 'number', unit: '%' });
      checkGrading(
        q,
        [num(price), num(Math.round(price)), num(price + 1.9), num(price - 1.9)],
        [num(price + 2.2), num(price - 2.2), num(price + 10), num(price * 2)],
      );
      expect(q.grade(num(price)).correctLabel).toBe(`${price.toFixed(1)}%`);
    }
  });

  it('has a worked example that matches the engine', () => {
    expect(requiredEquity(100, 50)).toBe(25);
  });
});

describe('B8 bet size to required equity', () => {
  const EXPECTED: Record<string, string> = { '0.333': 'p20', '0.5': 'p25', '0.667': 'p29', '1': 'p33' };
  const LABELS: Record<string, string> = { p20: '20%', p25: '25%', p29: '29%', p33: '33%' };

  it('is valid for 500 seeds', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B8, seed);
      const { pot, bet } = q.table;
      expect(pot! % 6).toBe(0);
      expect(Number.isInteger(bet)).toBe(true);

      const fraction = (bet! / pot!).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      const key = Object.keys(EXPECTED).find((k) => Math.abs(Number(k) - bet! / pot!) < 0.001);
      expect(key, `bet ${bet} into ${pot} (${fraction}) is not a standard size`).toBeDefined();
      const rightId = EXPECTED[key!]!;
      seen.add(rightId);

      // The labelled percentage is the rounded exact price.
      const price = requiredEquity(pot!, bet!);
      expect(`${Math.round(price)}%`).toBe(LABELS[rightId]);

      expect(q.input.kind).toBe('choice');
      if (q.input.kind === 'choice') {
        expect(q.input.options.map((o) => o.label)).toEqual(['20%', '25%', '29%', '33%']);
      }
      const wrong = Object.keys(LABELS).filter((id) => id !== rightId).map(pick);
      checkGrading(q, [pick(rightId)], wrong);
      expect(q.grade(pick(rightId)).correctLabel).toBe(LABELS[rightId]);
    }
    expect([...seen].sort()).toEqual(['p20', 'p25', 'p29', 'p33']);
  });

  it('has a worked example that matches the engine', () => {
    expect(Math.round(requiredEquity(90, 60))).toBe(29);
  });

  it('needs B7', () => {
    expect(B8.prereqs).toEqual(['B7']);
  });
});

describe('B9 call or fold with a draw', () => {
  it('is valid for 500 seeds', () => {
    let calls = 0;
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B9, seed);
      const { hole = [], board = [], pot, bet } = q.table;
      expect(board).toHaveLength(4); // the turn, one card to come

      const outs = straightFlushOuts(hole, board).length; // pokersolver brute force
      expect(outs).toBeGreaterThanOrEqual(4);
      const equity = (outs / 46) * 100;
      const price = (bet! / (pot! + 2 * bet!)) * 100;
      expect(Math.abs(equity - price)).toBeGreaterThanOrEqual(B9_MIN_GAP);
      expect(equity).toBeCloseTo(exactEquity(outs, 46, 1), 10);

      const call = equity > price;
      if (call) calls++;
      const right = pick(call ? 'call' : 'fold');
      const wrong = pick(call ? 'fold' : 'call');
      checkGrading(q, [right], [wrong]);
      expect(q.grade(right).correctLabel).toBe(call ? 'Call' : 'Fold');
      expect(q.grade(right).working!.join(' ')).toContain(`${outs} outs`);
    }
    // Both answers should come up often.
    expect(calls).toBeGreaterThan(SEEDS.length * 0.3);
    expect(calls).toBeLessThan(SEEDS.length * 0.7);
  });

  it('has a worked example that matches the engine', () => {
    const t = B9.explainer.example.table;
    const outs = straightFlushOuts(t.hole!, t.board!).length;
    expect(outs).toBe(9);
    expect(exactEquity(outs, 46, 1)).toBeLessThan(requiredEquity(t.pot!, t.bet!));
  });

  it('says that implied odds are ignored', () => {
    expect(B9.explainer.body.join(' ')).toMatch(/implied odds/);
  });

  it('needs B6 and B7', () => {
    expect(B9.prereqs).toEqual(['B6', 'B7']);
  });
});
