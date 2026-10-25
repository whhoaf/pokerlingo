import { SUITS } from '../../engine/cards';
import { evaluate } from '../../engine/handEval';
import { quickStraightFlushOuts, topPairOuts } from '../../engine/outs';
import type { SkillDef } from '../../engine/types';
import {
  AREA_B_READING,
  CLEAN_NOTE,
  cardOf,
  outsQuestion,
  range,
  rankWordPlural,
  rngFor,
  until,
} from './common';

const SUIT_LIST = [...SUITS];

export const B4: SkillDef = {
  id: 'B4',
  area: 'B',
  title: 'Count outs: overcards to top pair',
  prereqs: [],
  generate(seed) {
    const rng = rngFor('B4', seed);
    const street = rng.pick(['flop', 'turn'] as const);
    const boardSize = street === 'flop' ? 3 : 4;

    const deal = until('B4', () => {
      // Both hole cards sit above every board card, and the board is unpaired and dry.
      const low = rng.int(8, 13);
      const high = rng.int(low + 1, 14);
      const boardRanks = rng.shuffle(range(2, low - 1)).slice(0, boardSize);
      const hole = [cardOf(high, rng.pick(SUIT_LIST)), cardOf(low, rng.pick(SUIT_LIST))];
      if (hole[0] === hole[1]) return null;
      const board = boardRanks.map((v) => cardOf(v, rng.pick(SUIT_LIST)));
      if (new Set([...hole, ...board]).size !== hole.length + board.length) return null;
      // High card only: no made hand, and no straight or flush draw.
      if (evaluate([...hole, ...board]).category !== 1) return null;
      if (quickStraightFlushOuts(hole, board).length > 0) return null;
      const outs = topPairOuts(hole, board);
      if (outs.length !== 6) return null;
      return { hole, board, outs, high, low };
    });

    return outsQuestion({
      skillId: 'B4',
      seed,
      prompt: 'How many outs do you have to top pair?',
      table: { hole: deal.hole, board: deal.board, note: street === 'flop' ? 'Flop' : 'Turn' },
      outs: deal.outs,
      reason: `Both your cards beat the board. Pairing either one gives top pair.`,
      working: [
        'Both hole cards are higher than every board card',
        `3 ${rankWordPlural(deal.high)} + 3 ${rankWordPlural(deal.low)} = 6 outs`,
      ],
    });
  },
  explainer: {
    body: [
      'Overcards are hole cards higher than everything on the board. They are not a made hand yet, but pairing one gives you top pair.',
      'With two overcards, any card that pairs either of them is an out. Three cards of each rank are left, so 3 + 3 = 6 outs.',
      'This only counts when both of your cards are above the board. A board with a higher card on it changes the count.',
      CLEAN_NOTE,
    ],
    example: {
      prompt: 'How many outs do you have to top pair?',
      table: { hole: ['As', 'Kd'], board: ['9c', '5h', '2d'], note: 'Flop' },
      answer: '6 outs',
      working: ['Both hole cards are higher than every board card', '3 aces + 3 kings = 6 outs'],
    },
  },
  furtherReading: AREA_B_READING,
};
