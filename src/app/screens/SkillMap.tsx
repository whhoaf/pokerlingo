import type { Area } from '../../engine/types';
import type { Curriculum, SkillRecords } from '../../engine/curriculum';
import { stateLabel } from '../format';

const AREAS: { id: Area; name: string }[] = [
  { id: 'A', name: 'Hands by seat' },
  { id: 'B', name: 'Outs and pot odds' },
  { id: 'C', name: 'Reading the board' },
  { id: 'D', name: 'Bet sizing' },
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
          <section key={area.id} class="area-block" aria-label={`Area ${area.id}: ${area.name}`}>
            <h2>
              {area.id}. {area.name}
            </h2>
            {skills.length === 0 && <p class="muted">Coming in a later update.</p>}
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
                  <span class={`pill pill--${state}`}>{stateLabel(state)}</span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
