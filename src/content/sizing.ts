// Turning a sizing rule into the numbers a question accepts.

import type { SizingRules, Span } from './types';

/** The pot fractions D4 offers as choices. */
export const POT_FRACTIONS = [
  { id: '1/4', label: '1/4 pot', value: 1 / 4 },
  { id: '1/3', label: '1/3 pot', value: 1 / 3 },
  { id: '1/2', label: '1/2 pot', value: 1 / 2 },
  { id: '2/3', label: '2/3 pot', value: 2 / 3 },
  { id: '3/4', label: '3/4 pot', value: 3 / 4 },
  { id: '1', label: 'Pot', value: 1 },
] as const;

/** A written fraction such as 0.33 or 0.67 counts as 1/3 or 2/3: choices match a range within this much. */
export const POT_TOLERANCE = 0.01;

/** Which of the D4 choices fall inside a range. */
export function fractionsInside(span: Span): string[] {
  return POT_FRACTIONS.filter((f) => f.value >= span.min - POT_TOLERANCE && f.value <= span.max + POT_TOLERANCE).map(
    (f) => f.id,
  );
}

/** Whole chips from a span of multipliers and a base amount. Both ends are rounded to the nearest chip. */
export function chipSpan(span: Span, base: number): Span {
  return { min: Math.round(span.min * base), max: Math.round(span.max * base) };
}

export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;

/** D2: the accepted raise in chips, for a number of limpers. The rule counts big blinds. */
export function d2Span(rule: SizingRules['rules']['D2'], limpers: number): Span {
  const extra = rule.perLimper * limpers;
  return chipSpan({ min: rule.base.min + extra, max: rule.base.max + extra }, BIG_BLIND);
}

/** D3: the accepted re-raise in chips for an open of `open` chips. */
export function d3Span(rule: SizingRules['rules']['D3'], open: number, inPosition: boolean): Span {
  return chipSpan(inPosition ? rule.inPosition : rule.outOfPosition, open);
}

/** D5: the accepted bet in chips for a pot. */
export function d5Span(rule: SizingRules['rules']['D5'], pot: number): Span {
  return chipSpan(rule.range, pot);
}

/** 3, 3.5 and 0.66 as plain text: no trailing zeros. */
export function trim(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** '4 to 5' or '3' when both ends are equal. */
export function spanText(span: Span, suffix = ''): string {
  return span.min === span.max ? `${trim(span.min)}${suffix}` : `${trim(span.min)} to ${trim(span.max)}${suffix}`;
}

/** A pot fraction as a share of the pot in words: '0.25 to 0.5 of the pot'. */
export function potSpanText(span: Span): string {
  return `${spanText(span)} of the pot`;
}
