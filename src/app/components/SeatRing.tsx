import type { ComponentChildren } from 'preact';
import type { RingSeat, SeatRing } from '../../engine/types';

/** Where seat number `k` of `n` sits on the ellipse, counted clockwise from the seat at the bottom. Percentages. */
export function seatPosition(k: number, n: number): { left: number; top: number } {
  const angle = Math.PI / 2 + (k * 2 * Math.PI) / n;
  return { left: 50 + 40 * Math.cos(angle), top: 47 + 36 * Math.sin(angle) };
}

const ROLE_WORD: Record<NonNullable<RingSeat['role']>, string> = {
  you: 'you',
  limp: 'limped',
  raise: 'raised',
  fold: 'folded',
  focus: 'highlighted',
};

/** The sentence a screen reader gets for the whole table. */
export function ringLabel(ring: SeatRing): string {
  const parts = [`Table of ${ring.seats.length} players.`];
  const button = ring.seats.findIndex((s) => s.button);
  if (button >= 0) {
    const name = ring.seats[button]?.name;
    parts.push(name ? `The dealer button is on ${name}.` : `The dealer button is on seat ${button + 1}.`);
  }
  for (const s of ring.seats) {
    if (s.role && s.role !== 'fold') {
      // A raiser with a size says it: 'UTG: raised to 8 chips.'
      const size = s.role === 'raise' && s.tag && s.tag !== 'Raise' ? ` to ${s.tag}` : '';
      parts.push(`${s.name ?? 'One seat'}: ${ROLE_WORD[s.role]}${size}.`);
    }
  }
  return parts.join(' ');
}

/** The ring with the name of the highlighted seat filled in, once a question about that seat has been answered. */
export function revealFocus(ring: SeatRing, name: string): SeatRing {
  return { ...ring, seats: ring.seats.map((s, i) => (i === ring.focus && s.name === null ? { ...s, name } : s)) };
}

function Seat({ seat, k, n }: { seat: RingSeat; k: number; n: number }) {
  const pos = seatPosition(k, n);
  const classes = ['seat'];
  if (seat.role) classes.push(`seat--${seat.role}`);
  if (seat.name === null && seat.role !== 'focus') classes.push('seat--blank');
  // Seats in the lower part of the picture carry the dealer button low, away from the cards and the seats above.
  if (pos.top > 65) classes.push('seat--low');
  return (
    <span class={classes.join(' ')} style={`left:${pos.left}%;top:${pos.top}%`}>
      <span class="seat-pill">
        <span class="seat-name">{seat.name ?? (seat.role === 'focus' ? '?' : '')}</span>
        {seat.tag && <span class="seat-tag">{seat.tag}</span>}
        {seat.button && <span class="seat-button">D</span>}
      </span>
    </span>
  );
}

/** The table seen from above: seats round an oval, the highlighted seat at the bottom, the button marked with a D. */
export function SeatRingView({ ring, note, children }: { ring: SeatRing; note?: string; children?: ComponentChildren }) {
  const n = ring.seats.length;
  return (
    <div class="ring">
      <span class="ring-table" aria-hidden="true">
        {note && <span class="felt-note">{note}</span>}
      </span>
      {/* Your cards, when they sit on the table. */}
      {children && <div class="ring-hand">{children}</div>}
      <div class="ring-seats" role="img" aria-label={note ? `${ringLabel(ring)} ${note}` : ringLabel(ring)}>
        {ring.seats.map((seat, i) => (
          <Seat key={i} seat={seat} k={(i - ring.focus + n) % n} n={n} />
        ))}
      </div>
    </div>
  );
}
