import { describe, expect, it } from 'vitest';
import { hasDuplicates, suitOf } from '../../src/engine/cards';
import { evaluate } from '../../src/engine/handEval';
import { quickStraightFlushOuts, straightFlushOuts } from '../../src/engine/outs';
import { createRng } from '../../src/engine/rng';
import { dealDraw, type DrawKind, type Street } from '../../src/skills/B/draws';

const EXPECTED: Record<DrawKind, number> = {
  flush: 9,
  oesd: 8,
  gutshot: 4,
  'combo-oesd': 15,
  'combo-gutshot': 12,
};

describe('dealDraw', () => {
  for (const kind of Object.keys(EXPECTED) as DrawKind[]) {
    for (const street of ['flop', 'turn'] as Street[]) {
      it(`deals a valid ${kind} on the ${street}`, () => {
        const rng = createRng(kind.length * 1000 + (street === 'flop' ? 1 : 2));
        for (let i = 0; i < 100; i++) {
          const draw = dealDraw(rng, kind, street);
          const all = [...draw.hole, ...draw.board];
          expect(draw.hole).toHaveLength(2);
          expect(draw.board).toHaveLength(street === 'flop' ? 3 : 4);
          expect(hasDuplicates(all)).toBe(false);

          // The hand is a plain high card now, so every out is a real improvement.
          expect(evaluate(all).category, all.join(' ')).toBe(1);

          // Outs are the pokersolver brute force, and the fast check agrees.
          expect(straightFlushOuts(draw.hole, draw.board).sort()).toEqual([...draw.outs].sort());
          expect(quickStraightFlushOuts(draw.hole, draw.board).sort()).toEqual([...draw.outs].sort());
          expect(draw.outs).toHaveLength(EXPECTED[kind]);

          if (draw.flushSuit) {
            expect(all.filter((c) => suitOf(c) === draw.flushSuit)).toHaveLength(4);
            expect(draw.hole.some((c) => suitOf(c) === draw.flushSuit)).toBe(true);
          }
        }
      });
    }
  }
});
