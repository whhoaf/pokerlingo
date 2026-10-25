import { fullDeck, hasDuplicates, rankOf } from './cards';
import { evaluate } from './handEval';
import type { Card } from './types';

/** Every card not yet seen. Throws if the known cards repeat. */
export function unseenCards(known: readonly Card[]): Card[] {
  if (hasDuplicates(known)) throw new Error('Duplicate cards in play');
  const seen = new Set(known);
  return fullDeck().filter((c) => !seen.has(c));
}

/** Brute force: every unseen card for which the predicate holds. */
export function findOuts(
  hole: readonly Card[],
  board: readonly Card[],
  isOut: (card: Card) => boolean,
): Card[] {
  return unseenCards([...hole, ...board]).filter(isOut);
}

const STRAIGHT = 5;
const FLUSH = 6;
const STRAIGHT_FLUSH = 9;

function isStraightOrFlushCategory(category: number): boolean {
  return category === STRAIGHT || category === FLUSH || category === STRAIGHT_FLUSH;
}

export function hasMadeStraightOrFlush(cards: readonly Card[]): boolean {
  return isStraightOrFlushCategory(evaluate(cards).category);
}

/**
 * Outs for the draw questions: unseen cards that turn a hand with no straight and
 * no flush into a straight, a flush or a straight flush. Empty if you already
 * have one of those.
 */
export function straightFlushOuts(hole: readonly Card[], board: readonly Card[]): Card[] {
  const now = [...hole, ...board];
  if (hasMadeStraightOrFlush(now)) return [];
  return findOuts(hole, board, (card) => hasMadeStraightOrFlush([...now, card]));
}

/** Outs to top pair for overcards: unseen cards that pair one of your hole cards. */
export function topPairOuts(hole: readonly Card[], board: readonly Card[]): Card[] {
  const holeRanks = new Set(hole.map(rankOf));
  return findOuts(hole, board, (card) => holeRanks.has(rankOf(card)));
}
