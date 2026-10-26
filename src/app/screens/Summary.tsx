import type { Curriculum } from '../../engine/curriculum';
import type { SessionSummary } from '../../engine/session';
import { RollNumber } from '../components/RollNumber';
import { useMood } from '../useMood';

interface Props {
  summary: SessionSummary;
  streak: number;
  curriculum: Curriculum;
  onDone(): void;
}

export function SummaryScreen({ summary, streak, curriculum, onDone }: Props) {
  useMood('purple');
  return (
    <div class="screen">
      <div class="panel stack">
        <div class="lbl">{summary.finished ? 'Session complete' : 'Session ended early'}</div>
        <h1>{summary.finished ? 'Nice work' : 'Stopped early'}</h1>
        {!summary.finished && <p>An early end does not count towards your streak.</p>}
      </div>

      <div class="stats">
        <div class="stat stat--blue">
          <span class="lbl">Questions</span>
          <span class="stat-num">
            <RollNumber value={summary.answered} />
          </span>
        </div>
        <div class="stat stat--green">
          <span class="lbl">Accuracy</span>
          <span class="stat-num">
            {summary.accuracy === null ? (
              'n/a'
            ) : (
              <RollNumber value={Math.round(summary.accuracy * 100)} format={(n) => `${n}%`} />
            )}
          </span>
        </div>
        <div class="stat stat--red">
          <span class="lbl">Streak</span>
          <span class="stat-num">
            <RollNumber value={streak} />
          </span>
          <span class="stat-unit">{streak === 1 ? 'day' : 'days'}</span>
        </div>
        <div class="stat stat--orange">
          <span class="lbl">Due tomorrow</span>
          <span class="stat-num">
            <RollNumber value={summary.dueTomorrow} />
          </span>
          <span class="stat-unit">{summary.dueTomorrow === 1 ? 'skill' : 'skills'}</span>
        </div>
      </div>

      {summary.newSkills.length > 0 && (
        <div class="panel stack">
          <div class="lbl">New today</div>
          {summary.newSkills.map((id) => (
            <p key={id}>
              <strong>{id}</strong> {curriculum.get(id).title}
            </p>
          ))}
        </div>
      )}

      <div class="actions">
        <button type="button" class="btn btn--big btn--orange" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
