import { deal, sortByRank } from '../../engine/cards';
import { allHoldings, strengthTiers, type Holding } from '../../engine/nuts';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor, until } from '../B/common';
import { AREA_C_READING, cardsText, handPhrase, handText } from './common';

const STREETS = [
  { cards: 3, name: 'Flop' },
  { cards: 4, name: 'Turn' },
  { cards: 5, name: 'River' },
] as const;

/** A holding written the way it is shown: the higher card first. */
function shown(holding: Holding): Holding {
  return sortByRank(holding) as Holding;
}

export const C4: SkillDef = {
  id: 'C4',
  area: 'C',
  title: 'The best possible hand on this board (the nuts)',
  prereqs: ['C1'],
  generate(seed): Question {
    const rng = rngFor('C4', seed);
    const street = rng.pick(STREETS);

    // The nuts is the strongest tier. The three tiers below it give the distractors,
    // so each wrong answer is a different, weaker hand.
    const { board, tiers } = until('C4', () => {
      const board = deal(rng, street.cards);
      const tiers = strengthTiers(board);
      return tiers.length >= 4 ? { board, tiers } : null;
    });

    const entries = tiers.slice(0, 4).map((tier, rank) => ({ tier, rank, holding: shown(rng.pick(tier.holdings)) }));
    const options = rng
      .shuffle(entries)
      .map((e) => ({ id: e.holding.join(''), label: cardsText(e.holding), cards: [...e.holding] }));
    const best = entries[0]!;
    const nuts = best.tier;
    const total = allHoldings(board).length;
    const count = nuts.holdings.length === 1 ? '1 holding makes' : `${nuts.holdings.length} holdings make`;

    return {
      skillId: 'C4',
      seed,
      prompt: 'Which holding is the best possible hand on this board?',
      table: { board, note: street.name },
      input: { kind: 'choice', options },
      grade(answer: Answer): GradeResult {
        return {
          correct: choiceOf(answer) === best.holding.join(''),
          correctLabel: cardsText(best.holding),
          reason: `${cardsText(best.holding)} makes ${handPhrase(nuts.hand)}. No other holding beats it.`,
          working: [
            ...entries.map((e) => `${cardsText(e.holding)}: ${handText(e.tier.hand)}`),
            `${count} the best hand, out of ${total} possible`,
          ],
          highlight: [...best.holding],
          highlightLabel: 'The nuts',
        };
      },
    };
  },
  explainer: {
    body: [
      'The nuts is the best hand anyone could hold on this board. To find it, ask what the strongest hand is that two more cards could make.',
      'Work down the list from the top. Three suited cards that connect allow a straight flush. A paired board allows four of a kind or a full house. Three cards of a suit allow a flush, and the nut flush uses the ace of that suit.',
      'Next come straights, then three of a kind, then two pair. A pocket pair that matches a board card makes a set.',
      'The app checks every possible holding to get the answer: 1,081 on the river. You only need the top of the list.',
    ],
    example: {
      prompt: 'Which holding is the best possible hand on this board?',
      table: { board: ['Kd', '7h', '2c', '9s', '4d'], note: 'River' },
      answer: 'K♠ K♥',
      working: [
        'K♠ K♥: Three kings',
        '9♣ 9♥: Three nines',
        '7♠ 7♣: Three sevens',
        'A♠ A♥: Pair of aces',
        '3 holdings make the best hand, out of 1081 possible',
      ],
    },
  },
  furtherReading: AREA_C_READING,
};
