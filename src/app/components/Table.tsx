import type { TableView } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { SeatRingView } from './SeatRing';

/** Cards are dealt one after another, this many milliseconds apart. */
const DEAL_GAP = 120;

function Chip({ label, value, bet = false }: { label: string; value: string | number; bet?: boolean }) {
  return (
    <span class={bet ? 'chip chip--bet' : 'chip'}>
      <span class="chip-label">{label}</span>
      <span class="chip-value">{value}</span>
    </span>
  );
}

/** The felt: pot and bet as chips, the board, your cards slightly fanned, and a note in gold. */
export function Table({ table }: { table: TableView }) {
  const hasChips = table.pot !== undefined || table.bet !== undefined || table.seat || table.players;
  const board = table.board ?? [];
  const villain = table.villain ?? [];
  const hole = table.hole ?? [];
  // Deal order follows the order on screen, so each card lands a beat after the one before.
  let dealt = 0;
  const next = () => dealt++ * DEAL_GAP;
  return (
    <div class="felt" aria-label="Table">
      {hasChips && (
        <div class="felt-chips">
          {table.seat && <Chip label="Seat" value={table.seat} />}
          {table.players !== undefined && <Chip label="Players" value={table.players} />}
          {table.pot !== undefined && <Chip label="Pot" value={table.pot} />}
          {table.bet !== undefined && <Chip label="Bet to call" value={table.bet} bet />}
        </div>
      )}
      {table.ring && <SeatRingView ring={table.ring} />}
      {villain.length > 0 && (
        <div>
          <div class="lbl">Opponent</div>
          <div class="card-row">
            {villain.map((c) => (
              <PlayingCard key={c} card={c} delay={next()} />
            ))}
          </div>
        </div>
      )}
      {board.length > 0 && (
        <div>
          <div class="lbl">Board</div>
          <div class="card-row">
            {board.map((c) => (
              <PlayingCard key={c} card={c} delay={next()} />
            ))}
          </div>
        </div>
      )}
      {hole.length > 0 && (
        <div>
          <div class="lbl">Your cards</div>
          <div class="card-row card-row--hand">
            {hole.map((c, i) => (
              <PlayingCard key={c} card={c} size="hand" tilt={hole.length === 2 ? (i === 0 ? -5 : 5) : 0} delay={next()} />
            ))}
          </div>
        </div>
      )}
      {table.note && <div class="felt-note">{table.note}</div>}
    </div>
  );
}
