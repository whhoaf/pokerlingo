import { RANKS } from '../../engine/cards';
import { createRng, deriveSeed, type Rng } from '../../engine/rng';
import type { Answer, Card, GradeResult, Question, TableView } from '../../engine/types';

export const AREA_B_READING = [
  {
    label: 'BBZ Poker pot odds quiz',
    url: 'https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/',
  },
  { label: 'PokerRift trainer', url: 'https://pokerrift.com/learn-poker/' },
];

export const OUTS_PROMPT = 'How many outs do you have to a straight or a flush?';

export const CLEAN_NOTE =
  'Version 1 counts clean outs only. It ignores the chance that a card also helps an opponent.';

/** A seeded generator that differs per skill, so B1 and B2 do not deal the same cards for one seed. */
export function rngFor(skillId: string, seed: number): Rng {
  let salt = 0;
  for (const ch of skillId) salt = (salt * 31 + ch.charCodeAt(0)) >>> 0;
  return createRng(deriveSeed(seed, salt));
}

const RANK_NAMES: Record<number, [string, string]> = {
  2: ['two', 'twos'],
  3: ['three', 'threes'],
  4: ['four', 'fours'],
  5: ['five', 'fives'],
  6: ['six', 'sixes'],
  7: ['seven', 'sevens'],
  8: ['eight', 'eights'],
  9: ['nine', 'nines'],
  10: ['ten', 'tens'],
  11: ['jack', 'jacks'],
  12: ['queen', 'queens'],
  13: ['king', 'kings'],
  14: ['ace', 'aces'],
};

/** 'ace', 'ten' and so on, from a rank value 2 to 14. */
export function rankWord(value: number): string {
  return RANK_NAMES[value]?.[0] ?? String(value);
}

export function rankWordPlural(value: number): string {
  return RANK_NAMES[value]?.[1] ?? String(value);
}

/** How a rank is written on the card: '10' for ten. */
export function rankLabel(value: number): string {
  if (value <= 9) return String(value);
  return { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[value] as string;
}

export function suitWord(suit: string): string {
  return { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }[suit] ?? suit;
}

/** '4 fives + 4 tens = 8' style join. */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A card from a rank value (2 to 14) and a suit letter. */
export function cardOf(value: number, suit: string): Card {
  return RANKS[value - 2] + suit;
}

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Read a number answer. Anything else, or a non-finite number, is null. */
export function numberOf(answer: Answer): number | null {
  return answer.kind === 'number' && Number.isFinite(answer.value) ? answer.value : null;
}

export function choiceOf(answer: Answer): string | null {
  return answer.kind === 'choice' ? answer.id : null;
}

export interface OutsQuestionSpec {
  skillId: string;
  seed: number;
  prompt: string;
  table: TableView;
  outs: Card[];
  reason: string;
  working: string[];
}

/** A question whose answer is an exact count of outs. */
export function outsQuestion(spec: OutsQuestionSpec): Question {
  const n = spec.outs.length;
  return {
    skillId: spec.skillId,
    seed: spec.seed,
    prompt: spec.prompt,
    table: spec.table,
    input: { kind: 'number', unit: 'outs' },
    grade(answer: Answer): GradeResult {
      const value = numberOf(answer);
      return {
        correct: value === n,
        correctLabel: plural(n, 'out'),
        reason: spec.reason,
        working: spec.working,
        highlight: spec.outs,
      };
    },
  };
}

/** Try `attempt` until it returns a value. Throws if it never does, which means a generator bug. */
export function until<T>(label: string, attempt: () => T | null, maxTries = 2000): T {
  for (let i = 0; i < maxTries; i++) {
    const result = attempt();
    if (result !== null) return result;
  }
  throw new Error(`${label}: no valid deal after ${maxTries} tries`);
}

/** Round to the nearest 5, never below 5. */
export function roundTo5(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}
