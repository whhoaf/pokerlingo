import pokersolver, { type Hand as SolvedHand } from 'pokersolver';
import type { Card } from './types';

const { Hand } = pokersolver;

const CATEGORY_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

export interface Evaluated {
  /** 1 (high card) to 9 (straight flush). */
  category: number;
  name: string;
  description: string;
  /** The five cards that make the hand, in engine notation. */
  cards: Card[];
}

export function categoryName(category: number): string {
  return CATEGORY_NAMES[category - 1] ?? 'Unknown';
}

/** pokersolver prints ten as '10' and the ace of a low straight as '1'. The engine writes 'T' and 'A'. */
function toEngineCard(text: string): Card {
  if (text.startsWith('10')) return 'T' + text.slice(2);
  if (text.startsWith('1')) return 'A' + text.slice(1);
  return text;
}

export type { SolvedHand };

/** A solved hand that can be compared quickly. Keep it when one hand is compared many times. */
export function solve(cards: readonly Card[]): SolvedHand {
  return Hand.solve([...cards]);
}

/** 1 if a beats b, -1 if b beats a, 0 for a tie. */
export function compareSolved(a: SolvedHand, b: SolvedHand): -1 | 0 | 1 {
  // pokersolver's compare() is a sort order: negative means the first hand wins.
  const diff = a.compare(b);
  return diff < 0 ? 1 : diff > 0 ? -1 : 0;
}

export function describeSolved(hand: SolvedHand): Evaluated {
  return {
    category: hand.rank,
    name: hand.name,
    description: hand.descr,
    cards: hand.cards.map((c) => toEngineCard(c.toString())),
  };
}

/** Best five-card hand from 5 to 7 cards. */
export function evaluate(cards: readonly Card[]): Evaluated {
  return describeSolved(solve(cards));
}

/** 1 if a beats b, -1 if b beats a, 0 for a tie. */
export function compareHands(a: readonly Card[], b: readonly Card[]): -1 | 0 | 1 {
  return compareSolved(solve(a), solve(b));
}

/** Indexes of the winning hands. More than one means a split pot. */
export function winnerIndexes(hands: readonly (readonly Card[])[]): number[] {
  const solved = hands.map((h) => Hand.solve([...h]));
  const winners = new Set(Hand.winners(solved));
  return solved.flatMap((h, i) => (winners.has(h) ? [i] : []));
}
