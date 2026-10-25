export type Area = 'A' | 'B' | 'C' | 'D';
export type Card = string; // pokersolver notation: rank (2-9, T, J, Q, K, A) + suit (s, h, d, c)

export interface TableView {
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
    example: { prompt: string; table: TableView; answer: string; working: string[] };
  };
  furtherReading?: { label: string; url: string }[];
}
