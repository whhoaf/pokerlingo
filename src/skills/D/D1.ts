import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { numberOf, rngFor } from '../B/common';

const FRACTIONS = [
  { num: 1, den: 3, name: '1/3', word: 'a third of the pot' },
  { num: 1, den: 2, name: '1/2', word: 'half the pot' },
  { num: 2, den: 3, name: '2/3', word: 'two thirds of the pot' },
  { num: 3, den: 4, name: '3/4', word: 'three quarters of the pot' },
  { num: 1, den: 1, name: '1', word: 'the whole pot' },
] as const;

/** An answer is right within this many chips, or this share of the correct answer, whichever is larger. */
export const D1_TOLERANCE_CHIPS = 5;
export const D1_TOLERANCE_SHARE = 0.05;

export function d1Tolerance(exact: number): number {
  return Math.max(D1_TOLERANCE_CHIPS, exact * D1_TOLERANCE_SHARE);
}

/** Whole numbers stay whole. Anything else gets one decimal place. */
function chips(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const D1: SkillDef = {
  id: 'D1',
  area: 'D',
  title: 'Turn a pot fraction into chips',
  prereqs: [],
  generate(seed): Question {
    const rng = rngFor('D1', seed);
    const pot = 5 * rng.int(4, 120); // 20 to 600
    const size = rng.pick(FRACTIONS);
    const exact = (pot * size.num) / size.den;
    const tolerance = d1Tolerance(exact);

    const working: string[] = [];
    if (size.den === 1) {
      working.push(`The whole pot is ${pot} chips`);
    } else {
      working.push(`${pot} / ${size.den} = ${chips(pot / size.den)}`);
      if (size.num > 1) working.push(`${chips(pot / size.den)} x ${size.num} = ${chips(exact)}`);
    }
    working.push('Within 5 chips or 5%, whichever is larger, counts as right');

    return {
      skillId: 'D1',
      seed,
      prompt: `The pot is ${pot}. How many chips is a bet of ${size.word}?`,
      table: { pot, note: 'Size the bet as a fraction of the pot' },
      input: { kind: 'number', unit: 'chips' },
      grade(answer: Answer): GradeResult {
        const value = numberOf(answer);
        return {
          correct: value !== null && Math.abs(value - exact) <= tolerance + 1e-9,
          correctLabel: `${chips(Math.round(exact * 10) / 10)} chips`,
          reason: `${size.name === '1' ? 'A pot-sized bet' : `A bet of ${size.name} of the pot`} is ${chips(Math.round(exact * 10) / 10)} chips.`,
          working,
        };
      },
    };
  },
  explainer: {
    body: [
      'Bets are usually named as a fraction of the pot. To turn the fraction into chips, divide the pot by the bottom number, then multiply by the top number.',
      'Half the pot: divide by 2. A third: divide by 3. Two thirds: divide by 3, then double it. Three quarters: divide by 4, then multiply by 3. A pot-sized bet is the pot.',
      'With a pot of 120, a third is 40, half is 60, two thirds is 80 and three quarters is 90.',
      'You do not need to be exact. An answer within 5 chips, or within 5%, whichever is larger, counts as right.',
    ],
    example: {
      prompt: 'The pot is 150. How many chips is a bet of two thirds of the pot?',
      table: { pot: 150, note: 'Size the bet as a fraction of the pot' },
      answer: '100 chips',
      working: ['150 / 3 = 50', '50 x 2 = 100', 'Within 5 chips or 5%, whichever is larger, counts as right'],
    },
  },
};
