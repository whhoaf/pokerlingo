// Types of the two content files: content/house-chart.json and content/sizing-rules.json.
// Everything the player is taught about hands and bet sizes comes from these files, never from code.

export interface Source {
  title: string;
  site: string;
  url: string;
}

/** The one placeholder source. Allowed only while a file is a draft. */
export const TBD_SOURCE = 'TBD';

/** The actions a chart can ask for, and the label on the button for each. */
export const ACTION_LABELS = {
  raise: 'Raise',
  call: 'Call',
  check: 'Check',
  reraise: 'Re-raise',
  fold: 'Fold',
} as const;

export type Action = keyof typeof ACTION_LABELS;

export const ACTIONS = Object.keys(ACTION_LABELS) as Action[];

export function isAction(text: unknown): text is Action {
  return typeof text === 'string' && Object.prototype.hasOwnProperty.call(ACTION_LABELS, text);
}

/** Every situation the house chart must describe. */
export const SITUATION_IDS = [
  'open.EP',
  'open.LJ',
  'open.HJ',
  'open.CO',
  'open.BTN',
  'open.SB',
  'limpers.early',
  'limpers.late',
  'limpers.SB',
  'limpers.BB',
  'raise.vsEarly',
  'raise.vsLate',
  'bb.vsRaise',
] as const;

export type SituationId = (typeof SITUATION_IDS)[number];

export interface EitherEntry {
  /** A range string. Each hand in it accepts every action in `accept`. */
  hands: string;
  accept: Action[];
}

export interface Situation {
  title: string;
  /** Seats the player can be in. A seat matches by name, or by chart row (LJ also covers the first seat at 6 players). */
  seats: string[];
  /** Table sizes, smallest and largest. */
  players: [number, number];
  choices: Action[];
  /** One range string per action. Hands not listed anywhere take `default`. */
  ranges: Partial<Record<Action, string>>;
  either?: EitherEntry[];
  default: Action;
  reason: string;
  sources: string[];
  /** How many limpers a question may show, smallest and largest. Used by the limpers situations. */
  limpers?: [number, number];
  /** Seats a raise can come from. Used by the raise situations and bb.vsRaise. */
  raiser?: string[];
}

export interface HouseChart {
  version: 1;
  draft: boolean;
  sources: Record<string, Source>;
  situations: Record<SituationId, Situation>;
}

/** A closed range of numbers: the answer is right anywhere from `min` to `max`. */
export interface Span {
  min: number;
  max: number;
}

interface RuleBase {
  title: string;
  reason: string;
  sources: string[];
}

export interface SizingRules {
  version: 1;
  draft: boolean;
  sources: Record<string, Source>;
  rules: {
    /** Preflop raise, in big blinds: `base` plus `perLimper` for each limper. */
    D2: RuleBase & { unit: 'bb'; base: Span; perLimper: number };
    /** Re-raise, as a multiple of the open. */
    D3: RuleBase & { unit: 'x'; inPosition: Span; outOfPosition: Span };
    /** Continuation bet, as a fraction of the pot. */
    D4: RuleBase & { unit: 'pot'; dry: Span; wet: Span };
    /** Value bet against a player who calls too much, as a fraction of the pot. */
    D5: RuleBase & { unit: 'pot'; range: Span };
  };
}

export type RuleId = keyof SizingRules['rules'];

export const RULE_IDS: RuleId[] = ['D2', 'D3', 'D4', 'D5'];

/** The unit each rule must use. */
export const RULE_UNITS: Record<RuleId, string> = { D2: 'bb', D3: 'x', D4: 'pot', D5: 'pot' };
