import { houseChart } from '../../content';
import { lookupFor } from '../../content/chart';
import type { HouseChart } from '../../content/types';
import { dealHand, HAND_CLASSES, STRENGTH_ORDER } from '../../engine/ranges';
import { createRng } from '../../engine/rng';
import { backFromButton, chartSeat, seatNames } from '../../engine/seats';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor } from '../B/common';
import {
  AREA_A_READING,
  GRID_PARAGRAPH,
  chartSources,
  describeSituation,
  labelList,
  namedRing,
} from './common';
import { spotQuestion } from './situationSkill';

const SEAT_CHOICES = ['LJ', 'HJ', 'UTG', 'CO'];

/** Hands whose accepted actions differ between the early seats and the lojack. */
export function differingHands(chart: HouseChart): string[] {
  const early = lookupFor(chart.situations['open.EP']);
  const lojack = lookupFor(chart.situations['open.LJ']);
  const key = (accept: readonly string[]) => [...accept].sort().join('|');
  return HAND_CLASSES.filter((c) => key(early.verdict(c).accept) !== key(lojack.verdict(c).accept));
}

/** The seat at a 9-player table that sits as far back from the button as the first seat at a 6-player table. */
export function nineTableTwin(): string {
  const back = backFromButton('UTG', 6);
  return seatNames(9).find((s) => backFromButton(s, 9) === back) as string;
}

function seatQuestion(chart: HouseChart, seed: number, rng: ReturnType<typeof rngFor>): Question {
  const answer = nineTableTwin();
  const options = rng.shuffle(SEAT_CHOICES).map((n) => ({ id: n, label: n }));
  return {
    skillId: 'A9',
    seed,
    prompt: 'At a 6-player table, UTG is the first seat to act. Which seat at a 9-player table does it play like?',
    table: { ring: namedRing(6, 'UTG'), note: '6 players' },
    input: { kind: 'choice', options },
    grade(given: Answer): GradeResult {
      return {
        correct: choiceOf(given) === answer,
        correctLabel: answer,
        reason: 'The first seat at 6 players is 3 seats back from the button, like the lojack at 9 players.',
        working: [
          `6 players, in order of play: ${seatNames(6).join(', ')}.`,
          `9 players, in order of play: ${seatNames(9).join(', ')}.`,
          `At 6 players the chart gives the first seat the ${chartSeat('UTG', 6)} row.`,
        ],
        // The feedback leads into the chart rows, so while the chart is a draft it carries the note too.
        draft: chart.draft,
      };
    },
  };
}

function handQuestion(chart: HouseChart, seed: number, cls: string, hole: [Card, Card]): Question {
  const base = spotQuestion({
    skillId: 'A9',
    seed,
    chart,
    situation: 'open.LJ',
    spot: { players: 6, hero: 'UTG', limpers: [] },
    hole,
  });
  const early = lookupFor(chart.situations['open.EP']).verdict(cls);
  return {
    ...base,
    prompt: 'You are the first to act at a 6-player table. What do you do?',
    grade(given: Answer): GradeResult {
      const result = base.grade(given);
      return {
        ...result,
        working: [
          ...(result.working ?? []),
          `At 7 to 9 players an early seat would ${labelList(early.accept).toLowerCase()} with ${cls}.`,
          `At 6 players your seat uses the lojack row, which says ${result.correctLabel.toLowerCase()}.`,
        ],
        sources: chartSources(chart, ['open.LJ', 'open.EP']),
      };
    },
  };
}

export function makeA9(chart: HouseChart): SkillDef {
  const differing = differingHands(chart);

  // The worked example is a hand from the middle of the differing hands, or the seat question when there are none.
  const ordered = STRENGTH_ORDER.filter((c) => differing.includes(c));
  const exampleClass = ordered[Math.floor(ordered.length / 2)];
  let example: SkillDef['explainer']['example'];
  if (exampleClass) {
    const q = handQuestion(chart, 0, exampleClass, dealHand(createRng(1), exampleClass));
    const r = q.grade({ kind: 'choice', id: lookupFor(chart.situations['open.LJ']).verdict(exampleClass).accept[0] as string });
    example = {
      prompt: q.prompt,
      table: q.table,
      answer: r.correctLabel,
      working: [r.reason, ...(r.working ?? [])],
      rangeGrid: r.rangeGrid,
      sources: r.sources,
    };
  } else {
    const q = seatQuestion(chart, 0, createRng(1));
    const r = q.grade({ kind: 'choice', id: nineTableTwin() });
    example = { prompt: q.prompt, table: q.table, answer: r.correctLabel, working: [r.reason, ...(r.working ?? [])] };
  }

  return {
    id: 'A9',
    area: 'A',
    title: 'Same hand, different table size',
    prereqs: ['A2', 'A3'],
    draft: chart.draft,
    generate(seed): Question {
      const rng = rngFor('A9', seed);
      const wantHand = differing.length > 0 && rng.next() < 0.5;
      if (!wantHand) return seatQuestion(chart, seed, rng);
      const cls = rng.pick(differing);
      return handQuestion(chart, seed, cls, dealHand(rng, cls));
    },
    explainer: {
      body: [
        'Your seat decides which row of the chart you use, and the number of players decides which seats exist. At 6 players the first seat to act plays like the lojack. At 7 to 9 players the early seats have their own row.',
        `${describeSituation(chart, 'open.EP')} ${describeSituation(chart, 'open.LJ')}`,
        'Count back from the button to compare seats at different table sizes. At 6 players the first seat is 3 seats back, which is the lojack at 9 players.',
        GRID_PARAGRAPH,
      ],
      example,
    },
    furtherReading: AREA_A_READING,
  };
}

export const A9 = makeA9(houseChart);
