import type { Curriculum } from '../../engine/curriculum';
import type { SessionSummary } from '../../engine/session';
import { formatPercent } from '../format';

interface Props {
  summary: SessionSummary;
  streak: number;
  curriculum: Curriculum;
  onDone(): void;
}

export function SummaryScreen({ summary, streak, curriculum, onDone }: Props) {
  return (
    <div class="screen">
      <div class="stack">
        <div class="eyebrow">{summary.finished ? 'Session complete' : 'Session ended early'}</div>
        <h1>{summary.finished ? 'Nice work' : 'Stopped early'}</h1>
        {!summary.finished && <p class="muted">An early end does not count towards your streak.</p>}
      </div>

      <div class="stats">
        <div class="stat">
          <span class="muted small">Questions</span>
          <span class="big-number">{summary.answered}</span>
        </div>
        <div class="stat">
          <span class="muted small">Accuracy</span>
          <span class="big-number">{formatPercent(summary.accuracy)}</span>
        </div>
        <div class="stat">
          <span class="muted small">Streak</span>
          <span class="big-number">{streak}</span>
          <span class="muted small">{streak === 1 ? 'day' : 'days'}</span>
        </div>
        <div class="stat">
          <span class="muted small">Due tomorrow</span>
          <span class="big-number">{summary.dueTomorrow}</span>
          <span class="muted small">{summary.dueTomorrow === 1 ? 'skill' : 'skills'}</span>
        </div>
      </div>

      {summary.newSkills.length > 0 && (
        <div class="panel stack">
          <div class="eyebrow">New today</div>
          {summary.newSkills.map((id) => (
            <p key={id}>
              <strong>{id}</strong> {curriculum.get(id).title}
            </p>
          ))}
        </div>
      )}

      <div class="actions">
        <button type="button" class="btn btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
