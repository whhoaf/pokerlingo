import { describe, expect, it } from 'vitest';
import { needsExport } from '../../src/app/backupStatus';

const NOW = new Date('2026-10-25T08:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('needsExport', () => {
  it('is false for a brand new install', () => {
    expect(needsExport(null, 0, NOW)).toBe(false);
  });

  it('is true when there has never been an export and a session is finished', () => {
    expect(needsExport(null, 1, NOW)).toBe(true);
    expect(needsExport(null, 30, NOW)).toBe(true);
  });

  it('is false for a recent export', () => {
    expect(needsExport(daysAgo(0), 5, NOW)).toBe(false);
    expect(needsExport(daysAgo(3), 5, NOW)).toBe(false);
    expect(needsExport(daysAgo(7), 5, NOW)).toBe(false);
  });

  it('is true when the last export is more than 7 days old', () => {
    expect(needsExport(daysAgo(7.01), 5, NOW)).toBe(true);
    expect(needsExport(daysAgo(30), 5, NOW)).toBe(true);
  });

  it('ignores an export date it cannot read', () => {
    expect(needsExport('garbage', 5, NOW)).toBe(true);
  });
});
