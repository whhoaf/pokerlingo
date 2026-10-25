import type { Rng } from './rng';
import type { Card } from './types';

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';

export type Rank = string;
export type Suit = string;

const SYMBOLS: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

export function parseCard(card: Card): { rank: Rank; suit: Suit } {
  if (card.length !== 2 || !RANKS.includes(card[0] as string) || !SUITS.includes(card[1] as string)) {
    throw new Error(`Bad card: ${card}`);
  }
  return { rank: card[0] as string, suit: card[1] as string };
}

export function rankOf(card: Card): Rank {
  return parseCard(card).rank;
}

export function suitOf(card: Card): Suit {
  return parseCard(card).suit;
}

/** 2 to 14, with the ace high. */
export function rankValue(card: Card): number {
  return RANKS.indexOf(rankOf(card)) + 2;
}

export function suitSymbol(suit: Suit): string {
  return SYMBOLS[suit] ?? '?';
}

export function isRed(suit: Suit): boolean {
  return suit === 'h' || suit === 'd';
}

/** What the screen shows: rank text, suit symbol and whether it is drawn in red. */
export function formatCard(card: Card): { rank: string; symbol: string; red: boolean } {
  const { rank, suit } = parseCard(card);
  return { rank: rank === 'T' ? '10' : rank, symbol: suitSymbol(suit), red: isRed(suit) };
}

/** Text form for prompts and feedback, for example 'A♠'. */
export function cardText(card: Card): string {
  const f = formatCard(card);
  return f.rank + f.symbol;
}

/** Deal n distinct cards, never using the excluded ones. */
export function deal(rng: Rng, n: number, exclude: readonly Card[] = []): Card[] {
  const blocked = new Set(exclude);
  const pool = fullDeck().filter((c) => !blocked.has(c));
  if (n > pool.length) throw new Error(`Cannot deal ${n} cards from ${pool.length}`);
  return rng.shuffle(pool).slice(0, n);
}

export function hasDuplicates(cards: readonly Card[]): boolean {
  return new Set(cards).size !== cards.length;
}

/** A copy sorted from the highest rank to the lowest. */
export function sortByRank(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(b) - rankValue(a));
}
