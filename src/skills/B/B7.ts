import { requiredEquity } from '../../engine/odds';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { AREA_B_READING, numberOf, rngFor, roundTo5 } from './common';

/** Price answers within this many percentage points count as right. */
export const B7_TOLERANCE = 2;

export const B7: SkillDef = {
  id: 'B7',
  area: 'B',
  title: 'Price of a call as a percentage',
  prereqs: [],
  generate(seed): Question {
    const rng = rngFor('B7', seed);
    const pot = 5 * rng.int(4, 80); // 20 to 400
    const bet = roundTo5(pot * (0.25 + rng.next() * 1.25)); // a quarter to one and a half times the pot
    const price = requiredEquity(pot, bet);
    const total = pot + 2 * bet;

    return {
      skillId: 'B7',
      seed,
      prompt: `The pot is ${pot}. Your opponent bets ${bet}. What chance of winning do you need to call?`,
      table: { pot, bet, note: 'The pot is before the bet' },
      input: { kind: 'number', unit: '%' },
      grade(answer: Answer): GradeResult {
        const value = numberOf(answer);
        return {
          correct: value !== null && Math.abs(value - price) <= B7_TOLERANCE,
          correctLabel: `${price.toFixed(1)}%`,
          reason: `You pay ${bet} to win ${pot + bet}, so you need ${price.toFixed(1)}%.`,
          working: [
            `Pot after the bet: ${pot} + ${bet} = ${pot + bet}`,
            `Pot after you call: ${pot + bet} + ${bet} = ${total}`,
            `${bet} / ${total} = ${price.toFixed(1)}%`,
          ],
        };
      },
    };
  },
  explainer: {
    body: [
      'When someone bets, calling costs the bet and wins the pot plus the bet. The price of the call is your share of the final pot: bet / (pot + 2 x bet).',
      'Pot 100, bet 50. After you call there are 200 in the pot and you paid 50 of it. 50 / 200 = 25%.',
      'If your chance of winning is higher than the price, calling makes money over time. If it is lower, folding is better.',
      'The pot is the pot before the bet. Do not add the bet twice.',
    ],
    example: {
      prompt: 'The pot is 100. Your opponent bets 50. What chance of winning do you need to call?',
      table: { pot: 100, bet: 50, note: 'The pot is before the bet' },
      answer: '25.0%',
      working: [
        'Pot after the bet: 100 + 50 = 150',
        'Pot after you call: 150 + 50 = 200',
        '50 / 200 = 25.0%',
      ],
    },
  },
  furtherReading: AREA_B_READING,
};
