import { describe, expect, it } from 'vitest';
import {
  backFromButton,
  chartSeat,
  hasSeat,
  isBlind,
  isSeatName,
  openersBefore,
  seatMatches,
  seatNames,
  seatsBefore,
} from '../../src/engine/seats';

describe('seat names', () => {
  it('lists the seats of each table size in the order they act', () => {
    expect(seatNames(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(seatNames(7)).toEqual(['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(seatNames(8)).toEqual(['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(seatNames(9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('has as many seats as players, ending BTN, SB, BB', () => {
    for (let n = 6; n <= 9; n++) {
      const names = seatNames(n);
      expect(names).toHaveLength(n);
      expect(new Set(names).size).toBe(n);
      expect(names.slice(-3)).toEqual(['BTN', 'SB', 'BB']);
      for (const s of names) expect(isSeatName(s)).toBe(true);
    }
  });

  it('counts back from the button', () => {
    expect(backFromButton('BTN', 9)).toBe(0);
    expect(backFromButton('CO', 9)).toBe(1);
    expect(backFromButton('HJ', 9)).toBe(2);
    expect(backFromButton('LJ', 9)).toBe(3);
    expect(backFromButton('UTG+2', 9)).toBe(4);
    expect(backFromButton('UTG+1', 9)).toBe(5);
    expect(backFromButton('UTG', 9)).toBe(6);
    expect(backFromButton('UTG', 6)).toBe(3);
    expect(backFromButton('SB', 9)).toBeNull();
    expect(backFromButton('BB', 6)).toBeNull();
    expect(() => backFromButton('LJ', 6)).toThrow();
  });

  it('rejects table sizes outside 6 to 9', () => {
    for (const n of [0, 2, 5, 10, 6.5, Number.NaN]) expect(() => seatNames(n), String(n)).toThrow();
  });

  it('knows which seats exist', () => {
    expect(hasSeat('LJ', 6)).toBe(false);
    expect(hasSeat('LJ', 7)).toBe(true);
    expect(hasSeat('UTG+2', 8)).toBe(false);
    expect(hasSeat('UTG+2', 9)).toBe(true);
  });
});

describe('chart rows', () => {
  it('maps the first seat at 6 players to the lojack row', () => {
    expect(chartSeat('UTG', 6)).toBe('LJ');
  });

  it('maps the early seats at 7 to 9 players to EP', () => {
    expect(chartSeat('UTG', 7)).toBe('EP');
    expect(chartSeat('UTG', 9)).toBe('EP');
    expect(chartSeat('UTG+1', 8)).toBe('EP');
    expect(chartSeat('UTG+2', 9)).toBe('EP');
  });

  it('leaves the other seats as they are', () => {
    for (let n = 6; n <= 9; n++) {
      for (const s of ['HJ', 'CO', 'BTN', 'SB', 'BB']) expect(chartSeat(s, n)).toBe(s);
    }
    expect(chartSeat('LJ', 7)).toBe('LJ');
    expect(chartSeat('LJ', 9)).toBe('LJ');
  });

  it('gives every seat a row, and the row of each table size covers the same rows', () => {
    for (let n = 6; n <= 9; n++) {
      const rows = seatNames(n).map((s) => chartSeat(s, n));
      for (const row of ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']) expect(rows).toContain(row);
      expect(rows.includes('EP')).toBe(n >= 7);
    }
    expect(() => chartSeat('UTG+1', 6)).toThrow();
  });

  it('matches a listed seat by name or by chart row', () => {
    expect(seatMatches('LJ', 'UTG', 6)).toBe(true);
    expect(seatMatches('UTG', 'UTG', 6)).toBe(false); // at 6 players the first seat is not an early seat
    expect(seatMatches('UTG', 'UTG', 7)).toBe(true);
    expect(seatMatches('UTG+1', 'UTG', 8)).toBe(false);
    expect(seatMatches('UTG+1', 'UTG+1', 8)).toBe(true);
    expect(seatMatches('LJ', 'UTG', 7)).toBe(false);
    expect(seatMatches('HJ', 'CO', 9)).toBe(false);
  });
});

describe('who acts before', () => {
  it('lists the earlier seats and the non-blind ones', () => {
    expect(seatsBefore('CO', 9)).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ']);
    expect(seatsBefore('UTG', 6)).toEqual([]);
    expect(seatsBefore('BB', 6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
    expect(openersBefore('BB', 6)).toEqual(['UTG', 'HJ', 'CO', 'BTN']);
    expect(openersBefore('SB', 7)).toEqual(['UTG', 'LJ', 'HJ', 'CO', 'BTN']);
    expect(isBlind('SB')).toBe(true);
    expect(isBlind('BTN')).toBe(false);
  });
});
