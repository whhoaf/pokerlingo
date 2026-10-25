import { describe, expect, it } from 'vitest';
import { deal } from '../../src/engine/cards';
import { compareHands, evaluate } from '../../src/engine/handEval';
import { allHoldings, boardThreats, nutsOf, quickThreats, strengthTiers } from '../../src/engine/nuts';
import { createRng } from '../../src/engine/rng';

describe('allHoldings', () => {
  it('lists every two-card holding left in the deck', () => {
    expect(allHoldings(['As', 'Ks', 'Qs', 'Js', '2d'])).toHaveLength(1081);
    expect(allHoldings(['As', 'Ks', 'Qs', 'Js'])).toHaveLength(1128);
    expect(allHoldings(['As', 'Ks', 'Qs'])).toHaveLength(1176);
  });

  it('never uses a board card and never repeats a holding', () => {
    const board = ['As', 'Ks', 'Qs', 'Js', '2d'];
    const seen = new Set<string>();
    for (const [a, b] of allHoldings(board)) {
      expect(board).not.toContain(a);
      expect(board).not.toContain(b);
      expect(a).not.toBe(b);
      const key = [a, b].sort().join('');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('nutsOf', () => {
  it('finds the royal flush draw on three spades', () => {
    const nuts = nutsOf(['As', 'Ks', 'Qs']);
    expect(nuts.holdings.map((h) => [...h].sort())).toEqual([['Js', 'Ts']]);
    expect(nuts.hand.name).toBe('Straight Flush');
  });

  it('finds the straight flush on a connected suited board', () => {
    const nuts = nutsOf(['9s', '8s', '7s']);
    expect(nuts.holdings.map((h) => [...h].sort())).toEqual([['Js', 'Ts']]);
  });

  it('finds four of a kind with the best kicker on a trips board', () => {
    const nuts = nutsOf(['2c', '2d', '2h']);
    expect(nuts.hand.name).toBe('Four of a Kind');
    expect(nuts.holdings).toHaveLength(4);
    for (const h of nuts.holdings) {
      expect(h).toContain('2s');
      expect(h.some((c) => c[0] === 'A')).toBe(true);
    }
  });

  it('finds a set on a dry board', () => {
    const nuts = nutsOf(['Kd', '7h', '2c', '9s', '4d']);
    expect(nuts.hand.name).toBe('Three of a Kind');
    // Three kings are left, so three pairs of kings tie.
    expect(nuts.holdings).toHaveLength(3);
    for (const h of nuts.holdings) expect(h.map((c) => c[0])).toEqual(['K', 'K']);
  });

  it('finds the nut flush with the ace', () => {
    const nuts = nutsOf(['Kh', '9h', '5h', '2c', '3d']);
    expect(nuts.hand.name).toBe('Flush');
    for (const h of nuts.holdings) expect(h).toContain('Ah');
  });

  it('puts every holding in one tier when the board plays', () => {
    const tiers = strengthTiers(['As', 'Ks', 'Qs', 'Js', 'Ts']);
    expect(tiers).toHaveLength(1);
    expect(tiers[0]?.holdings).toHaveLength(1081);
  });

  it('rejects boards that are not 3 to 5 cards', () => {
    expect(() => nutsOf(['As', 'Ks'])).toThrow();
    expect(() => nutsOf(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d'])).toThrow();
  });
});

describe('strengthTiers', () => {
  it('orders tiers from strongest to weakest and groups only exact ties', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const board = deal(createRng(seed), 3 + (seed % 3));
      const tiers = strengthTiers(board);
      let total = 0;
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i]!;
        total += tier.holdings.length;
        const first = [...board, ...tier.holdings[0]!];
        for (const h of tier.holdings) expect(compareHands([...board, ...h], first)).toBe(0);
        if (i > 0) expect(compareHands(first, [...board, ...tiers[i - 1]!.holdings[0]!])).toBe(-1);
        expect(tier.hand.cards).toEqual(evaluate(first).cards);
      }
      expect(total).toBe(allHoldings(board).length);
    }
  });

  it('agrees with a plain scan: no holding beats the nuts', () => {
    const board = ['Qd', 'Qh', '8s', '8c', '3d'];
    const nuts = nutsOf(board);
    const best = [...board, ...nuts.holdings[0]!];
    for (const h of allHoldings(board)) expect(compareHands(best, [...board, ...h])).toBeGreaterThanOrEqual(0);
  });
});

describe('boardThreats', () => {
  it('counts the holdings that make a flush or a straight', () => {
    const t = boardThreats(['As', 'Ks', 'Qs']);
    expect(t.flush).toHaveLength(45); // two of the ten spades left
    expect(t.straight).toHaveLength(16); // a jack and a ten
  });

  it('finds the wheel', () => {
    const t = boardThreats(['As', '2d', '3h']);
    expect(t.straight.some((h) => h.map((c) => c[0]).sort().join('') === '45')).toBe(true);
    expect(t.flush).toHaveLength(0);
  });

  it('finds nothing on a dry rainbow board', () => {
    const t = boardThreats(['Kd', '7h', '2c', '9s', '4d']);
    expect(t.flush).toHaveLength(0);
    expect(t.straight).toHaveLength(0);
  });

  it('is matched by the quick board-only check on 300 random boards', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const board = deal(createRng(seed * 7), 3 + (seed % 3));
      const t = boardThreats(board);
      const q = quickThreats(board);
      expect(q, board.join(' ')).toEqual({ flush: t.flush.length > 0, straight: t.straight.length > 0 });
    }
  });
});
