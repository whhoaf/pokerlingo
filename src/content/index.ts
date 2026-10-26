// The two content files, imported at build time. Tests check that they are valid (tests/content).

import chartJson from '../../content/house-chart.json';
import rulesJson from '../../content/sizing-rules.json';
import type { HouseChart, SizingRules, Source } from './types';

export const houseChart = chartJson as unknown as HouseChart;
export const sizingRules = rulesJson as unknown as SizingRules;

/** A source as one line of text, for feedback: 'Title, site'. */
export function sourceText(source: Source): string {
  return source.site ? `${source.title}, ${source.site}` : source.title;
}

/** The source lines for a list of source IDs, in order. */
export function sourceLines(sources: Record<string, Source>, ids: readonly string[]): string[] {
  return ids.map((id) => sources[id]).filter((s): s is Source => s !== undefined).map(sourceText);
}

/** Links for further reading: the cited sources that have a web address. */
export function sourceLinks(
  sources: Record<string, Source>,
  ids: readonly string[],
): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const id of ids) {
    const s = sources[id];
    if (s && s.url && !out.some((l) => l.url === s.url)) out.push({ label: sourceText(s), url: s.url });
  }
  return out;
}
