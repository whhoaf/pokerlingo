import { describe, expect, it } from 'vitest';
import { fullDeck, rankValue, suitOf } from '../../src/engine/cards';
import { classifyFlop, closestGap, fitsFiveRanks, isPaired, maxSuitCount, textureReason } from '../../src/engine/texture';
import { DASHES } from '../helpers/dashes';

describe('classifyFlop', () => {
  it('calls the plan examples dry and wet', () => {
    expect(classifyFlop(['Ks', '7h', '2d'])).toBe('dry');
    expect(classifyFlop(['Jh', 'Th', '8c'])).toBe('wet');
  });

  it('needs a rainbow flop to be dry', () => {
    expect(classifyFlop(['Ks', '7s', '2d'])).toBe('neither');
    expect(classifyFlop(['Ks', '7s', '2s'])).toBe('neither');
  });

  it('needs cards that are far apart to be dry', () => {
    expect(classifyFlop(['Ks', 'Qh', '2d'])).toBe('neither');
    expect(classifyFlop(['9s', '7h', '2d'])).toBe('neither'); // 9 and 7 are two apart
    expect(classifyFlop(['9s', '6h', '2d'])).toBe('dry'); // three apart
    expect(classifyFlop(['As', '3h', '9d'])).toBe('neither'); // the ace plays low, two from the three
    expect(classifyFlop(['As', '4h', '9d'])).toBe('dry');
  });

  it('never labels a paired flop', () => {
    expect(classifyFlop(['Ks', 'Kh', '2d'])).toBe('neither');
    expect(classifyFlop(['Js', 'Jh', 'Td'])).toBe('neither');
    expect(classifyFlop(['Jh', 'Jd', 'Th'])).toBe('neither');
  });

  it('needs a flush draw and connected cards to be wet', () => {
    expect(classifyFlop(['Jh', 'Td', '8c'])).toBe('neither'); // connected but rainbow
    expect(classifyFlop(['Kh', '7h', '2d'])).toBe('neither'); // two suited but spread out
    expect(classifyFlop(['9h', '8h', '7h'])).toBe('wet');
    expect(classifyFlop(['Ah', '3h', '5c'])).toBe('wet'); // the wheel
    expect(classifyFlop(['Qh', 'Jd', '9h'])).toBe('wet');
    expect(classifyFlop(['Qh', 'Jd', '8h'])).toBe('wet'); // Q to 8 is five ranks wide
    expect(classifyFlop(['Qh', 'Jd', '7h'])).toBe('neither'); // Q to 7 is six ranks wide
  });

  it('rejects a board that is not a flop', () => {
    expect(() => classifyFlop(['Ks', '7h'])).toThrow();
    expect(() => classifyFlop(['Ks', '7h', '2d', '3c'])).toThrow();
  });

  it('agrees with a window-by-window check on every possible flop', () => {
    const deck = fullDeck();
    const counts = { dry: 0, wet: 0, neither: 0, paired: 0 };
    // Straight windows with the ace low or high: A2345 up to TJQKA.
    const windows: number[][] = [];
    for (let low = 1; low <= 10; low++) windows.push([0, 1, 2, 3, 4].map((i) => low + i));
    const inWindow = (board: string[]): number =>
      Math.max(
        ...windows.map(
          (w) => board.filter((c) => w.includes(rankValue(c)) || (rankValue(c) === 14 && w.includes(1))).length,
        ),
      );
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        for (let k = j + 1; k < deck.length; k++) {
          const board = [deck[i], deck[j], deck[k]] as string[];
          const label = classifyFlop(board);
          counts[label]++;
          const suits = new Set(board.map(suitOf)).size;
          const ranks = new Set(board.map(rankValue)).size;
          if (ranks < 3) {
            counts.paired++;
            expect(label).toBe('neither');
            continue;
          }
          if (label === 'dry') {
            expect(suits).toBe(3);
            expect(inWindow(board)).toBeLessThanOrEqual(2);
          }
          if (label === 'wet') {
            expect(suits).toBeLessThanOrEqual(2);
            expect(inWindow(board)).toBe(3);
          }
          // Everything with a flush draw and three cards in a window is wet.
          if (suits <= 2 && inWindow(board) === 3) expect(label).toBe('wet');
          if (suits === 3 && closestGap(board) >= 3) expect(label).toBe('dry');
        }
      }
    }
    expect(counts.dry).toBeGreaterThan(1500);
    expect(counts.wet).toBeGreaterThan(300);
    expect(counts.neither).toBeGreaterThan(counts.dry);
    expect(counts.dry + counts.wet + counts.neither).toBe(22100);
  });
});

describe('helpers', () => {
  it('measures pairs, suits and gaps', () => {
    expect(isPaired(['Ks', 'Kh', '2d'])).toBe(true);
    expect(isPaired(['Ks', 'Qh', '2d'])).toBe(false);
    expect(maxSuitCount(['Ks', 'Qs', '2d'])).toBe(2);
    expect(maxSuitCount(['Ks', 'Qh', '2d'])).toBe(1);
    expect(closestGap(['Ks', '7h', '2d'])).toBe(5);
    expect(closestGap(['As', '2h', '9d'])).toBe(1);
    expect(fitsFiveRanks(['As', '2h', '5d'])).toBe(true);
    expect(fitsFiveRanks(['As', 'Kh', 'Td'])).toBe(true);
    expect(fitsFiveRanks(['As', '8h', 'Td'])).toBe(false);
  });

  it('explains each label in plain words without dashes', () => {
    for (const t of ['dry', 'wet', 'neither'] as const) {
      expect(textureReason(t).length).toBeGreaterThan(10);
      expect(textureReason(t)).not.toMatch(DASHES);
    }
  });
});
