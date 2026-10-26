import { cardLabel, formatCard, suitOf } from '../../engine/cards';
import type { Card } from '../../engine/types';
import { suitPath } from '../suits';

export type CardSize = 'board' | 'hand' | 'mini';

export function SuitIcon({ suit, class: className }: { suit: string; class?: string }) {
  return (
    <svg class={className} viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">
      <path d={suitPath(suit)} />
    </svg>
  );
}

interface Props {
  card: Card;
  /** Board cards are 62 by 86, your cards 84 by 116 and mini cards 44 by 60. */
  size?: CardSize;
  highlight?: boolean;
  /** Tilt in degrees, for the slight fan of your two cards. */
  tilt?: number;
  /** Delay before the card is dealt in, in milliseconds. */
  delay?: number;
}

/**
 * Rank top left and the suit as a pixel drawing. Hearts and diamonds are red and spades and clubs black, and the
 * drawing carries the suit as well as the colour. Mini cards do not animate.
 */
export function PlayingCard({ card, size = 'board', highlight = false, tilt = 0, delay = 0 }: Props) {
  const f = formatCard(card);
  const suit = suitOf(card);
  const classes = ['card', `card--${size}`, f.red ? 'card--red' : '', highlight ? 'card--hl' : ''].filter(Boolean).join(' ');
  return (
    <span class={classes} style={`--r:${tilt}deg;--d:${delay}ms`} role="img" aria-label={cardLabel(card)}>
      <span class="card-rank" aria-hidden="true">
        {f.rank}
      </span>
      {size === 'hand' && <SuitIcon suit={suit} class="card-pip" />}
      <SuitIcon suit={suit} class="card-big" />
    </span>
  );
}

/** A row of mini cards, for the outs and for choices that show cards. */
export function CardRow({ cards, size = 'mini', left = false }: { cards: Card[]; size?: CardSize; left?: boolean }) {
  return (
    <div class={left ? 'card-row card-row--left' : 'card-row'}>
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} />
      ))}
    </div>
  );
}
