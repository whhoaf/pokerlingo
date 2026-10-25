import type { Overview } from '../data';
import { formatDueIn } from '../format';

interface Props {
  ov: Overview;
  sessionMinutes: number;
  nextDue: string | null;
  now: Date;
  showExportBanner: boolean;
  exporting: boolean;
  exportMessage: string | null;
  onStart(): void;
  onExport(): void;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function HomeScreen({
  ov,
  sessionMinutes,
  nextDue,
  now,
  showExportBanner,
  exporting,
  exportMessage,
  onStart,
  onExport,
}: Props) {
  const startLabel = `Start a ${sessionMinutes}-minute session`;

  return (
    <div class="screen screen--tabs">
      <div class="screen-head">
        <h1>pokerlingo</h1>
        <div class="pill pill--reviewing" aria-label={`Streak: ${plural(ov.streak, 'day')}`}>
          Streak {ov.streak}
        </div>
      </div>

      {ov.firstRun && (
        <div class="panel panel--accent stack">
          <h2>Welcome</h2>
          <p>
            Short daily sessions teach you to count outs, price a call and read the board. Every question is new, and the
            app marks your answers for you.
          </p>
          <p>Skills you already know are skipped, and the rest come back just before you would forget them.</p>
        </div>
      )}

      {ov.doneToday ? (
        <div class="panel panel--good stack">
          <h2>Done for today</h2>
          <p>Your streak is safe. Come back tomorrow.</p>
          {ov.dueCount > 0 && <p class="muted">{plural(ov.dueCount, 'skill')} still due will roll over to your next session.</p>}
        </div>
      ) : ov.hasWork ? (
        <div class="panel stack">
          {ov.dueCount > 0 ? (
            <>
              <div class="big-number">{ov.dueCount}</div>
              <p>{ov.dueCount === 1 ? 'skill is due for review' : 'skills are due for review'}</p>
            </>
          ) : (
            <>
              <h2>Ready to learn</h2>
              <p>Nothing is due. The next new skill is waiting.</p>
            </>
          )}
        </div>
      ) : (
        <div class="panel stack">
          <h2>All caught up</h2>
          <p>{nextDue ? `Next review: ${formatDueIn(nextDue, now).toLowerCase()}.` : 'Nothing to review.'}</p>
        </div>
      )}

      {showExportBanner && (
        <div class="panel panel--accent stack" role="status">
          <p>
            <strong>Back up your progress.</strong> Your last backup is more than a week old, or you have never made one.
          </p>
          <button type="button" class="btn" onClick={onExport} disabled={exporting}>
            {exporting ? 'Exporting' : 'Export now'}
          </button>
        </div>
      )}
      {exportMessage && <div class="message">{exportMessage}</div>}

      <div class="actions">
        {ov.hasWork && (
          <button type="button" class={ov.doneToday ? 'btn' : 'btn btn--primary'} onClick={onStart}>
            {ov.doneToday ? 'Start another session' : startLabel}
          </button>
        )}
      </div>
    </div>
  );
}
