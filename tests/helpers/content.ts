import chartFixture from '../fixtures/house-chart.json';
import chartOdd from '../fixtures/house-chart-odd.json';
import sizingFixture from '../fixtures/sizing-rules.json';
import sizingOdd from '../fixtures/sizing-rules-odd.json';
import realChart from '../../content/house-chart.json';
import realSizing from '../../content/sizing-rules.json';
import type { HouseChart, SizingRules } from '../../src/content/types';

const chart = (json: unknown): HouseChart => json as HouseChart;
const sizing = (json: unknown): SizingRules => json as SizingRules;

/** A small chart with values the tests know by heart. */
export const FIXTURE_CHART = chart(chartFixture);
/** A chart with unusual shapes: empty ranges, other actions, narrow tables. */
export const ODD_CHART = chart(chartOdd);
/** The chart the app ships with, whatever it holds. */
export const REAL_CHART = chart(realChart);

export const FIXTURE_SIZING = sizing(sizingFixture);
export const ODD_SIZING = sizing(sizingOdd);
export const REAL_SIZING = sizing(realSizing);

/** Every chart the generic tests must pass with. */
export const ALL_CHARTS: [string, HouseChart][] = [
  ['shipped chart', REAL_CHART],
  ['fixture chart', FIXTURE_CHART],
  ['odd chart', ODD_CHART],
];

export const ALL_SIZING: [string, SizingRules][] = [
  ['shipped rules', REAL_SIZING],
  ['fixture rules', FIXTURE_SIZING],
  ['odd rules', ODD_SIZING],
];

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
