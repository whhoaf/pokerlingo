import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from '../../src/engine/rng';

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const as = Array.from({ length: 10 }, () => a.next());
    const bs = Array.from({ length: 10 }, () => b.next());
    expect(as).not.toEqual(bs);
  });

  it('keeps next() in [0, 1)', () => {
    const r = createRng(99);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('keeps int(min, max) in range and reaches both ends', () => {
    const r = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 8);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('int(n, n) returns n', () => {
    expect(createRng(1).int(5, 5)).toBe(5);
  });

  it('picks only members of the list', () => {
    const r = createRng(3);
    const list = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(list).toContain(r.pick(list));
  });

  it('throws when picking from an empty list', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it('shuffles without losing or adding items, and does not mutate the input', () => {
    const r = createRng(11);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copy = [...input];
    const out = r.shuffle(input);
    expect(input).toEqual(copy);
    expect([...out].sort((x, y) => x - y)).toEqual(copy);
  });

  it('shuffles deterministically', () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    expect(createRng(5).shuffle(list)).toEqual(createRng(5).shuffle(list));
  });

  it('accepts negative and large seeds', () => {
    expect(() => createRng(-5).next()).not.toThrow();
    expect(() => createRng(2 ** 40).next()).not.toThrow();
  });
});

describe('deriveSeed', () => {
  it('is deterministic and gives a 32-bit unsigned integer', () => {
    const a = deriveSeed(42, 3);
    expect(a).toBe(deriveSeed(42, 3));
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(2 ** 32);
  });

  it('differs for different salts', () => {
    expect(deriveSeed(42, 1)).not.toBe(deriveSeed(42, 2));
  });
});
