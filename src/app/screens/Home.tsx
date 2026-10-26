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
  onSkills(): void;
  onSettings(): void;
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
  onSkills,
  onSettings,
}: Props) {
  const startLabel = `Start a ${sessionMinutes}-minute session`;

  return (
    <div class="screen screen--home">
      <h1 class="title">pokerlingo</h1>

      <div class="stats">
        <div class="stat stat--blue">
          <span class="lbl">Due today</span>
          <span class="stat-num">{ov.dueCount}</span>
        </div>
        <div class="stat stat--red" aria-label={`Streak: ${plural(ov.streak, 'day')}`}>
          <span class="lbl">Day streak</span>
          <span class="stat-num">{ov.streak}</span>
        </div>
      </div>

      {ov.firstRun && (
        <div class="panel panel--gold stack">
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
          {ov.dueCount > 0 && <p class="soft">{plural(ov.dueCount, 'skill')} still due will roll over to your next session.</p>}
        </div>
      ) : ov.hasWork ? (
        <div class="panel stack">
          {ov.dueCount > 0 ? (
            <p>{ov.dueCount === 1 ? '1 skill is due for review.' : `${ov.dueCount} skills are due for review.`}</p>
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
        <div class="panel panel--gold stack" role="status">
          <p>
            <strong>Back up your progress.</strong> Your last backup is more than a week old, or you have never made one.
          </p>
          <button type="button" class="btn btn--blue" onClick={onExport} disabled={exporting}>
            {exporting ? 'Exporting' : 'Export now'}
          </button>
        </div>
      )}
      {exportMessage && <div class="panel message">{exportMessage}</div>}

      <div class="actions actions--home">
        {ov.hasWork && (
          <button type="button" class="btn btn--big btn--blue" onClick={onStart}>
            {ov.doneToday ? 'Start another session' : startLabel}
          </button>
        )}
        <div class="btn-row">
          <button type="button" class="btn btn--dark" onClick={onSkills}>
            Skill map
          </button>
          <button type="button" class="btn btn--dark" onClick={onSettings}>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
