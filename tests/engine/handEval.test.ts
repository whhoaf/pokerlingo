import { describe, expect, it } from 'vitest';
import { categoryName, compareHands, evaluate, winnerIndexes } from '../../src/engine/handEval';

describe('evaluate', () => {
  it('names the hand categories', () => {
    expect(evaluate(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']).category).toBe(9);
    expect(evaluate(['9s', '9h', '9d', '9c', 'Ks', '2d', '3c']).name).toBe('Four of a Kind');
    expect(evaluate(['9s', '9h', '9d', 'Kc', 'Ks', '2d', '3c']).name).toBe('Full House');
    expect(evaluate(['As', '7s', '4s', 'Js', '2s', '2d', '3c']).name).toBe('Flush');
    expect(evaluate(['5s', '6h', '7d', '8c', '9s', 'Kd', '2c']).name).toBe('Straight');
    expect(evaluate(['5s', '5h', '5d', '8c', '9s', 'Kd', '2c']).name).toBe('Three of a Kind');
    expect(evaluate(['5s', '5h', '8d', '8c', '9s', 'Kd', '2c']).name).toBe('Two Pair');
    expect(evaluate(['5s', '5h', '7d', '8c', '9s', 'Kd', '2c']).name).toBe('Pair');
    expect(evaluate(['4s', '5h', '7d', '8c', 'Js', 'Kd', '2c']).name).toBe('High Card');
  });

  it('treats the wheel as a straight', () => {
    const h = evaluate(['As', '2h', '3d', '4c', '5s', 'Kd', '9c']);
    expect(h.name).toBe('Straight');
  });

  it('returns the five best cards in the engine notation', () => {
    const h = evaluate(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']);
    expect([...h.cards].sort()).toEqual(['As', 'Js', 'Ks', 'Qs', 'Ts']);
    expect(h.cards).toHaveLength(5);
  });

  it('works with five and six cards', () => {
    expect(evaluate(['As', 'Ad', '7c', '8d', '9h']).name).toBe('Pair');
    expect(evaluate(['As', 'Ad', '7c', '8d', '9h', '9c']).name).toBe('Two Pair');
  });

  it('has a plain description', () => {
    expect(evaluate(['As', 'Ad', '7c', '8d', '9h', '2c', '3c']).description).toMatch(/Pair/);
  });
});

describe('compareHands', () => {
  it('ranks by category', () => {
    const flush = ['As', '7s', '4s', 'Js', '2s', '9d', '3c'];
    const straight = ['5s', '6h', '7d', '8c', '9s', 'Kd', '2c'];
    expect(compareHands(flush, straight)).toBe(1);
    expect(compareHands(straight, flush)).toBe(-1);
  });

  it('uses the kicker', () => {
    const board = ['As', '7c', '8d', '2h', '3c'];
    expect(compareHands(['Ad', 'Kd', ...board], ['Ah', 'Qd', ...board])).toBe(1);
  });

  it('ties when the board plays', () => {
    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    expect(compareHands(['2d', '3d', ...board], ['4d', '5d', ...board])).toBe(0);
  });

  it('ties on equal hands with different suits', () => {
    const board = ['2c', '7d', '9h', 'Jc', 'Kd'];
    expect(compareHands(['As', 'Qd', ...board], ['Ah', 'Qc', ...board])).toBe(0);
  });
});

describe('winnerIndexes', () => {
  it('returns every tied winner', () => {
    const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    const hands = [
      ['2d', '3d', ...board],
      ['4d', '5d', ...board],
    ];
    expect(winnerIndexes(hands)).toEqual([0, 1]);
  });

  it('returns the single winner', () => {
    const board = ['2c', '7d', '9h', 'Jc', 'Kd'];
    expect(winnerIndexes([['As', 'Ad', ...board], ['3s', '4s', ...board]])).toEqual([0]);
  });
});

describe('categoryName', () => {
  it('maps 1 to 9', () => {
    expect(categoryName(1)).toBe('High Card');
    expect(categoryName(9)).toBe('Straight Flush');
  });
});
