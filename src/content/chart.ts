// Reading the house chart: which actions a hand accepts in a situation, and which tables a situation can occur at.

import { parseRange } from '../engine/ranges';
import { MAX_PLAYERS, MIN_PLAYERS, openersBefore, seatMatches, seatNames, seatsBefore } from '../engine/seats';
import type { Action, EitherEntry, SituationId, Situation } from './types';

export type SituationKind = 'open' | 'limpers' | 'raise' | 'bb';

/** open.* is folded to you, limpers.* has limpers in front, raise.* a raise from an earlier seat, bb.* the big blind facing a raise. */
export function situationKind(id: string): SituationKind {
  const prefix = id.split('.')[0];
  if (prefix === 'open' || prefix === 'limpers' || prefix === 'raise' || prefix === 'bb') return prefix;
  throw new Error(`Unknown situation: ${id}`);
}

export interface HandVerdict {
  /** Every action that counts as right. More than one for a borderline hand. */
  accept: Action[];
  /** The action the grid colours the hand with. */
  primary: Action;
  /** True when the hand is marked either. */
  borderline: boolean;
}

export interface Lookup {
  situation: Situation;
  /** The hands each action's range lists. */
  buckets: Map<Action, Set<string>>;
  either: { hands: Set<string>; accept: Action[] }[];
  verdict(handClass: string): HandVerdict;
}

const cache = new WeakMap<Situation, Lookup>();

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** Parse a situation's ranges once. Throws if a range string does not parse. */
export function lookupFor(situation: Situation): Lookup {
  const cached = cache.get(situation);
  if (cached) return cached;

  const buckets = new Map<Action, Set<string>>();
  for (const action of situation.choices) {
    const text = situation.ranges[action];
    if (text !== undefined) buckets.set(action, parseRange(text));
  }
  const either = (situation.either ?? []).map((e: EitherEntry) => ({
    hands: parseRange(e.hands),
    accept: unique(e.accept),
  }));

  const verdict = (handClass: string): HandVerdict => {
    const entry = either.find((e) => e.hands.has(handClass));
    if (entry) return { accept: entry.accept, primary: entry.accept[0] as Action, borderline: true };
    for (const action of situation.choices) {
      if (buckets.get(action)?.has(handClass)) return { accept: [action], primary: action, borderline: false };
    }
    return { accept: [situation.default], primary: situation.default, borderline: false };
  };

  const lookup: Lookup = { situation, buckets, either, verdict };
  cache.set(situation, lookup);
  return lookup;
}

/** A place a situation can come up: a table size, your seat, and who could have limped or raised. */
export interface SpotShape {
  players: number;
  hero: string;
  /** Seats that could have limped. */
  limperPool: string[];
  minLimpers: number;
  maxLimpers: number;
  /** Seats the raise could have come from. */
  raisers: string[];
}

/** Every table size and seat at which a situation can be asked. Empty means the content cannot make a question. */
export function spotShapes(id: SituationId, situation: Situation): SpotShape[] {
  const kind = situationKind(id);
  const out: SpotShape[] = [];
  const [lowPlayers, highPlayers] = situation.players;
  for (let players = Math.max(MIN_PLAYERS, lowPlayers); players <= Math.min(MAX_PLAYERS, highPlayers); players++) {
    for (const hero of seatNames(players)) {
      if (!situation.seats.some((s) => seatMatches(s, hero, players))) continue;
      const shape: SpotShape = { players, hero, limperPool: [], minLimpers: 0, maxLimpers: 0, raisers: [] };
      if (kind === 'open') {
        if (hero === 'BB') continue;
      } else if (kind === 'limpers') {
        shape.limperPool = openersBefore(hero, players);
        shape.minLimpers = situation.limpers?.[0] ?? 1;
        shape.maxLimpers = Math.min(situation.limpers?.[1] ?? 3, shape.limperPool.length);
        if (shape.maxLimpers < shape.minLimpers) continue;
      } else if (kind === 'raise') {
        if (hero === 'BB') continue;
        shape.raisers = openersBefore(hero, players).filter(
          (r) => !situation.raiser || situation.raiser.some((l) => seatMatches(l, r, players)),
        );
        if (shape.raisers.length === 0) continue;
      } else {
        if (hero !== 'BB') continue;
        shape.raisers = seatsBefore(hero, players).filter(
          (r) => !situation.raiser || situation.raiser.some((l) => seatMatches(l, r, players)),
        );
        if (shape.raisers.length === 0) continue;
      }
      out.push(shape);
    }
  }
  return out;
}
