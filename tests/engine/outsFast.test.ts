import { describe, expect, it } from 'vitest';
import {
  flushCompleters,
  hasStraightRanks,
  quickStraightFlushOuts,
  straightCompleters,
  straightFlushOuts,
} from '../../src/engine/outs';
import { deal } from '../../src/engine/cards';
import { createRng } from '../../src/engine/rng';

describe('fast outs', () => {
  it('detects straights with the ace high or low', () => {
    expect(hasStraightRanks(new Set([10, 11, 12, 13, 14]))).toBe(true);
    expect(hasStraightRanks(new Set([14, 2, 3, 4, 5]))).toBe(true);
    expect(hasStraightRanks(new Set([14, 2, 3, 4, 6]))).toBe(false);
    expect(hasStraightRanks(new Set([12, 13, 14, 2, 3]))).toBe(false);
  });

  it('splits flush and straight completers', () => {
    const hole = ['8h', '9h'];
    const board = ['6h', '7c', 'Kh'];
    expect(flushCompleters(hole, board)).toHaveLength(9);
    expect(straightCompleters(hole, board)).toHaveLength(8);
  });

  it('agrees with the pokersolver brute force on random hands', () => {
    const rng = createRng(2026);
    let nonEmpty = 0;
    for (let i = 0; i < 400; i++) {
      const size = rng.pick([5, 6]);
      const cards = deal(rng, size);
      const hole = cards.slice(0, 2);
      const board = cards.slice(2);
      const slow = [...straightFlushOuts(hole, board)].sort();
      const fast = [...quickStraightFlushOuts(hole, board)].sort();
      expect(fast).toEqual(slow);
      if (slow.length > 0) nonEmpty++;
    }
    // Make sure the comparison was not just empty lists.
    expect(nonEmpty).toBeGreaterThan(40);
  });
});
