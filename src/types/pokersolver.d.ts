// Minimal typings for the parts of pokersolver that pokerlingo uses.
declare module 'pokersolver' {
  export interface SolverCard {
    value: string;
    suit: string;
    rank: number;
    toString(): string;
  }

  export class Hand {
    /** Hand name, for example 'Full House'. */
    name: string;
    /** Description, for example 'Full House, Aces over Kings'. */
    descr: string;
    /** Category rank: 1 High Card up to 9 Straight Flush. */
    rank: number;
    /** The five cards that make the hand. */
    cards: SolverCard[];
    /** Every card given to solve(), in pokersolver order. */
    cardPool: SolverCard[];
    static solve(cards: string[], game?: unknown, canDisqualify?: boolean): Hand;
    static winners(hands: Hand[]): Hand[];
    /** Sort order: negative if this hand wins, 0 on a tie, positive if it loses. */
    compare(other: Hand): number;
    beats(other: Hand): boolean;
    loses(other: Hand): boolean;
    ties(other: Hand): boolean;
  }

  const pokersolver: { Hand: typeof Hand };
  export default pokersolver;
}
