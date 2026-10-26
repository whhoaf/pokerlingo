import { describe, expect, it } from 'vitest';
import { FRAME_MS, HEIGHT, PALETTES, REDUCED_SPEED, SPEED, WIDTH, blend, renderFrame, type Mood } from '../../src/app/background';
import { SUIT_ART, suitPath } from '../../src/app/suits';

function frame(t: number, mood: Mood = 'green') {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  renderFrame(data, t, PALETTES[mood]);
  return data;
}

const mean = (data: Uint8ClampedArray) => {
  const sum = [0, 0, 0];
  for (let k = 0; k < data.length; k += 4) for (let c = 0; c < 3; c++) sum[c]! += data[k + c]!;
  const n = data.length / 4;
  return sum.map((s) => s / n);
};

describe('background frames', () => {
  it('are the same for the same time and different later', () => {
    expect(frame(1.5)).toEqual(frame(1.5));
    expect(frame(1.5)).not.toEqual(frame(9));
  });

  it('are opaque and use only colours between the palette and its base', () => {
    const data = frame(3);
    const lo = [0, 1, 2].map((c) => Math.min(...PALETTES.green.map((p) => p[c]!)));
    const hi = [0, 1, 2].map((c) => Math.max(...PALETTES.green.map((p) => p[c]!)));
    for (let k = 0; k < data.length; k += 4) {
      expect(data[k + 3]).toBe(255);
      for (let c = 0; c < 3; c++) {
        expect(data[k + c]!).toBeGreaterThanOrEqual(lo[c]!);
        expect(data[k + c]!).toBeLessThanOrEqual(hi[c]!);
      }
    }
  });

  it('follow the mood: red is redder than green, blue bluer, purple has more red than green', () => {
    const green = mean(frame(2, 'green'));
    const red = mean(frame(2, 'red'));
    const blue = mean(frame(2, 'blue'));
    const purple = mean(frame(2, 'purple'));
    expect(green[1]).toBeGreaterThan(green[0]!);
    expect(red[0]).toBeGreaterThan(red[1]! * 1.5);
    expect(blue[2]).toBeGreaterThan(blue[0]!);
    expect(purple[0]).toBeGreaterThan(purple[1]!);
    expect(purple[2]).toBeGreaterThan(purple[1]!);
  });

  it('blend moves a share of the way between two palettes', () => {
    const half = blend(PALETTES.green, PALETTES.red, 0.5);
    expect(half[1]![0]).toBeCloseTo((PALETTES.green[1]![0]! + PALETTES.red[1]![0]!) / 2);
    expect(blend(PALETTES.green, PALETTES.red, 0)).toEqual(PALETTES.green.map((c) => [...c]));
  });

  it('runs at about 20 frames a second and a quarter of the speed with reduced motion', () => {
    expect(FRAME_MS).toBeGreaterThanOrEqual(50);
    expect(REDUCED_SPEED).toBe(SPEED / 4);
  });
});

describe('suit drawings', () => {
  it('are 9 by 9 pixels for all four suits', () => {
    for (const suit of 'shdc') {
      const art = SUIT_ART[suit]!;
      expect(art).toHaveLength(9);
      for (const row of art) expect(row).toMatch(/^[.#]{9}$/);
    }
  });

  it('make one path of runs whose area matches the pixel count', () => {
    for (const suit of 'shdc') {
      const pixels = SUIT_ART[suit]!.join('').split('#').length - 1;
      const area = [...suitPath(suit).matchAll(/h(\d+)v1/g)].reduce((sum, m) => sum + Number(m[1]), 0);
      expect(area).toBe(pixels);
    }
  });

  it('throws for an unknown suit', () => {
    expect(() => suitPath('x')).toThrow();
  });
});
