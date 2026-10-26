export type Area = 'A' | 'B' | 'C' | 'D';
export type Card = string; // pokersolver notation: rank (2-9, T, J, Q, K, A) + suit (s, h, d, c)

/** One seat in the picture of the table. */
export interface RingSeat {
  /** The seat name, or null to hide it (a seat is highlighted but not named). */
  name: string | null;
  /** The dealer button sits here. */
  button?: boolean;
  /** You, a limper, the raiser, a seat that folded, or the seat a question asks about. */
  role?: 'you' | 'limp' | 'raise' | 'fold' | 'focus';
  /** A short word under the seat, for example 'Limp'. */
  tag?: string;
}

/** Seats in the order they act before the flop (clockwise). The seat at `focus` is drawn at the bottom. */
export interface SeatRing {
  seats: RingSeat[];
  focus: number;
}

/** The 13 by 13 grid of one chart situation, with one action per hand class. */
export interface RangeGridView {
  title: string;
  /** All 169 classes. `borderline` marks hands the chart accepts two actions for. */
  cells: Record<string, { action: string; borderline: boolean }>;
  /** The actions used in this situation, in button order, with their labels. */
  legend: { action: string; label: string }[];
  /** The class to outline. */
  yours?: string;
}

export interface TableView {
  ring?: SeatRing; // the table with its seats (Areas A and D)
  hole?: Card[]; // your cards
  board?: Card[]; // 0, 3, 4 or 5 cards
  villain?: Card[]; // only in showdown questions
  pot?: number; // pot before the current bet, in chips
  bet?: number; // amount you must call
  seat?: string; // e.g. 'BTN'
  players?: number; // table size
  note?: string; // one line of context, e.g. 'One card to come'
}

export type AnswerInput =
  | { kind: 'choice'; options: { id: string; label: string; cards?: Card[] }[] }
  | { kind: 'number'; unit: 'outs' | '%' | 'chips' | 'bb' };

export type Answer = { kind: 'choice'; id: string } | { kind: 'number'; value: number };

export interface GradeResult {
  correct: boolean;
  correctLabel: string; // e.g. '9 outs', 'Call'
  reason: string; // one line
  working?: string[]; // short lines, e.g. ['You need 25%', 'You have about 18%']
  highlight?: Card[]; // cards to highlight in feedback
  highlightLabel?: string; // what the highlighted cards are, e.g. 'The nuts'; default is 'Your outs'
  correctIds?: string[]; // choice ids that count as right, when the label alone cannot say (several answers, or either)
  rangeGrid?: RangeGridView; // the chart picture for Area A
  sources?: string[]; // where the advice comes from, one line each
  draft?: boolean; // the advice comes from a draft content file
}

export interface Question {
  skillId: string;
  seed: number;
  prompt: string;
  table: TableView;
  input: AnswerInput;
  grade(answer: Answer): GradeResult;
}

export interface SkillDef {
  id: string; // 'B1' and so on, stable forever
  area: Area;
  title: string;
  prereqs: string[];
  generate(seed: number): Question; // deterministic for a given seed
  explainer: {
    body: string[]; // short paragraphs, one screen in total
    example: {
      prompt: string;
      table: TableView;
      answer: string;
      working: string[];
      rangeGrid?: RangeGridView;
      sources?: string[];
    };
  };
  furtherReading?: { label: string; url: string }[];
  /** True when the advice comes from a content file that is still a draft. Shown as a note. */
  draft?: boolean;
}
