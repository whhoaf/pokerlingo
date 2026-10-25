import { describe, expect, it } from 'vitest';
import { addDays, currentStreak, dayKey, dayStart } from '../../src/engine/day';

// Dates are built in local time, so these tests pass in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('dayKey', () => {
  it('uses the local date in the afternoon', () => {
    expect(dayKey(at(2026, 10, 25, 15, 30))).toBe('2026-10-25');
  });

  it('counts 3:59am as the day before', () => {
    expect(dayKey(at(2026, 10, 25, 3, 59))).toBe('2026-10-24');
  });

  it('starts the new day at 4:00am', () => {
    expect(dayKey(at(2026, 10, 25, 4, 0))).toBe('2026-10-25');
  });

  it('counts a late-night session for the day it started', () => {
    expect(dayKey(at(2026, 10, 25, 23, 50))).toBe('2026-10-25');
    expect(dayKey(at(2026, 10, 26, 0, 20))).toBe('2026-10-25');
  });

  it('rolls back across month and year ends', () => {
    expect(dayKey(at(2026, 11, 1, 2, 0))).toBe('2026-10-31');
    expect(dayKey(at(2027, 1, 1, 1, 0))).toBe('2026-12-31');
  });

  it('pads single digits', () => {
    expect(dayKey(at(2026, 3, 5, 12, 0))).toBe('2026-03-05');
  });
});

describe('dayStart', () => {
  it('is 4am local time on the date', () => {
    expect(dayStart('2026-10-25').getTime()).toBe(at(2026, 10, 25, 4, 0).getTime());
  });

  it('agrees with dayKey', () => {
    expect(dayKey(dayStart('2026-10-25'))).toBe('2026-10-25');
    expect(dayKey(new Date(dayStart('2026-10-25').getTime() - 1))).toBe('2026-10-24');
  });
});

describe('addDays', () => {
  it('moves forwards and backwards over month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('currentStreak', () => {
  it('is zero with no sessions', () => {
    expect(currentStreak([], '2026-10-25')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-10-23', '2026-10-24', '2026-10-25'], '2026-10-25')).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    expect(currentStreak(['2026-10-23', '2026-10-24'], '2026-10-25')).toBe(2);
  });

  it('resets after a missed day', () => {
    expect(currentStreak(['2026-10-22', '2026-10-23'], '2026-10-25')).toBe(0);
  });

  it('stops counting at a gap', () => {
    expect(currentStreak(['2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24')).toBe(3);
  });

  it('counts several sessions on one day once', () => {
    expect(currentStreak(['2026-10-24', '2026-10-24', '2026-10-25', '2026-10-25'], '2026-10-25')).toBe(2);
  });

  it('ignores unsorted input order', () => {
    expect(currentStreak(['2026-10-25', '2026-10-23', '2026-10-24'], '2026-10-25')).toBe(3);
  });

  it('works across a month boundary', () => {
    expect(currentStreak(['2026-10-30', '2026-10-31', '2026-11-01'], '2026-11-01')).toBe(3);
  });
});
