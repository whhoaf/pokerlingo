import type { GradeResult, Question } from '../engine/types';

/**
 * The choice buttons to show as right after an answer. A skill can name them itself (several sizes fit, or the chart
 * accepts two actions). Otherwise the button whose label is the correct answer.
 */
export function correctChoiceIds(question: Question, result: GradeResult | null | undefined): string[] | undefined {
  if (!result || question.input.kind !== 'choice') return undefined;
  if (result.correctIds) return result.correctIds;
  const match = question.input.options.find((o) => o.label === result.correctLabel);
  return match ? [match.id] : undefined;
}
