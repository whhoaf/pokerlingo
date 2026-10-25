// Every function here returns a percentage from 0 to 100, not rounded.

/**
 * The equity you need to break even on a call.
 * `pot` is the pot before the bet. Calling `bet` to win `pot + bet` needs
 * bet / (pot + 2 * bet).
 */
export function requiredEquity(pot: number, bet: number): number {
  if (!(bet > 0) || pot < 0) throw new Error('Needs a positive bet and a pot of zero or more');
  return (bet / (pot + 2 * bet)) * 100;
}

/** The rule of 2 and 4: outs times 2 with one card to come, times 4 with two. */
export function ruleOf2And4(outs: number, cardsToCome: 1 | 2): number {
  return outs * (cardsToCome === 1 ? 2 : 4);
}

/** Chance of hitting at least one out, with `unseen` cards left to draw from. */
export function exactEquity(outs: number, unseen: number, cardsToCome: 1 | 2): number {
  if (outs < 0 || outs > unseen) throw new Error('Outs must be between 0 and the unseen cards');
  if (cardsToCome === 1) return (outs / unseen) * 100;
  const misses = unseen - outs;
  const allMiss = (misses * (misses - 1)) / (unseen * (unseen - 1));
  return (1 - allMiss) * 100;
}

export function roundTo(value: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
