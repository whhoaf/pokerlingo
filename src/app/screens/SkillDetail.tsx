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
        <button type="button" class="btn btn--dark" onClick={onBack}>
          Back
        </button>
        <span class={`state state--${state}`}>{stateLabel(state)}</span>
      </div>

      <div class="stack">
        <div class="lbl">{skill.id}</div>
        <h1>{skill.title}</h1>
      </div>

      <div class="stats">
        <div class="stat stat--green">
          <span class="lbl">Accuracy</span>
          <span class="stat-num">{formatPercent(acc.answered === 0 ? null : acc.correct / acc.answered)}</span>
          <span class="stat-unit">{acc.answered === 0 ? 'No answers yet' : `${acc.correct} of ${acc.answered} right`}</span>
        </div>
        <div class="stat stat--blue">
          <span class="lbl">Next review</span>
          <span class="stat-text">{record ? formatDueIn(record.card.due, now) : 'Not started'}</span>
        </div>
      </div>

      <Explainer skill={skill} />

      <p class="panel small">
        {state === 'locked'
          ? `Unlocks once you have met ${missing.map((m) => curriculum.get(m).id).join(', ')}. `
          : ''}
        Extra practice never changes your review schedule.
      </p>

      <div class="actions">
        <button type="button" class="btn btn--big btn--blue" disabled={state === 'locked'} onClick={onPractise}>
          Practise
        </button>
      </div>
    </div>
  );
}
