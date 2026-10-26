import { sizingRules } from '../../content';
import { d3Span, spanText } from '../../content/sizing';
import type { SizingRules } from '../../content/types';
import { dealHand } from '../../engine/ranges';
import { createRng } from '../../engine/rng';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { rngFor } from '../B/common';
import { spotRing, type SpotSeats } from '../A/common';
import { BLINDS_NOTE, STRONG_HANDS, chipsIn, chipsText, sizingReading, sizingSources } from './common';

/** The open sizes a question can show, in chips. */
export const OPEN_SIZES = [5, 6, 7, 8, 9, 10, 12];

interface D3Spec {
  seed: number;
  rules: SizingRules;
  spot: SpotSeats;
  open: number;
  hole: [Card, Card];
}

/** In position when the opener sits before you and you act after the flop after them: the button against the cutoff. */
export function isInPosition(hero: string): boolean {
  return hero === 'BTN';
}

export function d3Question(spec: D3Spec): Question {
  const { rules, spot, open, hole } = spec;
  const rule = rules.rules.D3;
  const inPosition = isInPosition(spot.hero);
  const span = d3Span(rule, open, inPosition);
  const multiple = inPosition ? rule.inPosition : rule.outOfPosition;
  const raiser = spot.raiser as string;

  return {
    skillId: 'D3',
    seed: spec.seed,
    prompt: `${raiser} raises to ${open} chips. You decide to re-raise. Re-raise to how many chips?`,
    table: { ring: spotRing(spot), hole, note: `${BLINDS_NOTE}. ${spot.players} players` },
    input: { kind: 'number', unit: 'chips' },
    grade(answer: Answer): GradeResult {
      const { correct } = chipsIn(answer, span);
      return {
        correct,
        correctLabel: chipsText(span),
        reason: rule.reason,
        working: [
          inPosition
            ? `You are in position: you act after ${raiser} on every street after the flop.`
            : `You are out of position: you act before ${raiser} on every street after the flop.`,
          `The rule: ${spanText(multiple, ' times the open')} ${inPosition ? 'in position' : 'out of position'}.`,
          `${spanText(multiple)} x ${open} = ${chipsText(span)}`,
        ],
        sources: sizingSources(rules, 'D3'),
        draft: rules.draft,
      };
    },
  };
}

/** Where the re-raiser sits: the button against the cutoff, or a blind against the button. */
export function pickD3Spot(rng: ReturnType<typeof rngFor>): SpotSeats {
  const players = rng.int(6, 9);
  const inPosition = rng.next() < 0.5;
  if (inPosition) return { players, hero: 'BTN', limpers: [], raiser: 'CO' };
  return { players, hero: rng.pick(['SB', 'BB']), limpers: [], raiser: 'BTN' };
}

export function makeD3(rules: SizingRules): SkillDef {
  const rule = rules.rules.D3;
  const example = d3Question({
    seed: 0,
    rules,
    spot: { players: 6, hero: 'BTN', limpers: [], raiser: 'CO' },
    open: 8,
    hole: dealHand(createRng(1), 'QQ'),
  });
  const exampleResult = example.grade({ kind: 'number', value: d3Span(rule, 8, true).min });

  return {
    id: 'D3',
    area: 'D',
    title: 'Re-raise size, in and out of position',
    prereqs: ['D2'],
    draft: rules.draft,
    generate(seed): Question {
      const rng = rngFor('D3', seed);
      const spot = pickD3Spot(rng);
      const open = rng.pick(OPEN_SIZES);
      return d3Question({ seed, rules, spot, open, hole: dealHand(rng, rng.pick(STRONG_HANDS)) });
    },
    explainer: {
      body: [
        `A re-raise is sized as a multiple of the open. In position, re-raise to ${spanText(rule.inPosition, ' times')} the open. Out of position, re-raise to ${spanText(rule.outOfPosition, ' times')} the open. ${rule.reason}`,
        'You are in position when you act after the other player on every street after the flop. In these questions that is the button against the cutoff. The blinds are out of position against the button.',
        'Any whole number of chips inside the range is right.',
      ],
      example: {
        prompt: example.prompt,
        table: example.table,
        answer: exampleResult.correctLabel,
        working: [exampleResult.reason, ...(exampleResult.working ?? [])],
        sources: exampleResult.sources,
      },
    },
    furtherReading: sizingReading(rules, 'D3'),
  };
}

export const D3 = makeD3(sizingRules);
