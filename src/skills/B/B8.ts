import { requiredEquity } from '../../engine/odds';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { AREA_B_READING, choiceOf, rngFor } from './common';

const SIZES = [
  { id: 'p20', num: 1, den: 3, word: 'a third of the pot' },
  { id: 'p25', num: 1, den: 2, word: 'half the pot' },
  { id: 'p29', num: 2, den: 3, word: 'two thirds of the pot' },
  { id: 'p33', num: 1, den: 1, word: 'the whole pot' },
] as const;

const OPTIONS = [
  { id: 'p20', label: '20%' },
  { id: 'p25', label: '25%' },
  { id: 'p29', label: '29%' },
  { id: 'p33', label: '33%' },
];

export const B8: SkillDef = {
  id: 'B8',
  area: 'B',
  title: 'Bet size to required equity (1/3, 1/2, 2/3 and full pot)',
  prereqs: ['B7'],
  generate(seed): Question {
    const rng = rngFor('B8', seed);
    const size = rng.pick(SIZES);
    const pot = 6 * rng.int(5, 50); // a multiple of 6, so every size is a whole number of chips
    const bet = (pot * size.num) / size.den;
    const price = requiredEquity(pot, bet);
    const label = OPTIONS.find((o) => o.id === size.id)!.label;

    return {
      skillId: 'B8',
      seed,
      prompt: `The pot is ${pot}. Your opponent bets ${bet}. How much equity do you need to call?`,
      table: { pot, bet, note: 'The pot is before the bet' },
      input: { kind: 'choice', options: OPTIONS.map((o) => ({ ...o })) },
      grade(answer: Answer): GradeResult {
        return {
          correct: choiceOf(answer) === size.id,
          correctLabel: label,
          reason: `A bet of ${size.word} needs ${label} to call.`,
          working: [
            `${bet} is ${size.word}`,
            `You pay ${bet} into a pot of ${pot + 2 * bet}`,
            `${bet} / ${pot + 2 * bet} = ${price.toFixed(1)}%, about ${label}`,
          ],
        };
      },
    };
  },
  explainer: {
    body: [
      'Most bets are a simple fraction of the pot, so the price of a call is easy to remember.',
      'A third of the pot needs 20%. Half the pot needs 25%. Two thirds needs 29%. The whole pot needs 33%.',
      'At the table, work out what fraction of the pot the bet is, then use the list. A bet of 60 into 90 is two thirds, so the price is 29%.',
      'These all come from bet / (pot + 2 x bet).',
    ],
    example: {
      prompt: 'The pot is 90. Your opponent bets 60. How much equity do you need to call?',
      table: { pot: 90, bet: 60, note: 'The pot is before the bet' },
      answer: '29%',
      working: ['60 is two thirds of the pot', 'You pay 60 into a pot of 210', '60 / 210 = 28.6%, about 29%'],
    },
  },
  furtherReading: AREA_B_READING,
};
