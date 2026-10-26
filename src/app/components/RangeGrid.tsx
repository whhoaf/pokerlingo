import { GRID_RANKS, HAND_CLASSES, gridCell } from '../../engine/ranges';
import type { RangeGridView } from '../../engine/types';

/** Rank letters across the top and down the side. Ten is shown as 10 on the cards but one letter fits the grid. */
const AXIS = GRID_RANKS.split('');

const CELLS = HAND_CLASSES.map((cls) => ({ cls, ...gridCell(cls) })).sort((a, b) => a.row - b.row || a.col - b.col);

/** A sentence for screen readers: what the chart says about your hand. */
export function gridLabel(grid: RangeGridView): string {
  const label = (action: string) => grid.legend.find((l) => l.action === action)?.label ?? action;
  const mine = grid.yours ? grid.cells[grid.yours] : undefined;
  const base = `Chart: ${grid.title}.`;
  if (!grid.yours || !mine) return base;
  return `${base} Your hand ${grid.yours}: ${label(mine.action)}${mine.borderline ? ', a borderline hand' : ''}.`;
}

/**
 * The chart for one situation as a 13 by 13 grid. Pairs sit on the diagonal, suited hands above it and offsuit hands
 * below. One solid colour per action, a dot in the corner for borderline hands, your hand outlined.
 */
export function RangeGrid({
  grid,
  showTitle = true,
  compact = false,
}: {
  grid: RangeGridView;
  /** The situation's title above the grid. Off where the title is already on screen. */
  showTitle?: boolean;
  /** Smaller grid with the key beside it, for the feedback sheet where height is short. */
  compact?: boolean;
}) {
  const anyBorderline = Object.values(grid.cells).some((c) => c.borderline);
  return (
    <div class={compact ? 'chart chart--side' : 'chart'}>
      {showTitle && <div class="lbl">{grid.title}</div>}
      <div class="rg" role="img" aria-label={gridLabel(grid)}>
        <span class="rg-axis" aria-hidden="true" />
        {AXIS.map((r) => (
          <span key={`c${r}`} class="rg-axis" aria-hidden="true">
            {r}
          </span>
        ))}
        {AXIS.map((r, row) => [
          <span key={`r${r}`} class="rg-axis" aria-hidden="true">
            {r}
          </span>,
          ...CELLS.filter((c) => c.row === row).map(({ cls }) => {
            const cell = grid.cells[cls];
            const classes = ['rg-cell', `rg--${cell?.action ?? 'none'}`];
            if (cell?.borderline) classes.push('rg-cell--either');
            if (cls === grid.yours) classes.push('rg-cell--yours');
            return <span key={cls} class={classes.join(' ')} aria-hidden="true" />;
          }),
        ])}
      </div>
      <ul class="rg-key">
        {grid.legend.map((l) => (
          <li key={l.action}>
            <span class={`rg-swatch rg--${l.action}`} aria-hidden="true" />
            {l.label}
          </li>
        ))}
        {anyBorderline && (
          <li>
            <span class="rg-swatch rg-swatch--either" aria-hidden="true" />
            Borderline
          </li>
        )}
        {grid.yours && (
          <li>
            <span class="rg-swatch rg-swatch--yours" aria-hidden="true" />
            You hold {grid.yours}
          </li>
        )}
      </ul>
    </div>
  );
}
