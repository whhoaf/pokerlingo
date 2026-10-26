import { sizingRules } from '../../content';
import { d5Span, potSpanText, spanText } from '../../content/sizing';
import type { SizingRules } from '../../content/types';
import { deal } from '../../engine/cards';
import { compareSolved, solve } from '../../engine/handEval';
import type { Rng } from '../../engine/rng';
import type { Answer, Card, GradeResult, Question, SkillDef } from '../../engine/types';
import { rngFor, until } from '../B/common';
import { chipsIn, chipsText, sizingReading, sizingSources } from './common';

/** Straight or better counts as a strong hand (pokersolver category 5 and up). */
export const STRONG_CATEGORY = 5;

interface D5Spec {
  seed: number;
  rules: SizingRules;
  hole: Card[];
  board: Card[];
  pot: number;
}

export function d5Question(spec: D5Spec): Question {
  const { rules, hole, board, pot } = spec;
  const rule = rules.rules.D5;
  const span = d5Span(rule, pot);

  return {
    skillId: 'D5',
    seed: spec.seed,
    prompt: `You have a strong hand on the river. Your opponent calls too much. The pot is ${pot}. Bet how many chips?`,
    table: { hole, board, pot, note: 'River. Your opponent calls too much.' },
    input: { kind: 'number', unit: 'chips' },
    grade(answer: Answer): GradeResult {
      const { correct } = chipsIn(answer, span);
      return {
        correct,
        correctLabel: chipsText(span),
        reason: rule.reason,
        working: [
          `The rule: bet ${potSpanText(rule.range)}.`,
          `${spanText(rule.range)} x ${pot} = ${chipsText(span)}`,
        ],
        sources: sizingSources(rules, 'D5'),
        draft: rules.draft,
      };
    },
  };
}

/** A river deal where your best hand is a straight or better, made with at least one of your own cards. */
export function dealStrongRiver(rng: Rng): { hole: Card[]; board: Card[] } {
  return until('D5', () => {
    const cards = deal(rng, 7);
    const hole = cards.slice(0, 2);
    const board = cards.slice(2);
    const mine = solve([...hole, ...board]);
    if (mine.rank < STRONG_CATEGORY) return null;
    return compareSolved(mine, solve(board)) === 1 ? { hole, board } : null;
  });
}

export function makeD5(rules: SizingRules): SkillDef {
  const rule = rules.rules.D5;
  const example = d5Question({
    seed: 0,
    rules,
    hole: ['Ac', 'Kc'],
    board: ['Qc', '9c', '4c', '2d', 'Jh'],
    pot: 120,
  });
  const exampleResult = example.grade({ kind: 'number', value: d5Span(rule, 120).min });

  return {
    id: 'D5',
    area: 'D',
    title: 'Value bet size against players who call too much',
    prereqs: ['D1'],
    draft: rules.draft,
    generate(seed): Question {
      const rng = rngFor('D5', seed);
      const { hole, board } = dealStrongRiver(rng);
      const pot = 5 * rng.int(4, 80);
      return d5Question({ seed, rules, hole, board, pot });
    },
    explainer: {
      body: [
        `A value bet is a bet made because you think a worse hand will call. Some players call too much, and against them a big value bet wins more. Bet ${potSpanText(rule.range)}. ${rule.reason}`,
        'These questions are on the river with a strong made hand, and the opponent is described as someone who calls too much. The size is a share of the pot, so turn it into chips.',
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
    furtherReading: sizingReading(rules, 'D5'),
  };
}

export const D5 = makeD5(sizingRules);
