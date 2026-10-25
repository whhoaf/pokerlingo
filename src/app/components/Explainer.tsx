import type { SkillDef } from '../../engine/types';
import { Table } from './Table';

/** One screen of teaching: the explainer, a worked example and further reading. */
export function Explainer({ skill, withReading = true }: { skill: SkillDef; withReading?: boolean }) {
  const { body, example } = skill.explainer;
  return (
    <div class="stack explainer">
      <div>
        {body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <div class="example">
        <div class="eyebrow">Worked example</div>
        <Table table={example.table} />
        <p class="prompt">{example.prompt}</p>
        <div class="panel panel--good">
          <div class="feedback-answer">Answer: {example.answer}</div>
          <ul class="working">
            {example.working.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      {withReading && skill.furtherReading && skill.furtherReading.length > 0 && (
        <div>
          <div class="eyebrow">Further reading</div>
          <ul class="links">
            {skill.furtherReading.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
