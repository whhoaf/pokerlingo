import { describe, expect, it } from 'vitest';
import { rankValue, suitOf } from '../../src/engine/cards';
import { evaluate } from '../../src/engine/handEval';
import { straightFlushOuts, topPairOuts } from '../../src/engine/outs';
import { quickStraightFlushOuts } from '../../src/engine/outs';
import { B1 } from '../../src/skills/B/B1';
import { B2 } from '../../src/skills/B/B2';
import { B3 } from '../../src/skills/B/B3';
import { B4 } from '../../src/skills/B/B4';
import { B5 } from '../../src/skills/B/B5';
import { SEEDS, checkGrading, checkQuestionBasics, num } from '../helpers/skillChecks';

const NAMES_THE_DRAW = /flush draw|straight draw|gutshot|open-ended|combination|overcard/i;

function suitCounts(cards: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(suitOf(c), (m.get(suitOf(c)) ?? 0) + 1);
  return m;
}

describe('B1 flush draw', () => {
  it('is valid for 500 seeds', () => {
    const streets = new Set<number>();
    const shapes = new Set<string>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B1, seed);
      const { hole = [], board = [] } = q.table;
      const outs = straightFlushOuts(hole, board); // pokersolver brute force

      expect(outs).toHaveLength(9);
      const suit = suitOf(outs[0]!);
      expect(outs.every((c) => suitOf(c) === suit)).toBe(true);
      const all = [...hole, ...board];
      expect(suitCounts(all).get(suit)).toBe(4);

      const holeSuited = hole.filter((c) => suitOf(c) === suit).length;
      const boardSuited = board.filter((c) => suitOf(c) === suit).length;
      expect(holeSuited === 2 ? boardSuited === 2 : holeSuited === 1 && boardSuited === 3).toBe(true);
      shapes.add(`${holeSuited}${boardSuited}`);
      streets.add(board.length);

      expect(q.prompt).not.toMatch(NAMES_THE_DRAW);
      expect(q.input).toEqual({ kind: 'number', unit: 'outs' });
      checkGrading(q, [num(9)], [num(8), num(10), num(0)]);
      expect(q.grade(num(9)).correctLabel).toBe('9 outs');
      expect([...(q.grade(num(9)).highlight ?? [])].sort()).toEqual([...outs].sort());
    }
    expect([...streets].sort()).toEqual([3, 4]);
    expect([...shapes].sort()).toEqual(['13', '22']);
  });

  it('has a worked example that matches the brute force', () => {
    const t = B1.explainer.example.table;
    expect(straightFlushOuts(t.hole!, t.board!)).toHaveLength(9);
    expect(B1.explainer.example.answer).toBe('9 outs');
  });
});

describe('B2 open-ended straight draw', () => {
  it('is valid for 500 seeds', () => {
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B2, seed);
      const { hole = [], board = [] } = q.table;
      const outs = straightFlushOuts(hole, board);

      expect(outs, `seed ${seed}: ${hole.join(' ')} | ${board.join(' ')}`).toHaveLength(8);
      const ranks = [...new Set(outs.map(rankValue))].sort((a, b) => a - b);
      expect(ranks).toHaveLength(2);
      expect(ranks[1]! - ranks[0]!).toBe(5); // the two open ends of a run of four
      expect(ranks[0]).toBeGreaterThanOrEqual(2);
      expect(ranks[1]).toBeLessThanOrEqual(14);
      for (const r of ranks) expect(outs.filter((c) => rankValue(c) === r)).toHaveLength(4);

      // The four-run sits between the open ends and uses a hole card.
      const run = [ranks[0]! + 1, ranks[0]! + 2, ranks[0]! + 3, ranks[0]! + 4].filter((r) => r < ranks[1]!);
      expect(run).toHaveLength(4);
      const held = new Set([...hole, ...board].map(rankValue));
      for (const r of run) expect(held.has(r)).toBe(true);
      expect(hole.some((c) => run.includes(rankValue(c)))).toBe(true);

      // No flush draw, no pair.
      expect([...suitCounts([...hole, ...board]).values()].every((n) => n < 4)).toBe(true);
      expect(held.size).toBe(hole.length + board.length);

      expect(q.prompt).not.toMatch(NAMES_THE_DRAW);
      checkGrading(q, [num(8)], [num(7), num(9), num(4)]);
    }
  });

  it('has a worked example that matches the brute force', () => {
    const t = B2.explainer.example.table;
    expect(straightFlushOuts(t.hole!, t.board!)).toHaveLength(8);
  });
});

describe('B3 gutshot', () => {
  it('is valid for 500 seeds', () => {
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B3, seed);
      const { hole = [], board = [] } = q.table;
      const outs = straightFlushOuts(hole, board);

      expect(outs).toHaveLength(4);
      const missing = rankValue(outs[0]!);
      expect(outs.every((c) => rankValue(c) === missing)).toBe(true);

      // Some five-rank window has exactly one rank missing, strictly inside it, and a hole card in it.
      const held = new Set([...hole, ...board].map(rankValue));
      const fits = [];
      for (let w = 2; w <= 10; w++) {
        const inWindow = [w, w + 1, w + 2, w + 3, w + 4];
        const present = inWindow.filter((r) => held.has(r));
        if (
          !held.has(missing) &&
          inWindow.includes(missing) &&
          present.length === 4 &&
          missing > w &&
          missing < w + 4 &&
          hole.some((c) => present.includes(rankValue(c)))
        ) {
          fits.push(w);
        }
      }
      expect(fits.length, `seed ${seed}: ${hole.join(' ')} | ${board.join(' ')}`).toBeGreaterThan(0);

      expect([...suitCounts([...hole, ...board]).values()].every((n) => n < 4)).toBe(true);
      expect(held.size).toBe(hole.length + board.length);
      expect(q.prompt).not.toMatch(NAMES_THE_DRAW);
      checkGrading(q, [num(4)], [num(3), num(5), num(8)]);
    }
  });

  it('has a worked example that matches the brute force', () => {
    const t = B3.explainer.example.table;
    expect(straightFlushOuts(t.hole!, t.board!)).toHaveLength(4);
  });
});

describe('B4 overcards', () => {
  it('is valid for 500 seeds', () => {
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B4, seed);
      const { hole = [], board = [] } = q.table;
      const topBoard = Math.max(...board.map(rankValue));

      expect(hole.every((c) => rankValue(c) > topBoard)).toBe(true);
      expect(new Set(hole.map(rankValue)).size).toBe(2);
      expect(new Set(board.map(rankValue)).size).toBe(board.length); // unpaired board
      expect(evaluate([...hole, ...board]).category).toBe(1); // nothing made yet
      expect(straightFlushOuts(hole, board)).toEqual([]); // no straight or flush draw, by pokersolver
      expect(quickStraightFlushOuts(hole, board)).toEqual([]);

      const outs = topPairOuts(hole, board);
      expect(outs).toHaveLength(6);
      checkGrading(q, [num(6)], [num(5), num(7), num(9)]);
      expect([...(q.grade(num(6)).highlight ?? [])].sort()).toEqual([...outs].sort());
    }
  });

  it('has a worked example that matches the brute force', () => {
    const t = B4.explainer.example.table;
    expect(topPairOuts(t.hole!, t.board!)).toHaveLength(6);
    expect(straightFlushOuts(t.hole!, t.board!)).toEqual([]);
  });
});

describe('B5 combination draws', () => {
  it('is valid for 500 seeds', () => {
    const totals = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(B5, seed);
      const { hole = [], board = [] } = q.table;
      const all = [...hole, ...board];
      const outs = straightFlushOuts(hole, board);
      totals.add(outs.length);

      expect([12, 15]).toContain(outs.length);
      const counts = suitCounts(all);
      const suit = [...counts.entries()].find(([, n]) => n === 4)![0];
      expect(hole.some((c) => suitOf(c) === suit)).toBe(true);

      // 9 cards of the suit, plus the straight cards of other suits.
      const suited = outs.filter((c) => suitOf(c) === suit);
      const others = outs.filter((c) => suitOf(c) !== suit);
      expect(suited).toHaveLength(9);
      expect(others).toHaveLength(outs.length === 15 ? 6 : 3);
      const otherRanks = new Set(others.map(rankValue));
      expect(otherRanks.size).toBe(outs.length === 15 ? 2 : 1);

      expect(q.prompt).not.toMatch(NAMES_THE_DRAW);
      checkGrading(q, [num(outs.length)], [num(outs.length - 1), num(outs.length + 1), num(17), num(13)]);
      const feedback = q.grade(num(outs.length));
      expect(feedback.working!.join(' ')).toContain(`= ${outs.length} outs`);
    }
    expect([...totals].sort()).toEqual([12, 15]);
  });

  it('has a worked example that matches the brute force', () => {
    const t = B5.explainer.example.table;
    expect(straightFlushOuts(t.hole!, t.board!)).toHaveLength(15);
  });

  it('needs B1, B2 and B3', () => {
    expect(B5.prereqs).toEqual(['B1', 'B2', 'B3']);
  });
});
