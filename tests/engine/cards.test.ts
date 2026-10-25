import { describe, expect, it } from 'vitest';
import {
  RANKS,
  SUITS,
  deal,
  formatCard,
  fullDeck,
  hasDuplicates,
  isRed,
  parseCard,
  rankOf,
  rankValue,
  sortByRank,
  suitOf,
  suitSymbol,
} from '../../src/engine/cards';
import { createRng } from '../../src/engine/rng';

describe('deck', () => {
  it('has 52 unique cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('uses the pokersolver notation', () => {
    expect(RANKS).toBe('23456789TJQKA');
    expect(SUITS).toBe('shdc');
    for (const c of fullDeck()) expect(c).toMatch(/^[2-9TJQKA][shdc]$/);
  });
});

describe('parse and format', () => {
  it('parses a card', () => {
    expect(parseCard('Td')).toEqual({ rank: 'T', suit: 'd' });
    expect(rankOf('9h')).toBe('9');
    expect(suitOf('9h')).toBe('h');
  });

  it('rejects bad cards', () => {
    expect(() => parseCard('1s')).toThrow();
    expect(() => parseCard('Ax')).toThrow();
    expect(() => parseCard('Asd')).toThrow();
  });

  it('gives rank values 2 to 14', () => {
    expect(rankValue('2c')).toBe(2);
    expect(rankValue('Tc')).toBe(10);
    expect(rankValue('Ac')).toBe(14);
  });

  it('formats for the screen with a suit symbol and a colour', () => {
    expect(formatCard('Ts')).toEqual({ rank: '10', symbol: '♠', red: false });
    expect(formatCard('Kh')).toEqual({ rank: 'K', symbol: '♥', red: true });
    expect(suitSymbol('d')).toBe('♦');
    expect(suitSymbol('c')).toBe('♣');
    expect(isRed('d')).toBe(true);
    expect(isRed('c')).toBe(false);
  });
});

describe('deal', () => {
  it('deals unique cards and avoids excluded ones', () => {
    const rng = createRng(1);
    const exclude = ['As', 'Kh'];
    const cards = deal(rng, 7, exclude);
    expect(cards).toHaveLength(7);
    expect(hasDuplicates(cards)).toBe(false);
    for (const c of cards) expect(exclude).not.toContain(c);
  });

  it('is deterministic for a seed', () => {
    expect(deal(createRng(8), 5)).toEqual(deal(createRng(8), 5));
  });

  it('throws if asked for more cards than remain', () => {
    expect(() => deal(createRng(1), 53)).toThrow();
  });
});

describe('helpers', () => {
  it('detects duplicates', () => {
    expect(hasDuplicates(['As', 'Ks', 'As'])).toBe(true);
    expect(hasDuplicates(['As', 'Ks', 'Ah'])).toBe(false);
  });

  it('sorts high to low without changing the input', () => {
    const input = ['2c', 'Ah', 'Td'];
    expect(sortByRank(input)).toEqual(['Ah', 'Td', '2c']);
    expect(input).toEqual(['2c', 'Ah', 'Td']);
  });
});
