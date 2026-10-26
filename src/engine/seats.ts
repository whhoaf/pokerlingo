// Seat names at a 6 to 9 player table, and the chart row each seat uses.
// Seats are counted back from the button: BTN, CO, HJ, LJ, then the early seats that only exist at 7 to 9 players.

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 9;

/** Every seat name that can appear at a 6 to 9 player table. */
export const SEAT_NAMES = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

/** The rows a chart can have. EP is the early seats as one group. */
export type ChartSeat = 'EP' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const CHART_SEATS: readonly ChartSeat[] = ['EP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function isSeatName(text: string): boolean {
  return (SEAT_NAMES as readonly string[]).includes(text);
}

function checkPlayers(players: number): void {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new Error(`A table has ${MIN_PLAYERS} to ${MAX_PLAYERS} players, not ${players}`);
  }
}

/**
 * The seats in the order they act before the flop: first to act, then round to the button, then SB and BB.
 * That is also clockwise around the table. A 6-player table is UTG, HJ, CO, BTN, SB, BB.
 */
export function seatNames(players: number): string[] {
  checkPlayers(players);
  if (players === 6) return ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const early = ['UTG', 'UTG+1', 'UTG+2'].slice(0, players - 6);
  return [...early, 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
}

export function hasSeat(seat: string, players: number): boolean {
  return seatNames(players).includes(seat);
}

/** The chart row a seat uses. At 6 players the first seat to act plays the lojack's row. */
export function chartSeat(seat: string, players: number): ChartSeat {
  if (!hasSeat(seat, players)) throw new Error(`No seat ${seat} at a ${players}-player table`);
  if (seat === 'UTG' && players === 6) return 'LJ';
  if (seat.startsWith('UTG')) return 'EP';
  return seat as ChartSeat;
}

/** The chart row a listed seat name stands for. UTG, UTG+1 and UTG+2 are all the early row. */
function rowOf(listed: string): string {
  return listed.startsWith('UTG') ? 'EP' : listed;
}

/**
 * True when a chart's seat list names this seat. A row name (LJ, HJ, CO, BTN, SB, BB) covers every seat that uses
 * that row, so LJ also covers the first seat at 6 players. An early seat (UTG, UTG+1, UTG+2) covers only itself,
 * and only where it plays the early row: at 6 players the first seat is not an early seat.
 */
export function seatMatches(listed: string, seat: string, players: number): boolean {
  const row = chartSeat(seat, players);
  if (row !== rowOf(listed)) return false;
  return row !== 'EP' || listed === seat;
}

export function isBlind(seat: string): boolean {
  return seat === 'SB' || seat === 'BB';
}

/** The seats that act before this one in the first round, in order. */
export function seatsBefore(seat: string, players: number): string[] {
  const names = seatNames(players);
  const i = names.indexOf(seat);
  if (i < 0) throw new Error(`No seat ${seat} at a ${players}-player table`);
  return names.slice(0, i);
}

/** The seats before this one that are not blinds. Only these can limp or open. */
export function openersBefore(seat: string, players: number): string[] {
  return seatsBefore(seat, players).filter((s) => !isBlind(s));
}

/** Where a seat sits counting back from the button: BTN is 0, CO is 1, HJ is 2 and so on. SB and BB are null. */
export function backFromButton(seat: string, players: number): number | null {
  if (isBlind(seat)) return null;
  const names = seatNames(players).filter((s) => !isBlind(s));
  const i = names.indexOf(seat);
  if (i < 0) throw new Error(`No seat ${seat} at a ${players}-player table`);
  return names.length - 1 - i;
}
