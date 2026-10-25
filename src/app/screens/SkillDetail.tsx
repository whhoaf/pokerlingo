import type { Curriculum, SkillRecords } from '../../engine/curriculum';
import type { ReviewLogRecord } from '../../engine/session';
import { Explainer } from '../components/Explainer';
import { skillAccuracy } from '../data';
import { formatDueIn, formatPercent, stateLabel } from '../format';

interface Props {
  skillId: string;
  curriculum: Curriculum;
  records: SkillRecords;
  logs: readonly ReviewLogRecord[];
  now: Date;
  onBack(): void;
  onPractise(): void;
}

export function SkillDetailScreen({ skillId, curriculum, records, logs, now, onBack, onPractise }: Props) {
  const skill = curriculum.get(skillId);
  const state = curriculum.stateOf(skillId, records);
  const record = records.get(skillId);
  const acc = skillAccuracy(logs, skillId);
  const missing = skill.prereqs.filter((p) => !records.has(p));

  return (
    <div class="screen screen--tabs">
      <div class="screen-head">
        <button type="button" class="btn btn--plain btn--small" onClick={onBack}>
          Back
        </button>
        <span class={`pill pill--${state}`}>{stateLabel(state)}</span>
      </div>

      <div class="stack">
        <div class="eyebrow">{skill.id}</div>
        <h1>{skill.title}</h1>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="muted small">Accuracy</span>
          <span class="big-number">{formatPercent(acc.answered === 0 ? null : acc.correct / acc.answered)}</span>
          <span class="muted small">{acc.answered === 0 ? 'No answers yet' : `${acc.correct} of ${acc.answered} right`}</span>
        </div>
        <div class="stat">
          <span class="muted small">Next review</span>
          <span style="font-size:22px;font-weight:800">{record ? formatDueIn(record.card.due, now) : 'Not started'}</span>
        </div>
      </div>

      <Explainer skill={skill} />

      <div class="actions">
        {state === 'locked' && (
          <p class="muted small">Unlocks once you have met {missing.map((m) => curriculum.get(m).id).join(', ')}.</p>
        )}
        <button type="button" class="btn btn--primary" disabled={state === 'locked'} onClick={onPractise}>
          Practise
        </button>
        <p class="muted small">Extra practice never changes your review schedule.</p>
      </div>
    </div>
  );
}
