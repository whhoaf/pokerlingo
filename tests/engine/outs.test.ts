import { describe, expect, it } from 'vitest';
import {
  findOuts,
  hasMadeStraightOrFlush,
  straightFlushOuts,
  topPairOuts,
  unseenCards,
} from '../../src/engine/outs';
import { evaluate } from '../../src/engine/handEval';

describe('unseenCards', () => {
  it('removes the known cards', () => {
    const u = unseenCards(['As', 'Kd', '2c']);
    expect(u).toHaveLength(49);
    expect(u).not.toContain('As');
  });

  it('rejects duplicate known cards', () => {
    expect(() => unseenCards(['As', 'As'])).toThrow();
  });
});

describe('straightFlushOuts', () => {
  it('counts 9 outs for a flush draw', () => {
    expect(straightFlushOuts(['Ah', '5h'], ['Kh', '9h', '2c'])).toHaveLength(9);
  });

  it('counts 9 outs for a flush draw with one hole card and three on the board', () => {
    expect(straightFlushOuts(['Ah', '5c'], ['Kh', '9h', '2h'])).toHaveLength(9);
  });

  it('counts 8 outs for an open-ended straight draw', () => {
    expect(straightFlushOuts(['8s', '9d'], ['6c', '7h', 'Kd'])).toHaveLength(8);
  });

  it('counts 4 outs for a gutshot', () => {
    const outs = straightFlushOuts(['8s', '9d'], ['5c', '7h', 'Kd']);
    expect(outs).toHaveLength(4);
    expect(outs.every((c) => c[0] === '6')).toBe(true);
  });

  it('counts 15 outs for a flush draw plus an open-ended straight draw', () => {
    expect(straightFlushOuts(['8h', '9h'], ['6h', '7c', 'Kh'])).toHaveLength(15);
  });

  it('counts 12 outs for a flush draw plus a gutshot', () => {
    expect(straightFlushOuts(['8h', '9h'], ['5h', '7c', 'Kh'])).toHaveLength(12);
  });

  it('counts overlapping cards once', () => {
    const outs = straightFlushOuts(['8h', '9h'], ['6h', '7c', 'Kh']);
    expect(new Set(outs).size).toBe(outs.length);
  });

  it('works on the turn, with one card to come', () => {
    expect(straightFlushOuts(['Ah', '5h'], ['Kh', '9h', '2c', 'Td'])).toHaveLength(9);
  });

  it('returns nothing when you already have a straight or flush', () => {
    expect(straightFlushOuts(['Ah', '5h'], ['Kh', '9h', '2h'])).toEqual([]);
    expect(straightFlushOuts(['8s', '9d'], ['5c', '6h', '7d'])).toEqual([]);
  });

  it('returns nothing with no draw', () => {
    expect(straightFlushOuts(['As', '2d'], ['9c', 'Th', '4d'])).toEqual([]);
  });

  it('every out really makes a straight or flush', () => {
    const hole = ['8h', '9h'];
    const board = ['6h', '7c', 'Kh'];
    for (const c of straightFlushOuts(hole, board)) {
      expect([5, 6, 9]).toContain(evaluate([...hole, ...board, c]).category);
    }
  });
});

describe('hasMadeStraightOrFlush', () => {
  it('detects made hands', () => {
    expect(hasMadeStraightOrFlush(['Ah', '5h', 'Kh', '9h', '2h'])).toBe(true);
    expect(hasMadeStraightOrFlush(['8s', '9d', '5c', '6h', '7d'])).toBe(true);
    expect(hasMadeStraightOrFlush(['8s', '9d', '5c', '6h', 'Kd'])).toBe(false);
  });
});

describe('topPairOuts', () => {
  it('counts 6 outs for two overcards', () => {
    expect(topPairOuts(['As', 'Kd'], ['9c', '5h', '2d'])).toHaveLength(6);
  });

  it('counts only cards that pair a hole card', () => {
    const outs = topPairOuts(['As', 'Kd'], ['9c', '5h', '2d']);
    expect(outs.every((c) => c[0] === 'A' || c[0] === 'K')).toBe(true);
  });
});

describe('findOuts', () => {
  it('accepts any predicate', () => {
    const outs = findOuts(['As', 'Kd'], ['9c', '5h', '2d'], (card) => card[0] === 'Q');
    expect(outs).toHaveLength(4);
  });
});
