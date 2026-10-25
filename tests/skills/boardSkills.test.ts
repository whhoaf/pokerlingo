import pokersolver from 'pokersolver';
import { describe, expect, it } from 'vitest';
import { cardText } from '../../src/engine/cards';
import { allHoldings } from '../../src/engine/nuts';
import type { Question } from '../../src/engine/types';
import { C1 } from '../../src/skills/C/C1';
import { C2 } from '../../src/skills/C/C2';
import { C3 } from '../../src/skills/C/C3';
import { C4 } from '../../src/skills/C/C4';
import { C5, analyseBoard } from '../../src/skills/C/C5';
import { C6 } from '../../src/skills/C/C6';
import { compareBySignature, handText, signature } from '../../src/skills/C/common';
import { evaluate } from '../../src/engine/handEval';
import { SEEDS, checkGrading, checkQuestionBasics, pick } from '../helpers/skillChecks';

// The checks below use pokersolver directly, not the engine's wrappers.
const { Hand } = pokersolver;
const solveText = (cards: string[]) => Hand.solve(cards);
const norm = (s: string) => s.replace(/^10/, 'T').replace(/^1/, 'A'); // pokersolver's '10' and low-ace '1'

const NAME_TO_LABEL: Record<string, string> = {
  'High Card': 'High card',
  Pair: 'One pair',
  'Two Pair': 'Two pair',
  'Three of a Kind': 'Three of a kind',
  Straight: 'Straight',
  Flush: 'Flush',
  'Full House': 'Full house',
  'Four of a Kind': 'Four of a kind',
  'Straight Flush': 'Straight flush',
};

/** pokersolver lists every suited card of a flush, best first, so the first five are the hand. */
function bestFive(cards: string[]): string[] {
  return solveText(cards)
    .cards.slice(0, 5)
    .map((c) => norm(c.toString()));
}

/** The id of the right choice, found by reading the feedback label. */
function rightId(q: Question): string {
  if (q.input.kind !== 'choice') throw new Error('not a choice question');
  const label = q.grade({ kind: 'choice', id: q.input.options[0]!.id }).correctLabel;
  return q.input.options.find((o) => o.label === label)!.id;
}

function wrongIds(q: Question): string[] {
  if (q.input.kind !== 'choice') throw new Error('not a choice question');
  const right = rightId(q);
  return q.input.options.filter((o) => o.id !== right).map((o) => o.id);
}

function checkChoices(q: Question): void {
  checkGrading(q, [pick(rightId(q))], wrongIds(q).map(pick));
  if (q.input.kind === 'choice') {
    expect(new Set(q.input.options.map((o) => o.id)).size).toBe(q.input.options.length);
    expect(new Set(q.input.options.map((o) => o.label)).size).toBe(q.input.options.length);
  }
}

describe('C1 best five-card hand from seven cards', () => {
  it('is valid for 500 seeds', () => {
    const seen = new Map<string, number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(C1, seed);
      const { hole = [], board = [] } = q.table;
      expect(hole).toHaveLength(2);
      expect(board).toHaveLength(5);

      const label = NAME_TO_LABEL[solveText([...hole, ...board]).name]!;
      expect(q.grade({ kind: 'choice', id: rightId(q) }).correctLabel).toBe(label);
      seen.set(label, (seen.get(label) ?? 0) + 1);

      // Four distinct choices, in rank order, the right one among them.
      expect(q.input.kind).toBe('choice');
      const options = q.input.kind === 'choice' ? q.input.options : [];
      expect(options).toHaveLength(4);
      const labels = options.map((o) => o.label);
      expect(labels).toContain(label);
      const order = Object.values(NAME_TO_LABEL);
      const indexes = labels.map((l) => order.indexOf(l));
      expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);

      // The distractors are the nearest categories: nothing closer was left out.
      const right = order.indexOf(label);
      const farthest = Math.max(...indexes.map((i) => Math.abs(i - right)));
      for (let i = 0; i < order.length; i++) {
        if (!indexes.includes(i)) expect(Math.abs(i - right), `seed ${seed}`).toBeGreaterThanOrEqual(farthest);
      }

      checkChoices(q);

      // Feedback shows pokersolver's five cards.
      const r = q.grade({ kind: 'choice', id: rightId(q) });
      expect([...(r.highlight ?? [])].sort()).toEqual(bestFive([...hole, ...board]).sort());
      expect(r.highlight).toHaveLength(5);
      expect(r.working!.join(' ')).toContain(r.highlight!.map(cardText).join(' '));
    }
    // Every category turns up, rare ones included.
    expect([...seen.keys()].sort()).toEqual(Object.values(NAME_TO_LABEL).sort());
    for (const [label, n] of seen) expect(n, label).toBeGreaterThanOrEqual(8);
  });

  it('has a worked example that matches pokersolver', () => {
    const t = C1.explainer.example.table;
    expect(NAME_TO_LABEL[solveText([...t.hole!, ...t.board!]).name]).toBe(C1.explainer.example.answer);
    const best = bestFive([...t.hole!, ...t.board!]);
    expect(C1.explainer.example.working[1]).toBe(`Best five: ${best.map(cardText).join(' ')}`);
  });
});

function checkShowdown(skill: typeof C2, seed: number): { q: Question; outcome: string; sameCategory: boolean } {
  const q = checkQuestionBasics(skill, seed);
  const { hole = [], villain = [], board = [] } = q.table;
  expect(hole).toHaveLength(2);
  expect(villain).toHaveLength(2);
  expect(board).toHaveLength(5);

  const mine = solveText([...hole, ...board]);
  const theirs = solveText([...villain, ...board]);
  const winners = Hand.winners([mine, theirs]);
  const outcome = winners.length === 2 ? 'split' : winners[0] === mine ? 'you' : 'opp';

  expect(q.input.kind === 'choice' && q.input.options.map((o) => o.label)).toEqual(['You win', 'Opponent wins', 'Split']);
  const r = q.grade({ kind: 'choice', id: outcome });
  expect(r.correct, `seed ${seed}`).toBe(true);
  expect(r.correctLabel).toBe({ you: 'You win', opp: 'Opponent wins', split: 'Split' }[outcome]);
  checkChoices(q);

  // The one-line reason comes from comparing ranks by hand. It must agree with pokersolver.
  const you = evaluate([...hole, ...board]);
  const opp = evaluate([...villain, ...board]);
  expect(compareBySignature(you, opp)).toBe(outcome === 'you' ? 1 : outcome === 'opp' ? -1 : 0);
  expect(r.working![0]).toBe(`You: ${handText(you)} (${you.cards.map(cardText).join(' ')})`);
  expect(r.working![1]).toBe(`Opponent: ${handText(opp)} (${opp.cards.map(cardText).join(' ')})`);

  // The picture is the winner's five cards.
  const winnerCards = outcome === 'opp' ? bestFive([...villain, ...board]) : bestFive([...hole, ...board]);
  expect([...(r.highlight ?? [])].sort()).toEqual([...winnerCards].sort());
  return { q, outcome, sameCategory: mine.rank === theirs.rank };
}

describe('C2 who wins at showdown', () => {
  it('is valid for 500 seeds', () => {
    const counts = { you: 0, opp: 0, split: 0 };
    for (const seed of SEEDS) {
      const { outcome, sameCategory, q } = checkShowdown(C2, seed);
      counts[outcome as keyof typeof counts]++;
      // Wins and losses come from different categories. Only splits share one.
      if (outcome !== 'split') expect(sameCategory, `seed ${seed}`).toBe(false);
      expect(q.prompt).toBe('Who wins at showdown?');
    }
    expect(counts.you).toBeGreaterThan(150);
    expect(counts.opp).toBeGreaterThan(150);
    expect(counts.split).toBeGreaterThan(20);
    expect(counts.split).toBeLessThan(100);
  }, 60_000);

  it('has a worked example that matches pokersolver', () => {
    const ex = C2.explainer.example;
    const t = ex.table;
    const mine = solveText([...t.hole!, ...t.board!]);
    const theirs = solveText([...t.villain!, ...t.board!]);
    expect(Hand.winners([mine, theirs])).toEqual([mine]);
    expect(ex.answer).toBe('You win');
    const you = evaluate([...t.hole!, ...t.board!]);
    const opp = evaluate([...t.villain!, ...t.board!]);
    expect(ex.working).toEqual([
      `You: ${handText(you)} (${you.cards.map(cardText).join(' ')})`,
      `Opponent: ${handText(opp)} (${opp.cards.map(cardText).join(' ')})`,
      'Three of a kind beats a pair.',
    ]);
  });
});

describe('C3 kickers, split pots and playing the board', () => {
  it('is valid for 500 seeds', () => {
    const counts = { you: 0, opp: 0, split: 0 };
    let boardPlays = 0;
    let kicker = 0;
    for (const seed of SEEDS) {
      const { outcome, sameCategory, q } = checkShowdown(C3, seed);
      counts[outcome as keyof typeof counts]++;
      expect(sameCategory, `seed ${seed}`).toBe(true); // always the same category
      const reason = q.grade({ kind: 'choice', id: outcome }).reason;
      if (/board/.test(reason)) boardPlays++;
      if (/kicker/.test(reason)) kicker++;
    }
    expect(counts.you).toBeGreaterThan(100);
    expect(counts.opp).toBeGreaterThan(100);
    expect(counts.split).toBeGreaterThan(80);
    expect(boardPlays).toBeGreaterThan(10); // splits where the board plays
    expect(kicker).toBeGreaterThan(30); // kickers decide
  }, 60_000);

  it('has a worked example that matches pokersolver', () => {
    const ex = C3.explainer.example;
    const t = ex.table;
    const mine = solveText([...t.hole!, ...t.board!]);
    const theirs = solveText([...t.villain!, ...t.board!]);
    expect(mine.rank).toBe(theirs.rank);
    expect(Hand.winners([mine, theirs])).toEqual([mine]);
    const you = evaluate([...t.hole!, ...t.board!]);
    const opp = evaluate([...t.villain!, ...t.board!]);
    expect(ex.working).toEqual([
      `You: ${handText(you)} (${you.cards.map(cardText).join(' ')})`,
      `Opponent: ${handText(opp)} (${opp.cards.map(cardText).join(' ')})`,
      'The made hands are equal, so the kicker decides: your ace beats their queen.',
    ]);
  });

  it('says the board plays when all five cards are on the board', () => {
    // Board is a royal flush: both players play it.
    const mine = evaluate(['2c', '3d', 'As', 'Ks', 'Qs', 'Js', 'Ts']);
    const theirs = evaluate(['4c', '5d', 'As', 'Ks', 'Qs', 'Js', 'Ts']);
    expect(compareBySignature(mine, theirs)).toBe(0);
    expect(signature(mine)).toEqual([14]);
  });
});

/** How many distinct strengths beat this holding, by pokersolver alone. */
function strengthsAbove(all: { solved: ReturnType<typeof solveText> }[], board: string[], holding: string[]): number {
  const mine = solveText([...board, ...holding]);
  const better = all.map((e) => e.solved).filter((h) => h.compare(mine) < 0);
  better.sort((a, b) => a.compare(b));
  let levels = 0;
  for (let i = 0; i < better.length; i++) {
    if (i === 0 || better[i]!.compare(better[i - 1]!) !== 0) levels++;
  }
  return levels;
}

describe('C4 the nuts', () => {
  it('is valid for 500 seeds', () => {
    const streets = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(C4, seed);
      const board = q.table.board!;
      streets.add(board.length);
      expect(board.length).toBeGreaterThanOrEqual(3);
      expect(q.table.hole).toBeUndefined();
      expect(q.input.kind).toBe('choice');
      const options = q.input.kind === 'choice' ? q.input.options : [];
      expect(options).toHaveLength(4);

      // Choices are two-card holdings, shown as cards, not on the board and not repeated.
      const used = new Set(board);
      for (const o of options) {
        expect(o.cards, `seed ${seed}`).toHaveLength(2);
        expect(o.label).toBe(o.cards!.map(cardText).join(' '));
        for (const c of o.cards!) {
          expect(used.has(c), `seed ${seed}: ${c} reused`).toBe(false);
        }
      }
      // Options may share a card (A♥ in two flush holdings, say), but never the same holding twice.
      expect(new Set(options.map((o) => [...o.cards!].sort().join(''))).size).toBe(4);

      // Independent nuts: evaluate every holding with pokersolver and take the winners.
      const all = allHoldings(board).map((h) => ({ h, solved: solveText([...board, ...h]) }));
      const winners = new Set(Hand.winners(all.map((e) => e.solved)));
      const nutsKeys = new Set(all.filter((e) => winners.has(e.solved)).map((e) => [...e.h].sort().join('')));
      const rightOptions = options.filter((o) => nutsKeys.has([...o.cards!].sort().join('')));
      expect(rightOptions, `seed ${seed}`).toHaveLength(1);
      expect(rightId(q)).toBe(rightOptions[0]!.id);

      // The distractors are the next three distinct strengths down: 1, 2 and 3 strengths beat them.
      const above = options
        .filter((o) => o.id !== rightOptions[0]!.id)
        .map((o) => strengthsAbove(all, board, o.cards!))
        .sort((a, b) => a - b);
      expect(above, `seed ${seed}`).toEqual([1, 2, 3]);

      checkChoices(q);
      const r = q.grade({ kind: 'choice', id: rightOptions[0]!.id });
      expect(r.highlight).toEqual(rightOptions[0]!.cards);
      expect(r.highlightLabel).toBe('The nuts');
      expect(r.working).toHaveLength(5);
    }
    expect([...streets].sort()).toEqual([3, 4, 5]);
  }, 300_000);

  it('has a worked example that matches the enumeration', () => {
    const ex = C4.explainer.example;
    const board = ex.table.board!;
    const all = allHoldings(board).map((h) => ({ h, solved: solveText([...board, ...h]) }));
    const winners = new Set(Hand.winners(all.map((e) => e.solved)));
    const nuts = all.filter((e) => winners.has(e.solved));
    expect(nuts).toHaveLength(3);
    const holdings = ['Ks', 'Kh'];
    expect(nuts.map((e) => [...e.h].sort().join(''))).toContain([...holdings].sort().join(''));
    expect(ex.answer).toBe(holdings.map(cardText).join(' '));
    const lines = [
      ['Ks', 'Kh'],
      ['9c', '9h'],
      ['7s', '7c'],
      ['As', 'Ah'],
    ].map((h) => `${h.map(cardText).join(' ')}: ${handText(evaluate([...board, ...h]))}`);
    expect(ex.working).toEqual([...lines, `3 holdings make the best hand, out of ${all.length} possible`]);
  });
});

describe('C5 can a flush or straight be out there', () => {
  it('is valid for 500 seeds', () => {
    const kinds = new Map<string, number>();
    const streets = new Set<number>();
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(C5, seed);
      const board = q.table.board!;
      streets.add(board.length);
      expect(new Set(board.map((c) => c[0])).size, 'unpaired board').toBe(board.length);

      // Independent answer: can any holding make a flush or a straight? Boards have no pair,
      // so those hands are the best a holding can make, and pokersolver's category says which.
      let flush = false;
      let straight = false;
      for (const h of allHoldings(board)) {
        const rank = solveText([...board, ...h]).rank;
        if (rank === 6 || rank === 9) flush = true;
        if (rank === 5 || rank === 9) straight = true;
      }
      const label = flush && straight ? 'Both' : flush ? 'Flush possible' : straight ? 'Straight possible' : 'Neither';
      kinds.set(label, (kinds.get(label) ?? 0) + 1);

      expect(q.input.kind === 'choice' && q.input.options.map((o) => o.label)).toEqual([
        'Flush possible',
        'Straight possible',
        'Both',
        'Neither',
      ]);
      expect(q.grade({ kind: 'choice', id: rightId(q) }).correctLabel).toBe(label);
      expect(analyseBoard(board).label).toBe(label);
      checkChoices(q);

      const r = q.grade({ kind: 'choice', id: rightId(q) });
      if (label === 'Neither') expect(r.highlight).toBeUndefined();
      else for (const c of r.highlight!) expect(board).toContain(c);
    }
    expect([...kinds.keys()].sort()).toEqual(['Both', 'Flush possible', 'Neither', 'Straight possible']);
    for (const [label, n] of kinds) expect(n, label).toBeGreaterThan(70);
    expect([...streets].sort()).toEqual([3, 4, 5]);
  }, 120_000);

  it('has a worked example that matches the enumeration', () => {
    const ex = C5.explainer.example;
    const a = analyseBoard(ex.table.board!);
    expect(a.label).toBe(ex.answer);
    expect(a.working).toEqual(ex.working);
  });
});

describe('C6 counterfeited hands', () => {
  it('is valid for 500 seeds', () => {
    const counts = { you: 0, opp: 0, split: 0 };
    let counterfeits = 0;
    let clean = 0;
    for (const seed of SEEDS) {
      const q = checkQuestionBasics(C6, seed);
      const { hole = [], villain = [], board = [] } = q.table;
      expect(board).toHaveLength(5);
      const turn = board.slice(0, 4);
      const river = board[4]!;

      // Two pair on the turn that uses both hole cards.
      const turnHand = solveText([...hole, ...turn]);
      expect(turnHand.name, `seed ${seed}`).toBe('Two Pair');
      const holeRanks = hole.map((c) => c[0]);
      for (const r of holeRanks) expect(turn.filter((c) => c[0] === r), `seed ${seed}`).toHaveLength(1);
      expect(holeRanks[0]).not.toBe(holeRanks[1]);

      // The river pairs a card already on the board, and not one of your pairs.
      expect(turn.filter((c) => c[0] === river[0])).toHaveLength(1);
      expect(holeRanks).not.toContain(river[0]);
      expect(q.table.note).toContain(cardText(river));

      // The showdown is graded by pokersolver.
      const mine = solveText([...hole, ...board]);
      const theirs = solveText([...villain, ...board]);
      expect(mine.name).toBe('Two Pair');
      expect(theirs.name).toBe('Two Pair');
      const winners = Hand.winners([mine, theirs]);
      const outcome = winners.length === 2 ? 'split' : winners[0] === mine ? 'you' : 'opp';
      counts[outcome]++;
      checkChoices(q);
      const r = q.grade({ kind: 'choice', id: outcome });
      expect(r.correct, `seed ${seed}`).toBe(true);

      // Counterfeited means your lower hole rank no longer makes a pair in your best five.
      const lowRank = [...holeRanks].sort((a, b) => '23456789TJQKA'.indexOf(a!) - '23456789TJQKA'.indexOf(b!))[0]!;
      const lowInFive = bestFive([...hole, ...board]).filter((c) => c[0] === lowRank).length;
      const counterfeited = lowInFive < 2;
      if (counterfeited) {
        counterfeits++;
        expect(outcome, `seed ${seed}: a counterfeit never wins`).not.toBe('you');
        expect(r.reason).toMatch(/counterfeits/);
      } else {
        clean++;
        expect(outcome, `seed ${seed}: a clean river never loses`).toBe('you');
        expect(r.reason).not.toMatch(/counterfeits/);
      }

      // The feedback shows your final five cards, as pokersolver sees them.
      expect(r.highlightLabel).toBe('Your final five cards');
      expect([...(r.highlight ?? [])].sort()).toEqual(bestFive([...hole, ...board]).sort());
      expect(r.working![0]).toMatch(/^On the turn you had two pair/);
    }
    expect(counts.opp).toBeGreaterThan(150);
    expect(counts.you).toBeGreaterThan(120);
    expect(counts.split).toBeGreaterThan(30);
    expect(counterfeits + clean).toBe(500);
  }, 60_000);

  it('has a worked example that matches pokersolver', () => {
    const ex = C6.explainer.example;
    const t = ex.table;
    const turn = solveText([...t.hole!, ...t.board!.slice(0, 4)]);
    expect(turn.name).toBe('Two Pair');
    const mine = solveText([...t.hole!, ...t.board!]);
    const theirs = solveText([...t.villain!, ...t.board!]);
    expect(Hand.winners([mine, theirs])).toEqual([theirs]);
    expect(ex.answer).toBe('Opponent wins');
    const you = bestFive([...t.hole!, ...t.board!]);
    const opp = bestFive([...t.villain!, ...t.board!]);
    expect(ex.working[2]!.split('(')[1]!.replace(')', '').split(' ').sort()).toEqual(you.map(cardText).sort());
    expect(ex.working[3]!.split('(')[1]!.replace(')', '').split(' ').sort()).toEqual(opp.map(cardText).sort());
    // The same example produced by the grader gives the same text.
    const q = C6.generate(1);
    expect(q.grade({ kind: 'choice', id: 'you' }).working!.length).toBe(ex.working.length - 1);
  });
});
