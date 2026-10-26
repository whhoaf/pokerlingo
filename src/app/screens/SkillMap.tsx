import type { Area } from '../../engine/types';
import type { Curriculum, SkillRecords } from '../../engine/curriculum';
import { stateLabel } from '../format';

/** `total` is how many skills the area will have once it is finished (PRD section 5). */
const AREAS: { id: Area; name: string; total: number }[] = [
  { id: 'A', name: 'Hands by seat', total: 9 },
  { id: 'B', name: 'Outs and pot odds', total: 9 },
  { id: 'C', name: 'Reading the board', total: 6 },
  { id: 'D', name: 'Bet sizing', total: 5 },
];

interface Props {
  curriculum: Curriculum;
  records: SkillRecords;
  onOpen(skillId: string): void;
}

export function SkillMapScreen({ curriculum, records, onOpen }: Props) {
  return (
    <div class="screen screen--tabs">
      <h1>Skills</h1>
      {AREAS.map((area) => {
        const skills = curriculum.inArea(area.id);
        return (
          <section key={area.id} class="panel area" aria-label={`Area ${area.id}: ${area.name}`}>
            <h2>
              {area.id}. {area.name}
            </h2>
            {skills.length === 0 && <p class="soft">Coming in a later update.</p>}
            {skills.map((s) => {
              const state = curriculum.stateOf(s.id, records);
              return (
                <button
                  key={s.id}
                  type="button"
                  class={state === 'locked' ? 'skill-row skill-row--locked' : 'skill-row'}
                  onClick={() => onOpen(s.id)}
                >
                  <span class="skill-id">{s.id}</span>
                  <span class="skill-title">{s.title}</span>
                  <span class={`state state--${state}`}>{stateLabel(state)}</span>
                </button>
              );
            })}
            {skills.length > 0 && skills.length < area.total && (
              <p class="soft">{`Coming in a later update: ${area.id}${skills.length + 1} to ${area.id}${area.total}.`}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
