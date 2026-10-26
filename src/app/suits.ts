/**
 * The four suits as 9 by 9 pixel drawings. Each '#' is one pixel. scripts/make_icons.py draws the app
 * icon from the same spade, so change both together.
 */
export const SUIT_ART: Record<string, readonly string[]> = {
  s: [
    '....#....',
    '...###...',
    '..#####..',
    '.#######.',
    '#########',
    '#########',
    '.##.#.##.',
    '....#....',
    '...###...',
  ],
  h: [
    '.##...##.',
    '####.####',
    '#########',
    '#########',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  d: [
    '....#....',
    '...###...',
    '..#####..',
    '.#######.',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  c: [
    '...###...',
    '..#####..',
    '..#####..',
    '.##.#.##.',
    '#########',
    '#########',
    '.##.#.##.',
    '....#....',
    '...###...',
  ],
};

const paths = new Map<string, string>();

/** SVG path data for a suit: one rectangle per horizontal run of pixels. */
export function suitPath(suit: string): string {
  const known = paths.get(suit);
  if (known !== undefined) return known;
  const art = SUIT_ART[suit];
  if (!art) throw new Error(`Unknown suit: ${suit}`);
  let d = '';
  art.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) {
      d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
    }
  });
  paths.set(suit, d);
  return d;
}
