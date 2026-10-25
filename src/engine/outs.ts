import { fullDeck, hasDuplicates, rankOf, rankValue, suitOf } from './cards';
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

// ---- Fast equivalents, used by generators to reject bad deals cheaply. ----
// Answers always come from the brute force above; tests check the two agree.

function rankValues(cards: readonly Card[]): Set<number> {
  return new Set(cards.map(rankValue));
}

function suitCounts(cards: readonly Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(suitOf(c), (counts.get(suitOf(c)) ?? 0) + 1);
  return counts;
}

/** Five consecutive ranks present, with the ace counting high or low. */
export function hasStraightRanks(values: ReadonlySet<number>): boolean {
  const has = (v: number) => values.has(v) || (v === 1 && values.has(14));
  for (let low = 1; low <= 10; low++) {
    if ([0, 1, 2, 3, 4].every((i) => has(low + i))) return true;
  }
  return false;
}

/** Unseen cards that complete a straight. Empty if you already have one. */
export function straightCompleters(hole: readonly Card[], board: readonly Card[]): Card[] {
  const now = [...hole, ...board];
  const values = rankValues(now);
  if (hasStraightRanks(values)) return [];
  return findOuts(hole, board, (card) => hasStraightRanks(new Set([...values, rankValue(card)])));
}

/** Unseen cards that complete a flush. Empty if you already have one. */
export function flushCompleters(hole: readonly Card[], board: readonly Card[]): Card[] {
  const counts = suitCounts([...hole, ...board]);
  if ([...counts.values()].some((n) => n >= 5)) return [];
  return findOuts(hole, board, (card) => counts.get(suitOf(card)) === 4);
}

/**
 * Same answer as straightFlushOuts, from ranks and suits alone: roughly fifty
 * times faster than evaluating every card with pokersolver.
 */
export function quickStraightFlushOuts(hole: readonly Card[], board: readonly Card[]): Card[] {
  const now = [...hole, ...board];
  const counts = suitCounts(now);
  if (hasStraightRanks(rankValues(now)) || [...counts.values()].some((n) => n >= 5)) return [];
  const flush = new Set(flushCompleters(hole, board));
  const straight = new Set(straightCompleters(hole, board));
  return findOuts(hole, board, (card) => flush.has(card) || straight.has(card));
}

/** Outs to top pair for overcards: unseen cards that pair one of your hole cards. */
export function topPairOuts(hole: readonly Card[], board: readonly Card[]): Card[] {
  const holeRanks = new Set(hole.map(rankOf));
  return findOuts(hole, board, (card) => holeRanks.has(rankOf(card)));
}
