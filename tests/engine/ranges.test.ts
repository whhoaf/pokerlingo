import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';
import {
  combos,
  classOfCards,
  dealHand,
  expandToken,
  gridCell,
  HAND_CLASSES,
  isHandClass,
  isValidRange,
  kindOf,
  nearEdge,
  parseRange,
  pickByCombos,
  STRENGTH_ORDER,
  strengthIndex,
  totalCombos,
} from '../../src/engine/ranges';

const sorted = (set: Iterable<string>) => [...set].sort();

describe('hand classes', () => {
  it('has 169 distinct classes: 13 pairs, 78 suited, 78 offsuit', () => {
    expect(HAND_CLASSES).toHaveLength(169);
    expect(new Set(HAND_CLASSES).size).toBe(169);
    expect(HAND_CLASSES.filter((c) => kindOf(c) === 'pair')).toHaveLength(13);
    expect(HAND_CLASSES.filter((c) => kindOf(c) === 'suited')).toHaveLength(78);
    expect(HAND_CLASSES.filter((c) => kindOf(c) === 'offsuit')).toHaveLength(78);
  });

  it('counts 1,326 combinations in all', () => {
    expect(totalCombos(HAND_CLASSES)).toBe(1326);
    expect(combos('77')).toBe(6);
    expect(combos('AKs')).toBe(4);
    expect(combos('AKo')).toBe(12);
  });

  it('puts pairs on the diagonal, suited above it and offsuit below it', () => {
    expect(gridCell('AA')).toEqual({ row: 0, col: 0 });
    expect(gridCell('22')).toEqual({ row: 12, col: 12 });
    expect(gridCell('AKs')).toEqual({ row: 0, col: 1 });
    expect(gridCell('AKo')).toEqual({ row: 1, col: 0 });
    expect(gridCell('32s')).toEqual({ row: 11, col: 12 });
    const cells = new Set(HAND_CLASSES.map((c) => `${gridCell(c).row},${gridCell(c).col}`));
    expect(cells.size).toBe(169);
    for (const c of HAND_CLASSES) {
      const { row, col } = gridCell(c);
      expect(HAND_CLASSES[row * 13 + col]).toBe(c);
    }
  });

  it('recognises classes and rejects other text', () => {
    expect(isHandClass('AKs')).toBe(true);
    expect(isHandClass('KAs')).toBe(false);
    expect(isHandClass('AKx')).toBe(false);
    expect(() => kindOf('KAs')).toThrow();
  });

  it('names the class of two cards', () => {
    expect(classOfCards(['As', 'Ks'])).toBe('AKs');
    expect(classOfCards(['Kd', 'Ah'])).toBe('AKo');
    expect(classOfCards(['7c', '7h'])).toBe('77');
    expect(classOfCards(['2c', 'Td'])).toBe('T2o');
    expect(() => classOfCards(['As', 'As'])).toThrow();
    expect(() => classOfCards(['As'])).toThrow();
  });

  it('deals real cards that belong to the class, with the suits picked by the seed', () => {
    const rng = createRng(5);
    const suitsSeen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const cls = HAND_CLASSES[i % 169] as string;
      const cards = dealHand(rng, cls);
      expect(new Set(cards).size).toBe(2);
      expect(classOfCards(cards)).toBe(cls);
      suitsSeen.add(cards[0][1] as string);
    }
    expect(suitsSeen.size).toBe(4);
  });

  it('picks classes with the chance of a random deal', () => {
    const rng = createRng(11);
    const counts = new Map<string, number>();
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const c = pickByCombos(rng);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    // 12 offsuit combinations against 6 for a pair: twice as likely.
    const ratio = (counts.get('AKo') as number) / (counts.get('AA') as number);
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.6);
    expect(counts.size).toBe(169);
  });
});

describe('range notation', () => {
  it('expands pairs', () => {
    expect(sorted(parseRange('77'))).toEqual(['77']);
    expect(sorted(parseRange('TT+'))).toEqual(['AA', 'JJ', 'KK', 'QQ', 'TT']);
    expect(sorted(parseRange('22-66'))).toEqual(['22', '33', '44', '55', '66']);
    expect(sorted(parseRange('66-22'))).toEqual(['22', '33', '44', '55', '66']);
    expect(parseRange('22+').size).toBe(13);
  });

  it('expands single classes and both-suit shorthand', () => {
    expect(sorted(parseRange('AKs'))).toEqual(['AKs']);
    expect(sorted(parseRange('AKo'))).toEqual(['AKo']);
    expect(sorted(parseRange('AK'))).toEqual(['AKo', 'AKs']);
  });

  it('raises the kicker up to one below the top card', () => {
    expect(sorted(parseRange('ATs+'))).toEqual(['AJs', 'AKs', 'AQs', 'ATs']);
    expect(sorted(parseRange('KJo+'))).toEqual(['KJo', 'KQo']);
    expect(sorted(parseRange('QJs+'))).toEqual(['QJs']);
    expect(sorted(parseRange('AQ+'))).toEqual(['AKo', 'AKs', 'AQo', 'AQs']);
    expect(sorted(parseRange('A2s+'))).toHaveLength(12);
  });

  it('expands a run of kickers', () => {
    expect(sorted(parseRange('A2s-A5s'))).toEqual(['A2s', 'A3s', 'A4s', 'A5s']);
    expect(sorted(parseRange('A5o-A3o'))).toEqual(['A3o', 'A4o', 'A5o']);
  });

  it('expands a run of the same gap', () => {
    expect(sorted(parseRange('T9s-65s'))).toEqual(['65s', '76s', '87s', '98s', 'T9s']);
    expect(sorted(parseRange('J9o-86o'))).toEqual(['86o', '97o', 'J9o', 'T8o']);
  });

  it('joins tokens, ignores spaces and merges repeats', () => {
    expect(sorted(parseRange('77+, AJs+, KQs, AQo+'))).toEqual(
      sorted(['77', '88', '99', 'TT', 'JJ', 'QQ', 'KK', 'AA', 'AJs', 'AQs', 'AKs', 'KQs', 'AQo', 'AKo']),
    );
    expect(parseRange('AA,AA, AKs ,AKs').size).toBe(2);
  });

  it('treats an empty string as an empty range', () => {
    expect(parseRange('').size).toBe(0);
    expect(parseRange('  ').size).toBe(0);
  });

  it('throws on tokens it does not know', () => {
    const bad = [
      'XX',
      'A',
      'AKx',
      'KAs',
      'AAs',
      '7',
      '77++',
      '77s',
      'AK+s',
      'AA,',
      ',AA',
      'AA,,KK',
      'A2s-K5s',
      'A2s-A5o',
      '22-6',
      'T9s-64s',
      '22-66s',
      'AAo+',
      'ak',
      '10s',
      'KAs+',
    ];
    for (const text of bad) {
      expect(() => parseRange(text), text).toThrow();
      expect(isValidRange(text), text).toBe(false);
    }
  });

  it('only ever returns real classes', () => {
    for (const text of ['22+', 'A2s+', 'K2o+', '32s-T9s', 'A2s-A9s', 'Q2o-Q9o']) {
      for (const c of parseRange(text)) expect(isHandClass(c), `${text} gave ${c}`).toBe(true);
    }
    expect(expandToken(' 77+ ')).toHaveLength(8);
  });
});

describe('strength order', () => {
  it('lists all 169 classes once, with the aces first and the worst offsuit hand last', () => {
    expect(STRENGTH_ORDER).toHaveLength(169);
    expect(new Set(STRENGTH_ORDER).size).toBe(169);
    expect(STRENGTH_ORDER[0]).toBe('AA');
    expect(STRENGTH_ORDER.indexOf('72o')).toBeGreaterThan(120);
  });

  it('puts a suited hand above its offsuit twin and ranks obvious cases correctly', () => {
    for (const c of HAND_CLASSES) {
      if (c.length === 3 && c[2] === 'o') {
        expect(strengthIndex(`${c[0]}${c[1]}s`), c).toBeLessThan(strengthIndex(c));
      }
    }
    expect(strengthIndex('AA')).toBeLessThan(strengthIndex('KK'));
    expect(strengthIndex('AKs')).toBeLessThan(strengthIndex('AQs'));
    expect(strengthIndex('JJ')).toBeLessThan(strengthIndex('T9s'));
  });

  it('finds the hands around the edge of a range', () => {
    const range = parseRange('77+, AJs+, KQs, AQo+');
    const edge = nearEdge(range, 10);
    expect(edge.length).toBeGreaterThanOrEqual(11);
    expect(edge.length).toBeLessThanOrEqual(21);
    // The edge holds hands inside the range and hands outside it.
    expect(edge.some((c) => range.has(c))).toBe(true);
    expect(edge.some((c) => !range.has(c))).toBe(true);
    expect(nearEdge(new Set(), 10)).toEqual([]);
    expect(nearEdge(new Set(['AA']), 4)).toEqual(STRENGTH_ORDER.slice(0, 5));
  });
});
