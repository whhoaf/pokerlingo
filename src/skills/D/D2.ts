import { sizingRules } from '../../content';
import { BIG_BLIND, d2Span, spanText, trim } from '../../content/sizing';
import type { SizingRules } from '../../content/types';
import { dealHand } from '../../engine/ranges';
import { createRng } from '../../engine/rng';
import { openersBefore } from '../../engine/seats';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { rngFor } from '../B/common';
import { spotRing, type SpotSeats } from '../A/common';
import { BLINDS_NOTE, STRONG_HANDS, chipsIn, chipsText, heroSeatsFor, pickSubset, sizingReading, sizingSources } from './common';

export const MAX_LIMPERS = 3;

function limperText(n: number): string {
  if (n === 0) return 'Everyone before you folds.';
  return `${n === 1 ? '1 player limps' : `${n} players limp`} in front of you.`;
}

interface D2Spec {
  seed: number;
  rules: SizingRules;
  spot: SpotSeats;
  hole: [Card, Card];
}

export function d2Question(spec: D2Spec): Question {
  const { rules, spot, hole } = spec;
  const rule = rules.rules.D2;
  const limpers = spot.limpers.length;
  const span = d2Span(rule, limpers);
  const sources = sizingSources(rules, 'D2');
  const bbLow = rule.base.min + rule.perLimper * limpers;
  const bbHigh = rule.base.max + rule.perLimper * limpers;

  return {
    skillId: 'D2',
    seed: spec.seed,
    prompt: `${limperText(limpers)} You decide to raise. Raise to how many chips?`,
    table: { ring: spotRing(spot), hole, note: `${BLINDS_NOTE}. ${spot.players} players` },
    input: { kind: 'number', unit: 'chips' },
    grade(answer: Answer): GradeResult {
      const { correct } = chipsIn(answer, span);
      const working = [
        `The rule: ${spanText(rule.base, ' big blinds')}, plus ${trim(rule.perLimper)} for each limper.`,
        limpers === 0
          ? 'There are no limpers, so nothing is added.'
          : `${limpers === 1 ? '1 limper adds' : `${limpers} limpers add`} ${trim(rule.perLimper * limpers)}, so the raise is ${spanText({ min: bbLow, max: bbHigh }, ' big blinds')}.`,
        `A big blind is ${BIG_BLIND} chips, so ${chipsText(span)}.`,
      ];
      return {
        correct,
        correctLabel: chipsText(span),
        reason: rule.reason,
        working,
        sources,
        draft: rules.draft,
      };
    },
  };
}

export function makeD2(rules: SizingRules): SkillDef {
  const rule = rules.rules.D2;
  const exampleSpot: SpotSeats = { players: 8, hero: 'CO', limpers: ['UTG+1', 'HJ'] };
  const example = d2Question({ seed: 0, rules, spot: exampleSpot, hole: dealHand(createRng(1), 'AKs') });
  const exampleSpan = d2Span(rule, exampleSpot.limpers.length);
  const exampleResult = example.grade({ kind: 'number', value: exampleSpan.min });

  return {
    id: 'D2',
    area: 'D',
    title: 'Preflop raise size, adding for limpers',
    prereqs: ['D1'],
    draft: rules.draft,
    generate(seed): Question {
      const rng = rngFor('D2', seed);
      const players = rng.int(6, 9);
      const limperCount = rng.int(0, MAX_LIMPERS);
      const hero = rng.pick(heroSeatsFor(players, limperCount));
      const limpers = pickSubset(rng, openersBefore(hero, players), limperCount);
      const hole = dealHand(rng, rng.pick(STRONG_HANDS));
      return d2Question({ seed, rules, spot: { players, hero, limpers }, hole });
    },
    explainer: {
      body: [
        `The house rule is to raise to ${spanText(rule.base, ' big blinds')} before the flop, then add ${trim(rule.perLimper)} big blind${rule.perLimper === 1 ? '' : 's'} for each limper. ${rule.reason}`,
        'In these questions the blinds are 1 and 2 chips, so a big blind is 2 chips. Turn the big blinds into chips before you answer.',
        'Any whole number of chips inside the range is right. You do not need to hit one exact number.',
      ],
      example: {
        prompt: example.prompt,
        table: example.table,
        answer: exampleResult.correctLabel,
        working: [exampleResult.reason, ...(exampleResult.working ?? [])],
        sources: exampleResult.sources,
      },
    },
    furtherReading: sizingReading(rules, 'D2'),
  };
}

export const D2 = makeD2(sizingRules);
