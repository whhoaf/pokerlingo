import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatDueIn,
  formatPercent,
  formatShortDate,
  stateLabel,
} from '../../src/app/format';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('formatClock', () => {
  it('shows minutes and seconds', () => {
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(9_000)).toBe('0:09');
  });

  it('rounds up so the clock never shows 0:00 while time is left', () => {
    expect(formatClock(100)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(0.857)).toBe('86%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('shows a dash-free placeholder with no data', () => {
    expect(formatPercent(null)).toBe('n/a');
  });
});

describe('formatDueIn', () => {
  const now = at(2026, 10, 25, 9);

  it('says now for due skills', () => {
    expect(formatDueIn(at(2026, 10, 25, 8).toISOString(), now)).toBe('Due now');
    expect(formatDueIn(at(2026, 10, 20).toISOString(), now)).toBe('Due now');
  });

  it('says later today, tomorrow and in N days', () => {
    expect(formatDueIn(at(2026, 10, 25, 20).toISOString(), now)).toBe('Later today');
    expect(formatDueIn(at(2026, 10, 26, 10).toISOString(), now)).toBe('Tomorrow');
    expect(formatDueIn(at(2026, 10, 29, 10).toISOString(), now)).toBe('In 4 days');
  });

  it('gives a date for far-off reviews', () => {
    expect(formatDueIn(at(2026, 12, 20).toISOString(), now)).toBe('20 Dec');
  });
});

describe('formatShortDate', () => {
  it('uses day and short month', () => {
    expect(formatShortDate(at(2026, 10, 5).toISOString())).toBe('5 Oct');
  });
});

describe('stateLabel', () => {
  it('names each skill state', () => {
    expect(stateLabel('locked')).toBe('Locked');
    expect(stateLabel('new')).toBe('New');
    expect(stateLabel('learning')).toBe('Learning');
    expect(stateLabel('reviewing')).toBe('Reviewing');
    expect(stateLabel('strong')).toBe('Strong');
  });
});
