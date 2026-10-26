// Shared parts of the sizing skills D2 to D5. Every size, reason and source is read from the sizing rules.

import { sourceLinks, sourceLines } from '../../content';
import type { RuleId, SizingRules, Span } from '../../content/types';
import type { Rng } from '../../engine/rng';
import { openersBefore, seatNames } from '../../engine/seats';
import type { Answer } from '../../engine/types';
import { numberOf } from '../B/common';

/** Hands used for the sizing pictures. The size does not depend on the hand, so these are simply strong. */
export const STRONG_HANDS = ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs'];

export function sizingSources(rules: SizingRules, id: RuleId): string[] {
  return sourceLines(rules.sources, rules.rules[id].sources);
}

export function sizingReading(rules: SizingRules, id: RuleId): { label: string; url: string }[] {
  return sourceLinks(rules.sources, rules.rules[id].sources);
}

/** Whole chips only: an answer with a fraction of a chip is never right. */
export function chipsIn(answer: Answer, span: Span): { value: number | null; correct: boolean } {
  const value = numberOf(answer);
  return { value, correct: value !== null && Number.isInteger(value) && value >= span.min && value <= span.max };
}

/** '8 chips' or '6 to 8 chips'. */
export function chipsText(span: Span): string {
  return span.min === span.max ? `${span.min} chips` : `${span.min} to ${span.max} chips`;
}

/** Where you can sit with this many limpers in front: a non-blind seat that has enough seats before it. */
export function heroSeatsFor(players: number, limpers: number): string[] {
  return seatNames(players).filter((s) => s !== 'SB' && s !== 'BB' && openersBefore(s, players).length >= limpers);
}

export function pickSubset(rng: Rng, pool: readonly string[], n: number): string[] {
  const chosen = new Set(rng.shuffle(pool).slice(0, n));
  return pool.filter((s) => chosen.has(s));
}

export const BLINDS_NOTE = 'Blinds 1 and 2';
