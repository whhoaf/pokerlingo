import { rankValue, suitOf } from './cards';
import { compareSolved, describeSolved, solve, type Evaluated, type SolvedHand } from './handEval';
import { hasStraightRanks, unseenCards } from './outs';
import type { Card } from './types';

export type Holding = [Card, Card];

/** Every two-card holding left in the deck once the board is known: 1,081 on a five-card board. */
export function allHoldings(board: readonly Card[]): Holding[] {
  const rest = unseenCards(board);
  const out: Holding[] = [];
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) out.push([rest[i] as Card, rest[j] as Card]);
  }
  return out;
}

/** All the holdings that make exactly the same hand on this board. They would split a pot. */
export interface Tier {
  holdings: Holding[];
  hand: Evaluated;
}

/**
 * Evaluates every remaining holding with pokersolver and groups the ones that tie.
 * The first tier is the nuts. Boards of 3 to 5 cards.
 */
export function strengthTiers(board: readonly Card[]): Tier[] {
  if (board.length < 3 || board.length > 5) throw new Error(`Board needs 3 to 5 cards, got ${board.length}`);
  const ranked = allHoldings(board).map((holding) => ({ holding, solved: solve([...board, ...holding]) }));
  // compareSolved is 1 when the first hand wins, so a negative sort key puts the best hand first.
  ranked.sort((a, b) => -compareSolved(a.solved, b.solved));

  const tiers: { holdings: Holding[]; solved: SolvedHand }[] = [];
  for (const entry of ranked) {
    const last = tiers[tiers.length - 1];
    if (last && compareSolved(last.solved, entry.solved) === 0) last.holdings.push(entry.holding);
    else tiers.push({ holdings: [entry.holding], solved: entry.solved });
  }
  return tiers.map((t) => ({ holdings: t.holdings, hand: describeSolved(t.solved) }));
}

/** The best hand any holding can make, and every holding that makes it. */
export function nutsOf(board: readonly Card[]): Tier {
  return strengthTiers(board)[0] as Tier;
}

export interface BoardThreats {
  /** Holdings that put five cards of one suit among their seven (or fewer) cards. */
  flush: Holding[];
  /** Holdings that put five consecutive ranks among their cards, the ace high or low. */
  straight: Holding[];
}

/** Enumerates every holding and reports which ones can make a flush or a straight. */
export function boardThreats(board: readonly Card[]): BoardThreats {
  const flush: Holding[] = [];
  const straight: Holding[] = [];
  for (const holding of allHoldings(board)) {
    const cards = [...board, ...holding];
    const suits = new Map<string, number>();
    for (const c of cards) suits.set(suitOf(c), (suits.get(suitOf(c)) ?? 0) + 1);
    if ([...suits.values()].some((n) => n >= 5)) flush.push(holding);
    if (hasStraightRanks(new Set(cards.map(rankValue)))) straight.push(holding);
  }
  return { flush, straight };
}

/**
 * The same two answers worked out from the board alone, without enumerating.
 * A flush needs three cards of one suit on the board. A straight needs three
 * board ranks inside one run of five. Generators use this to reject boards
 * cheaply, and tests check it against boardThreats.
 */
export function quickThreats(board: readonly Card[]): { flush: boolean; straight: boolean } {
  const suits = new Map<string, number>();
  for (const c of board) suits.set(suitOf(c), (suits.get(suitOf(c)) ?? 0) + 1);
  const flush = [...suits.values()].some((n) => n >= 3);

  const values = new Set(board.map(rankValue));
  if (values.has(14)) values.add(1);
  let straight = false;
  for (let low = 1; low <= 10 && !straight; low++) {
    let hits = 0;
    for (let v = low; v < low + 5; v++) if (values.has(v)) hits++;
    straight = hits >= 3;
  }
  return { flush, straight };
}
