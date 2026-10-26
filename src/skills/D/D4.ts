import { sizingRules } from '../../content';
import { POT_FRACTIONS, fractionsInside, potSpanText } from '../../content/sizing';
import type { SizingRules } from '../../content/types';
import { deal } from '../../engine/cards';
import type { Rng } from '../../engine/rng';
import { classifyFlop, textureReason, type Texture } from '../../engine/texture';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor, until } from '../B/common';
import { sizingReading, sizingSources } from './common';

export const FLOP_PROMPT = 'You raised before the flop and one player called. It checks to you. How big is your bet?';

/** 'a, b or c' from a list of labels. */
function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

interface D4Spec {
  seed: number;
  rules: SizingRules;
  board: Card[];
  hole: Card[];
  pot: number;
}

export function d4Question(spec: D4Spec): Question {
  const { rules, board, hole, pot } = spec;
  const rule = rules.rules.D4;
  const texture = classifyFlop(board) as Exclude<Texture, 'neither'>;
  const span = rule[texture === 'dry' ? 'dry' : 'wet'];
  const accepted = fractionsInside(span);
  const labels = POT_FRACTIONS.filter((f) => accepted.includes(f.id)).map((f) => f.label);

  return {
    skillId: 'D4',
    seed: spec.seed,
    prompt: FLOP_PROMPT,
    table: { hole, board, pot, note: 'Flop' },
    input: { kind: 'choice', options: POT_FRACTIONS.map((f) => ({ id: f.id, label: f.label })) },
    grade(answer: Answer): GradeResult {
      const picked = choiceOf(answer);
      return {
        correct: picked !== null && accepted.includes(picked),
        correctLabel: joinLabels(labels),
        reason: rule.reason,
        working: [
          textureReason(texture),
          `The rule for a ${texture} flop: ${potSpanText(span)}.`,
          accepted.length === 1 ? 'One choice falls inside that range.' : 'Every choice inside that range is right.',
        ],
        correctIds: accepted,
        sources: sizingSources(rules, 'D4'),
        draft: rules.draft,
      };
    },
  };
}

/** A flop that is clearly dry or clearly wet, with two hole cards that are not on it. */
export function dealFlop(rng: Rng, texture: 'dry' | 'wet'): { board: Card[]; hole: Card[] } {
  const board = until('D4', () => {
    const flop = deal(rng, 3);
    return classifyFlop(flop) === texture ? flop : null;
  });
  return { board, hole: deal(rng, 2, board) };
}

export function makeD4(rules: SizingRules): SkillDef {
  const rule = rules.rules.D4;
  const example = d4Question({ seed: 0, rules, board: ['Ks', '7h', '2d'], hole: ['Ac', 'Qh'], pot: 40 });
  const exampleResult = example.grade({ kind: 'choice', id: fractionsInside(rule.dry)[0] as string });

  return {
    id: 'D4',
    area: 'D',
    title: 'Continuation bet size by board texture',
    prereqs: ['D1', 'C5'],
    draft: rules.draft,
    generate(seed): Question {
      const rng = rngFor('D4', seed);
      const texture = rng.next() < 0.5 ? 'dry' : 'wet';
      const { board, hole } = dealFlop(rng, texture);
      const pot = 5 * rng.int(3, 24);
      return d4Question({ seed, rules, board, hole, pot });
    },
    explainer: {
      body: [
        `A continuation bet is a bet on the flop by the player who raised before the flop. Its size depends on the board. On a dry flop, bet ${potSpanText(rule.dry)}. On a wet flop, bet ${potSpanText(rule.wet)}. ${rule.reason}`,
        'A dry flop has three different suits and cards far apart in rank, such as K 7 2. A wet flop has two cards of one suit and cards close together, such as J 10 8 with two hearts.',
        'Every choice inside the range is right. Boards that are neither clearly dry nor clearly wet do not appear in these questions.',
      ],
      example: {
        prompt: example.prompt,
        table: example.table,
        answer: exampleResult.correctLabel,
        working: [exampleResult.reason, ...(exampleResult.working ?? [])],
        sources: exampleResult.sources,
      },
    },
    furtherReading: sizingReading(rules, 'D4'),
  };
}

export const D4 = makeD4(sizingRules);
