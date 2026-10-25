import { cardText } from '../../engine/cards';
import { evaluate } from '../../engine/handEval';
import type { Rng } from '../../engine/rng';
import type { Card, SkillDef } from '../../engine/types';
import { cardOf, range, rankWordPlural, rngFor, until } from '../B/common';
import {
  AREA_C_READING,
  showdown,
  showdownQuestion,
  showdownReason,
  signature,
  type Outcome,
  type Showdown,
} from './common';

/** Mostly the opponent winning on the kicker, sometimes a split, and a fair share of rivers that change nothing. */
const TARGETS: Outcome[] = ['opp', 'opp', 'opp', 'opp', 'opp', 'you', 'you', 'you', 'you', 'split', 'split'];

export interface CounterfeitDeal extends Showdown {
  /** The ranks, as values 2 to 14. */
  high: number;
  low: number;
  paired: number;
  river: Card;
  counterfeited: boolean;
  /** The two pairs you actually play after the river. */
  finalPairs: [number, number];
}

/** A free card of this rank. */
function take(rng: Rng, value: number, used: Set<Card>): Card {
  const suit = rng.pick([...'shdc'].filter((s) => !used.has(cardOf(value, s))));
  const card = cardOf(value, suit);
  used.add(card);
  return card;
}

/**
 * You hold a high and a low card that each pair a board card, which is two pair on the turn.
 * The opponent holds the other card of your high rank and an unrelated kicker card. The river
 * pairs another board rank. If that rank is above your low pair, your low pair stops playing
 * and the kicker decides. If it is below, nothing changes.
 */
function dealCounterfeit(rng: Rng, target: Outcome): CounterfeitDeal {
  return until(
    'C6',
    () => {
      const [a, b, paired, other, kicker] = rng.shuffle(range(2, 14)).slice(0, 5) as [number, number, number, number, number];
      const high = Math.max(a, b);
      const low = Math.min(a, b);
      const used = new Set<Card>();

      const hole = [take(rng, high, used), take(rng, low, used)];
      const villain = [take(rng, high, used), take(rng, kicker, used)];
      const turnBoard = rng.shuffle([take(rng, high, used), take(rng, low, used), take(rng, paired, used), take(rng, other, used)]);
      const river = take(rng, paired, used);
      const board = [...turnBoard, river];

      // pokersolver checks the story: two pair with both hole cards on the turn,
      // two pair for both players at the end, and the right result.
      const turn = evaluate([...hole, ...turnBoard]);
      const turnPairs = signature(turn).slice(0, 2);
      if (turn.category !== 3 || turnPairs[0] !== high || turnPairs[1] !== low) return null;

      const sd = showdown(hole, villain, board);
      if (sd.outcome !== target || sd.you.category !== 3 || sd.opp.category !== 3) return null;
      const finalPairs = signature(sd.you).slice(0, 2) as [number, number];
      const counterfeited = !finalPairs.includes(low);
      if (counterfeited === (sd.outcome === 'you')) return null; // a counterfeit never wins, a clean river never loses
      return { ...sd, high, low, paired, river, counterfeited, finalPairs };
    },
    20000,
  );
}

export const C6: SkillDef = {
  id: 'C6',
  area: 'C',
  title: 'Counterfeited hands',
  prereqs: ['C2'],
  generate(seed) {
    const rng = rngFor('C6', seed);
    const d = dealCounterfeit(rng, rng.pick(TARGETS));
    const wp = rankWordPlural;
    const lines = [`On the turn you had two pair: ${wp(d.high)} and ${wp(d.low)}.`];
    if (d.counterfeited) {
      lines.push(
        `The river pairs the board's ${wp(d.paired)}. Your ${wp(d.low)} are counterfeited: your two pair is now ${wp(d.finalPairs[0])} and ${wp(d.finalPairs[1])}.`,
      );
    } else {
      lines.push(
        `The river pairs the board's ${wp(d.paired)}, which is below your ${wp(d.low)}. Your two pair stays ${wp(d.high)} and ${wp(d.low)}.`,
      );
    }
    return showdownQuestion({
      skillId: 'C6',
      seed,
      prompt: 'The river pairs the board. Who wins at showdown?',
      table: {
        hole: d.hole,
        villain: d.villain,
        board: d.board,
        note: `You had two pair on the turn. River: ${cardText(d.river)}`,
      },
      sd: d,
      reason: d.counterfeited ? `The river counterfeits your ${wp(d.low)}. ${showdownReason(d)}` : showdownReason(d),
      extraWorking: lines,
      highlight: { cards: d.you.cards, label: 'Your final five cards' },
    });
  },
  explainer: {
    body: [
      'A hand is counterfeited when a new board card pairs the board and makes part of your hand worthless. Say you hold 8 and 6 and the board has an 8 and a 6, so you have two pair. The river pairs a king on the board.',
      'Now the best two pair you can make is kings and eights. Your sixes no longer play. They are only a kicker.',
      'The kicker then decides. A player with the other eight and an ace has kings and eights too, and the ace beats your six.',
      'Build your best five cards again when the river lands. If the river pairs a rank below your lower pair, nothing changes.',
    ],
    example: {
      prompt: 'The river pairs the board. Who wins at showdown?',
      table: {
        hole: ['8s', '6d'],
        villain: ['8h', 'Ad'],
        board: ['8c', '6c', 'Kd', '3h', 'Ks'],
        note: 'You had two pair on the turn. River: K♠',
      },
      answer: 'Opponent wins',
      working: [
        'On the turn you had two pair: eights and sixes.',
        "The river pairs the board's kings. Your sixes are counterfeited: your two pair is now kings and eights.",
        'You: Two pair, kings and eights (K♦ K♠ 8♠ 8♣ 6♦)',
        'Opponent: Two pair, kings and eights (K♦ K♠ 8♥ 8♣ A♦)',
        'The river counterfeits your sixes. The made hands are equal, so the kicker decides: their ace beats your six.',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
