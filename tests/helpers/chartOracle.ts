// An independent reading of a house chart, written without the app's chart code, for the Area A tests.
// It uses only the range parser (which has its own tests) and tables written out by hand.

import { parseRange } from '../../src/engine/ranges';
import type { HouseChart, Situation, SituationId } from '../../src/content/types';
import { SITUATION_IDS } from '../../src/content/types';

export const SEATS: Record<number, string[]> = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

export function rowOf(seat: string, players: number): string {
  if (seat === 'UTG' && players === 6) return 'LJ';
  return seat.startsWith('UTG') ? 'EP' : seat;
}

/** A chart's seat list names a seat: early seats by name (where they are early), every other seat by its row. */
export function listed(list: string[], seat: string, players: number): boolean {
  const row = rowOf(seat, players);
  return list.some((l) => (l.startsWith('UTG') ? l === seat && row === 'EP' : l === row));
}

export function isBlindSeat(seat: string): boolean {
  return seat === 'SB' || seat === 'BB';
}

export function kindOfId(id: string): 'open' | 'limpers' | 'raise' | 'bb' {
  return id.split('.')[0] as 'open' | 'limpers' | 'raise' | 'bb';
}

/** The actions that count as right for a hand class, found the slow obvious way. */
export function oracleAccept(s: Situation, cls: string): string[] {
  for (const e of s.either ?? []) {
    if (parseRange(e.hands).has(cls)) return [...new Set(e.accept)];
  }
  for (const action of s.choices) {
    const text = s.ranges[action];
    if (text !== undefined && parseRange(text).has(cls)) return [action];
  }
  return [s.default];
}

/** The hero seats a situation allows at a table size. */
export function oracleHeroes(id: SituationId, s: Situation, players: number): string[] {
  const kind = kindOfId(id);
  return SEATS[players]!.filter((seat) => {
    if (!listed(s.seats, seat, players)) return false;
    if (kind === 'open') return seat !== 'BB';
    if (kind === 'bb') return seat === 'BB';
    const earlier = SEATS[players]!.slice(0, SEATS[players]!.indexOf(seat)).filter((x) => !isBlindSeat(x));
    if (kind === 'limpers') return earlier.length >= (s.limpers?.[0] ?? 1);
    // raise.*: a listed raiser must sit in front of you
    return seat !== 'BB' && earlier.some((r) => !s.raiser || listed(s.raiser, r, players));
  });
}

export function findSituationByTitle(chart: HouseChart, title: string): SituationId {
  const matches = SITUATION_IDS.filter((id) => chart.situations[id].title === title);
  if (matches.length !== 1) throw new Error(`Expected one situation titled "${title}", found ${matches.length}`);
  return matches[0] as SituationId;
}
