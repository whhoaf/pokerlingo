import type { SkillDef } from '../../engine/types';
import { DraftNote } from './DraftNote';
import { RangeGrid } from './RangeGrid';
import { Table } from './Table';

/** One screen of teaching: the explainer, a worked example and further reading. */
export function Explainer({ skill, withReading = true }: { skill: SkillDef; withReading?: boolean }) {
  const { body, situations, example } = skill.explainer;
  return (
    <div class="stack explainer">
      {skill.draft && <DraftNote />}
      <div class="panel">
        {body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {situations?.map((s) => (
        <section key={s.title} class="panel situation">
          <div class="lbl">{s.title}</div>
          <p class="small situation-where">{s.where}</p>
          <p>{s.reason}</p>
          {s.range && <p class="situation-range">{s.range}</p>}
          <RangeGrid grid={s.grid} showTitle={false} />
        </section>
      ))}
      <div class="stack example">
        <div class="lbl">Worked example</div>
        <Table table={example.table} reveal={example.answer} />
        <p class="panel prompt">{example.prompt}</p>
        <div class="panel panel--good">
          <div class="lbl">Answer</div>
          <div class="ansline">{example.answer}</div>
          <ul class="work">
            {example.working.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {example.rangeGrid && (
          <div class="panel">
            <RangeGrid grid={example.rangeGrid} />
          </div>
        )}
        {example.sources && example.sources.length > 0 && (
          <p class="small sources">
            {example.sources.length === 1 ? 'Source' : 'Sources'}: {example.sources.join('; ')}
          </p>
        )}
      </div>
      {withReading && skill.furtherReading && skill.furtherReading.length > 0 && (
        <div class="panel">
          <div class="lbl">Further reading</div>
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
