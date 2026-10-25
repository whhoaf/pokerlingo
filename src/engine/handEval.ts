import pokersolver from 'pokersolver';
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

/** pokersolver prints ten as '10'. The engine always writes 'T'. */
function toEngineCard(text: string): Card {
  return text.startsWith('10') ? 'T' + text.slice(2) : text;
}

/** Best five-card hand from 5 to 7 cards. */
export function evaluate(cards: readonly Card[]): Evaluated {
  const hand = Hand.solve([...cards]);
  return {
    category: hand.rank,
    name: hand.name,
    description: hand.descr,
    cards: hand.cards.map((c) => toEngineCard(c.toString())),
  };
}

/** 1 if a beats b, -1 if b beats a, 0 for a tie. */
export function compareHands(a: readonly Card[], b: readonly Card[]): -1 | 0 | 1 {
  // pokersolver's compare() is a sort order: negative means the first hand wins.
  const diff = Hand.solve([...a]).compare(Hand.solve([...b]));
  return diff < 0 ? 1 : diff > 0 ? -1 : 0;
}

/** Indexes of the winning hands. More than one means a split pot. */
export function winnerIndexes(hands: readonly (readonly Card[])[]): number[] {
  const solved = hands.map((h) => Hand.solve([...h]));
  const winners = new Set(Hand.winners(solved));
  return solved.flatMap((h, i) => (winners.has(h) ? [i] : []));
}
