import { exactEquity, ruleOf2And4 } from '../../engine/odds';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { AREA_B_READING, numberOf, rngFor } from './common';
import { cardsToCome, dealDraw, unseenCount, type DrawKind } from './draws';

const KINDS: DrawKind[] = ['flush', 'oesd', 'gutshot', 'combo-oesd', 'combo-gutshot'];

/** Rule of 2 and 4 answers within this many percentage points count as right. */
export const B6_TOLERANCE = 2;

export const B6: SkillDef = {
  id: 'B6',
  area: 'B',
  title: 'Outs to equity: the rule of 2 and 4',
  prereqs: ['B1'],
  generate(seed): Question {
    const rng = rngFor('B6', seed);
    const toCome = rng.pick([1, 2] as const);
    const draw = dealDraw(rng, rng.pick(KINDS), toCome === 1 ? 'turn' : 'flop');
    const outs = draw.outs.length;
    const factor = toCome === 1 ? 2 : 4;
    const expected = ruleOf2And4(outs, toCome);
    const exact = exactEquity(outs, unseenCount(draw.street), cardsToCome(draw.street));

    return {
      skillId: 'B6',
      seed,
      prompt: 'Use the rule of 2 and 4. About what chance do you have to hit a straight or a flush?',
      table: {
        hole: draw.hole,
        board: draw.board,
        note: toCome === 1 ? 'One card to come' : 'Two cards to come. You are all in.',
      },
      input: { kind: 'number', unit: '%' },
      grade(answer: Answer): GradeResult {
        const value = numberOf(answer);
        return {
          correct: value !== null && Math.abs(value - expected) <= B6_TOLERANCE,
          correctLabel: `${expected}%`,
          reason: `${outs} outs times ${factor} is ${expected}%, with ${toCome === 1 ? 'one card' : 'two cards'} to come.`,
          working: [
            `${outs} outs`,
            `Multiply by ${factor} for ${toCome === 1 ? 'one card' : 'two cards'} to come`,
            `${outs} x ${factor} = ${expected}%`,
            `The exact figure is ${exact.toFixed(1)}%`,
          ],
          highlight: draw.outs,
        };
      },
    };
  },
  explainer: {
    body: [
      'The rule of 2 and 4 turns outs into a quick percentage chance of hitting. With one card to come, multiply your outs by 2. With two cards to come, multiply by 4.',
      'Nine outs with one card to come: 9 x 2 = 18%. The exact figure is 19.6%, close enough for the table.',
      'Use 4 only when you will see both cards, for example when you are all in. Otherwise use 2 for the next card.',
      'The rule runs a little high for big draws with two cards to come. Answers within 2 points of the rule count as right.',
    ],
    example: {
      prompt: 'Use the rule of 2 and 4. About what chance do you have to hit a straight or a flush?',
      table: { hole: ['Ah', '5h'], board: ['Kh', '9h', '2c'], note: 'Two cards to come. You are all in.' },
      answer: '36%',
      working: ['9 outs', 'Multiply by 4 for two cards to come', '9 x 4 = 36%', 'The exact figure is 35.0%'],
    },
  },
  furtherReading: AREA_B_READING,
};
