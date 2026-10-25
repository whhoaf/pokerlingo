import { suitOf } from '../../engine/cards';
import type { SkillDef } from '../../engine/types';
import {
  AREA_B_READING,
  CLEAN_NOTE,
  OUTS_PROMPT,
  outsQuestion,
  rankLabel,
  rankWord,
  rngFor,
  suitWord,
} from './common';
import { dealDraw } from './draws';

export const B5: SkillDef = {
  id: 'B5',
  area: 'B',
  title: 'Count outs: combination draws, without double counting',
  prereqs: ['B1', 'B2', 'B3'],
  generate(seed) {
    const rng = rngFor('B5', seed);
    const kind = rng.pick(['combo-oesd', 'combo-gutshot'] as const);
    const draw = dealDraw(rng, kind, rng.pick(['flop', 'turn'] as const));
    const suit = suitWord(draw.flushSuit as string);
    const run = (draw.runRanks as number[]).map(rankLabel).join(', ');
    const complete = draw.completeRanks as number[];
    const overlap = draw.straightOuts.filter((c) => suitOf(c) === draw.flushSuit).length;
    const need =
      complete.length === 2
        ? `a ${rankWord(complete[0] as number)} or a ${rankWord(complete[1] as number)}`
        : `a ${rankWord(complete[0] as number)}`;
    const straightLine = `Straight: ${run} needs ${need}, so ${draw.straightOuts.length} cards`;

    return outsQuestion({
      skillId: 'B5',
      seed,
      prompt: OUTS_PROMPT,
      table: { hole: draw.hole, board: draw.board, note: draw.street === 'flop' ? 'Flop' : 'Turn' },
      outs: draw.outs,
      reason: `${draw.flushOuts.length} flush cards plus ${draw.straightOuts.length} straight cards, minus ${overlap} that ${overlap === 1 ? 'is' : 'are'} in both lists.`,
      working: [
        `Flush: ${draw.flushOuts.length} ${suit} left in the deck`,
        straightLine,
        `${overlap === 1 ? 'One straight card is' : `${overlap} straight cards are`} also ${suit}, so count ${overlap === 1 ? 'it' : 'them'} once`,
        `${draw.flushOuts.length} + ${draw.straightOuts.length} - ${overlap} = ${draw.outs.length} outs`,
      ],
    });
  },
  explainer: {
    body: [
      'Sometimes one hand has two draws at once. Count the outs for each draw, then take off any card that appears in both lists.',
      'A flush draw plus an open-ended straight draw: 9 + 8 = 17. Two of the straight cards are also in the suit you need, so they were counted twice. 17 - 2 = 15 outs.',
      'A flush draw plus a gutshot: 9 + 4 = 13, less 1 card counted twice, gives 12 outs.',
      CLEAN_NOTE,
    ],
    example: {
      prompt: OUTS_PROMPT,
      table: { hole: ['8h', '9h'], board: ['6h', '7c', 'Kh'], note: 'Flop' },
      answer: '15 outs',
      working: [
        'Flush: 9 hearts left in the deck',
        'Straight: 6, 7, 8, 9 needs a 5 or a 10, so 8 cards',
        'The 5 of hearts and 10 of hearts are in both lists, so count them once',
        '9 + 8 - 2 = 15 outs',
      ],
    },
  },
  furtherReading: AREA_B_READING,
};
