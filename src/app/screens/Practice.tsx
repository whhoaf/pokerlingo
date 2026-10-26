import { useEffect, useState } from 'preact/hooks';
import type { PracticeRun } from '../../engine/session';
import type { GradeResult, SkillDef } from '../../engine/types';
import { ChoiceInput } from '../components/ChoiceInput';
import { Feedback } from '../components/Feedback';
import { NumberInput, NumberShown } from '../components/NumberInput';
import { Table } from '../components/Table';

interface Props {
  run: PracticeRun;
  skill: SkillDef;
  onDone(): void;
}

/** Extra practice from the skill map. Answers are logged but the schedule never changes. */
export function PracticeScreen({ run, skill, onDone }: Props) {
  const [result, setResult] = useState<GradeResult | null>(null);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [given, setGiven] = useState<number | undefined>(undefined);
  const [, setTick] = useState(0);
  const q = run.question;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [q]);

  const next = () => {
    run.next();
    setResult(null);
    setPicked(undefined);
    setGiven(undefined);
    setTick((n) => n + 1);
  };

  const stats = run.stats;
  const correctId = result && q.input.kind === 'choice' ? q.input.options.find((o) => o.label === result.correctLabel)?.id : undefined;

  return (
    <div class="screen">
      <header class="hud">
        <div class="panel hud-info">
          <span class="lbl">Practice</span>
          <b>{skill.id}</b>
        </div>
        <div class="panel tag tag--review">
          <span class="lbl">Right</span>
          <b>
            {stats.correct} of {stats.answered}
          </b>
        </div>
        <button type="button" class="btn btn--dark" onClick={onDone}>
          Done
        </button>
      </header>

      <Table key={`${q.skillId}-${q.seed}`} table={q.table} />
      <p class="panel prompt">{q.prompt}</p>

      <div class="answer">
        {!result && q.input.kind === 'choice' && (
          <ChoiceInput
            options={q.input.options}
            onPick={(id) => {
              setPicked(id);
              setResult(run.submit({ kind: 'choice', id }));
            }}
          />
        )}
        {!result && q.input.kind === 'number' && (
          <NumberInput
            unit={q.input.unit}
            onSubmit={(value) => {
              setGiven(value);
              setResult(run.submit({ kind: 'number', value }));
            }}
          />
        )}
        {result && q.input.kind === 'choice' && (
          <ChoiceInput options={q.input.options} onPick={() => {}} picked={picked ?? ''} correctId={correctId} />
        )}
        {result && q.input.kind === 'number' && given !== undefined && (
          <NumberShown unit={q.input.unit} value={given} correct={result.correct} />
        )}
      </div>
      {result && (
        <Feedback result={result} skillTitle={`${skill.id} ${skill.title}`} nextLabel="Next question" onNext={next} />
      )}
    </div>
  );
}
