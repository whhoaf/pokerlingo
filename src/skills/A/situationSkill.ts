// The skills A2 to A8 share one shape: a spot at the table, a hand, and a choice of actions graded by the house chart.

import { lookupFor, situationKind, spotShapes } from '../../content/chart';
import { ACTION_LABELS, type Action, type HouseChart, type SituationId } from '../../content/types';
import { dealHand, STRENGTH_ORDER } from '../../engine/ranges';
import { createRng } from '../../engine/rng';
import { chartSeat, seatNames, type ChartSeat } from '../../engine/seats';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor } from '../B/common';
import {
  AREA_A_READING,
  GRID_PARAGRAPH,
  NOTATION_PARAGRAPH,
  buildRangeGrid,
  chartSources,
  classOf,
  classWords,
  labelList,
  pickHandClass,
  pickSpot,
  situationBlock,
  spotRing,
  type SpotSeats,
} from './common';

const ROW_WORDS: Record<ChartSeat, string> = {
  EP: 'early seat',
  LJ: 'lojack',
  HJ: 'hijack',
  CO: 'cutoff',
  BTN: 'button',
  SB: 'small blind',
  BB: 'big blind',
};

export function rowWord(seat: string, players: number): string {
  return ROW_WORDS[chartSeat(seat, players)];
}

/** The line of context under your cards: the table size, and a reminder when the first seat plays the lojack's row. */
export function tableNote(spot: SpotSeats): string {
  if (spot.hero === 'UTG' && spot.players === 6) {
    return 'Six players. The first seat to act plays like the lojack.';
  }
  return `${spot.players} players`;
}

export function promptFor(id: SituationId, spot: SpotSeats): string {
  const kind = situationKind(id);
  if (kind === 'open') return 'Everyone before you folds. What do you do?';
  if (kind === 'limpers') {
    const n = spot.limpers.length;
    return `${n === 1 ? '1 player limps' : `${n} players limp`} in front of you. What do you do?`;
  }
  const raiser = spot.raiser as string;
  if (kind === 'bb') return `${raiser} raises and everyone else folds. You are in the big blind. What do you do?`;
  const names = seatNames(spot.players);
  const between = names.indexOf(spot.hero) - names.indexOf(raiser) > 1;
  return `${raiser} raises${between ? ' and the seats in between fold' : ''}. What do you do?`;
}

export interface SpotQuestionSpec {
  skillId: string;
  seed: number;
  chart: HouseChart;
  situation: SituationId;
  spot: SpotSeats;
  hole: [Card, Card];
}

/** One question: the picture, the choices and a grader that reads the chart. */
export function spotQuestion(spec: SpotQuestionSpec): Question {
  const { chart, situation: id, spot, hole } = spec;
  const situation = chart.situations[id];
  const lookup = lookupFor(situation);
  const cls = classOf(hole);
  const verdict = lookup.verdict(cls);
  const sources = chartSources(chart, [id]);

  return {
    skillId: spec.skillId,
    seed: spec.seed,
    prompt: promptFor(id, spot),
    table: { ring: spotRing(spot), hole, note: tableNote(spot) },
    input: {
      kind: 'choice',
      options: situation.choices.map((a) => ({ id: a, label: ACTION_LABELS[a] })),
    },
    grade(answer: Answer): GradeResult {
      const picked = choiceOf(answer);
      const working = [
        `You hold ${cls}: ${classWords(cls)}.`,
        `Your seat: ${spot.hero}, which uses the ${rowWord(spot.hero, spot.players)} chart.`,
        verdict.borderline
          ? `A borderline hand. The chart accepts ${labelList(verdict.accept)}.`
          : `The chart says ${labelList(verdict.accept)} for this hand.`,
      ];
      return {
        correct: picked !== null && (verdict.accept as string[]).includes(picked),
        correctLabel: labelList(verdict.accept),
        reason: situation.reason,
        working,
        correctIds: verdict.accept,
        rangeGrid: buildRangeGrid(chart, id, cls),
        sources,
        draft: chart.draft,
      };
    },
  };
}

/** A hand that is neither borderline nor a fold, from the middle of the listed ranges. Falls back to the strongest folded hand. */
export function exampleHand(chart: HouseChart, id: SituationId): string {
  const lookup = lookupFor(chart.situations[id]);
  const listed = STRENGTH_ORDER.filter((c) => {
    const v = lookup.verdict(c);
    return !v.borderline && v.primary !== chart.situations[id].default;
  });
  if (listed.length > 0) return listed[Math.floor(listed.length / 2)] as string;
  return STRENGTH_ORDER.find((c) => !lookup.verdict(c).borderline) ?? 'AA';
}

/** A fixed spot for the worked example: the biggest table, the first listed raiser, the fewest limpers. */
export function exampleSpot(id: SituationId, chart: HouseChart): SpotSeats {
  const shapes = spotShapes(id, chart.situations[id]);
  const biggest = Math.max(...shapes.map((s) => s.players));
  const shape = shapes.filter((s) => s.players === biggest).slice(-1)[0] ?? (shapes[0] as (typeof shapes)[number]);
  return {
    players: shape.players,
    hero: shape.hero,
    limpers: shape.limperPool.slice(0, shape.minLimpers),
    ...(shape.raisers.length > 0 ? { raiser: shape.raisers[0] as string } : {}),
  };
}

export interface SituationSkillSpec {
  id: string;
  title: string;
  prereqs: string[];
  situations: SituationId[];
  /** What this skill is about, one short paragraph. */
  intro: string;
}

export function makeSituationSkill(chart: HouseChart, spec: SituationSkillSpec): SkillDef {
  const first = spec.situations[0] as SituationId;
  const exampleId = first;
  const exSpot = exampleSpot(exampleId, chart);
  const exCls = exampleHand(chart, exampleId);
  const exHole = dealHand(createRng(1), exCls);
  const exQuestion = spotQuestion({
    skillId: spec.id,
    seed: 0,
    chart,
    situation: exampleId,
    spot: exSpot,
    hole: exHole,
  });
  const exVerdict = lookupFor(chart.situations[exampleId]).verdict(exCls);
  const exResult = exQuestion.grade({ kind: 'choice', id: exVerdict.accept[0] as Action });

  return {
    id: spec.id,
    area: 'A',
    title: spec.title,
    prereqs: spec.prereqs,
    draft: chart.draft,
    generate(seed): Question {
      const rng = rngFor(spec.id, seed);
      const id = rng.pick(spec.situations);
      const situation = chart.situations[id];
      const spot = pickSpot(rng, spotShapes(id, situation));
      const cls = pickHandClass(rng, lookupFor(situation));
      return spotQuestion({ skillId: spec.id, seed, chart, situation: id, spot, hole: dealHand(rng, cls) });
    },
    explainer: {
      body: [spec.intro, NOTATION_PARAGRAPH, GRID_PARAGRAPH],
      situations: spec.situations.map((id) => situationBlock(chart, id)),
      example: {
        prompt: exQuestion.prompt,
        table: exQuestion.table,
        answer: exResult.correctLabel,
        working: [exResult.reason, ...(exResult.working ?? [])],
        rangeGrid: exResult.rangeGrid,
        sources: exResult.sources,
      },
    },
    furtherReading: AREA_A_READING,
  };
}
