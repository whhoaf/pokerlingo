import type { TableView } from '../../engine/types';
import { PlayingCard } from './PlayingCard';

function Chip({ label, value, bet = false }: { label: string; value: string | number; bet?: boolean }) {
  return (
    <span class={bet ? 'chip chip--bet' : 'chip'}>
      <span class="chip-label">{label}</span>
      <span class="chip-value">{value}</span>
    </span>
  );
}

/** The felt table: board in the middle, your cards below, pot and bet as labelled chips. */
export function Table({ table }: { table: TableView }) {
  const hasChips = table.pot !== undefined || table.bet !== undefined || table.seat || table.players;
  const board = table.board ?? [];
  return (
    <div class="table" aria-label="Table">
      {hasChips && (
        <div class="table-chips">
          {table.seat && <Chip label="Seat" value={table.seat} />}
          {table.players !== undefined && <Chip label="Players" value={table.players} />}
          {table.pot !== undefined && <Chip label="Pot" value={table.pot} />}
          {table.bet !== undefined && <Chip label="Bet to call" value={table.bet} bet />}
        </div>
      )}
      {table.villain && table.villain.length > 0 && (
        <div>
          <div class="table-label">Opponent</div>
          <div class="card-row">
            {table.villain.map((c) => (
              <PlayingCard key={c} card={c} />
            ))}
          </div>
        </div>
      )}
      {board.length > 0 && (
        <div>
          <div class="table-label">Board</div>
          <div class="card-row">
            {board.map((c) => (
              <PlayingCard key={c} card={c} />
            ))}
          </div>
        </div>
      )}
      {table.hole && table.hole.length > 0 && (
        <div>
          <div class="table-label">Your cards</div>
          <div class="card-row">
            {table.hole.map((c) => (
              <PlayingCard key={c} card={c} />
            ))}
          </div>
        </div>
      )}
      {table.note && <div class="table-note">{table.note}</div>}
    </div>
  );
}
