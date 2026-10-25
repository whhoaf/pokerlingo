import { describe, expect, it } from 'vitest';
import { exactEquity, requiredEquity, ruleOf2And4 } from '../../src/engine/odds';

describe('requiredEquity', () => {
  it('gives 20% for a third-pot bet', () => {
    expect(requiredEquity(90, 30)).toBeCloseTo(20, 10);
  });

  it('gives 25% for a half-pot bet', () => {
    expect(requiredEquity(100, 50)).toBeCloseTo(25, 10);
  });

  it('gives 28.6% for a two-thirds pot bet', () => {
    expect(requiredEquity(90, 60)).toBeCloseTo(28.571, 2);
  });

  it('gives 33.3% for a pot-sized bet', () => {
    expect(requiredEquity(100, 100)).toBeCloseTo(33.333, 2);
  });

  it('uses the pot before the bet', () => {
    // Pot of 40, villain bets 20: you call 20 to win 60, so you need 20 / 80.
    expect(requiredEquity(40, 20)).toBeCloseTo(25, 10);
  });

  it('rejects a bet of zero or less', () => {
    expect(() => requiredEquity(100, 0)).toThrow();
    expect(() => requiredEquity(-1, 10)).toThrow();
  });
});

describe('ruleOf2And4', () => {
  it('doubles for one card to come', () => {
    expect(ruleOf2And4(9, 1)).toBe(18);
  });

  it('quadruples for two cards to come', () => {
    expect(ruleOf2And4(9, 2)).toBe(36);
    expect(ruleOf2And4(15, 2)).toBe(60);
  });
});

describe('exactEquity', () => {
  it('is outs over unseen cards with one card to come', () => {
    expect(exactEquity(9, 46, 1)).toBeCloseTo((9 / 46) * 100, 10);
  });

  it('adds the second card correctly with two to come', () => {
    // 1 - (38 choose 2) / (47 choose 2) = 1 - 703 / 1081
    expect(exactEquity(9, 47, 2)).toBeCloseTo((1 - 703 / 1081) * 100, 10);
    expect(exactEquity(9, 47, 2)).toBeCloseTo(34.97, 1);
  });

  it('handles no outs and all outs', () => {
    expect(exactEquity(0, 47, 2)).toBe(0);
    expect(exactEquity(47, 47, 1)).toBe(100);
  });

  it('is always below the rule of 4 for big draws and close for small ones', () => {
    expect(exactEquity(15, 47, 2)).toBeLessThan(ruleOf2And4(15, 2));
    expect(Math.abs(exactEquity(4, 47, 2) - ruleOf2And4(4, 2))).toBeLessThan(2);
  });

  it('rejects impossible inputs', () => {
    expect(() => exactEquity(10, 5, 1)).toThrow();
    expect(() => exactEquity(-1, 47, 1)).toThrow();
  });
});
