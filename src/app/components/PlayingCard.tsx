import { cardLabel, formatCard } from '../../engine/cards';
import type { Card } from '../../engine/types';

interface Props {
  card: Card;
  size?: 'md' | 'sm';
  highlight?: boolean;
}

/** Rank above suit symbol. Hearts and diamonds are red, and the symbol carries the suit as well as the colour. */
export function PlayingCard({ card, size = 'md', highlight = false }: Props) {
  const f = formatCard(card);
  const classes = ['pcard', size === 'sm' ? 'pcard--sm' : '', f.red ? 'pcard--red' : '', highlight ? 'pcard--hl' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span class={classes} role="img" aria-label={cardLabel(card)}>
      <span class="pcard-rank" aria-hidden="true">
        {f.rank}
      </span>
      <span class="pcard-suit" aria-hidden="true">
        {f.symbol}
      </span>
    </span>
  );
}

/** A row of cards, for the outs and for choices that show cards. */
export function CardRow({ cards, size = 'sm', left = false }: { cards: Card[]; size?: 'md' | 'sm'; left?: boolean }) {
  return (
    <div class={left ? 'card-row card-row--left' : 'card-row'}>
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} />
      ))}
    </div>
  );
}
