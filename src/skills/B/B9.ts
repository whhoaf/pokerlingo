import { exactEquity, requiredEquity } from '../../engine/odds';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { AREA_B_READING, choiceOf, rngFor, roundTo5, until } from './common';
import { dealDraw, unseenCount, type DrawKind } from './draws';

const KINDS: DrawKind[] = ['flush', 'oesd', 'gutshot', 'combo-oesd', 'combo-gutshot'];
/** Bet sizes as a fraction of the pot. Small ones are there so that a call is sometimes right. */
const BET_FRACTIONS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5];
/** Spots are only dealt when your chance and the price differ by at least this many points. */
export const B9_MIN_GAP = 5;

export const B9: SkillDef = {
  id: 'B9',
  area: 'B',
  title: 'Call or fold with a draw',
  prereqs: ['B6', 'B7'],
  generate(seed): Question {
    const rng = rngFor('B9', seed);
    const wantCall = rng.next() < 0.5;

    const spot = until('B9', () => {
      const draw = dealDraw(rng, rng.pick(KINDS), 'turn');
      const equity = exactEquity(draw.outs.length, unseenCount('turn'), 1);
      for (let i = 0; i < 12; i++) {
        const pot = 5 * rng.int(4, 80);
        const bet = roundTo5(pot * rng.pick(BET_FRACTIONS));
        const price = requiredEquity(pot, bet);
        const gap = equity - price;
        if (wantCall ? gap >= B9_MIN_GAP : gap <= -B9_MIN_GAP) return { draw, pot, bet, equity, price };
      }
      return null;
    });

    const { draw, pot, bet, equity, price } = spot;
    const outs = draw.outs.length;
    const call = equity > price;
    const total = pot + 2 * bet;

    return {
      skillId: 'B9',
      seed,
      prompt: `The pot is ${pot}. Your opponent bets ${bet}. Call or fold?`,
      table: { hole: draw.hole, board: draw.board, pot, bet, note: 'Turn. One card to come.' },
      input: {
        kind: 'choice',
        options: [
          { id: 'call', label: 'Call' },
          { id: 'fold', label: 'Fold' },
        ],
      },
      grade(answer: Answer): GradeResult {
        return {
          correct: choiceOf(answer) === (call ? 'call' : 'fold'),
          correctLabel: call ? 'Call' : 'Fold',
          reason: call
            ? `Your ${equity.toFixed(1)}% chance beats the ${price.toFixed(1)}% price.`
            : `Your ${equity.toFixed(1)}% chance is below the ${price.toFixed(1)}% price.`,
          working: [
            `The price: ${bet} / ${total} = ${price.toFixed(1)}%`,
            `Your chance: ${outs} outs, ${outs} of ${unseenCount('turn')} cards = ${equity.toFixed(1)}%`,
            `Rule of 2: ${outs} x 2 = ${outs * 2}%`,
          ],
          highlight: draw.outs,
        };
      },
    };
  },
  explainer: {
    body: [
      'To decide on a draw, compare two numbers. Your chance of hitting is outs x 2 with one card to come. The price is bet / (pot + 2 x bet).',
      'If your chance is higher than the price, call. If it is lower, fold.',
      'Version 1 uses only the money in the pot now. It ignores what you might win on later streets, which is called implied odds.',
      'Spots in this skill are never close: your chance and the price differ by at least 5 points.',
    ],
    example: {
      prompt: 'The pot is 100. Your opponent bets 100. Call or fold?',
      table: {
        hole: ['Ah', '5h'],
        board: ['Kh', '9h', '2c', 'Td'],
        pot: 100,
        bet: 100,
        note: 'Turn. One card to come.',
      },
      answer: 'Fold',
      working: [
        'The price: 100 / 300 = 33.3%',
        'Your chance: 9 outs, 9 of 46 cards = 19.6%',
        'Rule of 2: 9 x 2 = 18%',
        '19.6% is below 33.3%, so fold',
      ],
    },
  },
  furtherReading: AREA_B_READING,
};
