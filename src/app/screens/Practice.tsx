import { useEffect, useRef, useState } from 'preact/hooks';
import type { PracticeRun } from '../../engine/session';
import type { SkillDef } from '../../engine/types';
import { ChoiceInput } from '../components/ChoiceInput';
import { Feedback } from '../components/Feedback';
import { NumberInput } from '../components/NumberInput';
import { Table } from '../components/Table';
import type { GradeResult } from '../../engine/types';

interface Props {
  run: PracticeRun;
  skill: SkillDef;
  onDone(): void;
}

/** Extra practice from the skill map. Answers are logged but the schedule never changes. */
export function PracticeScreen({ run, skill, onDone }: Props) {
  const [result, setResult] = useState<GradeResult | null>(null);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [, setTick] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const q = run.question;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [q]);

  const next = () => {
    run.next();
    setResult(null);
    setPicked(undefined);
    setTick((n) => n + 1);
  };

  const stats = run.stats;
  const correctId = result && q.input.kind === 'choice' ? q.input.options.find((o) => o.label === result.correctLabel)?.id : undefined;

  return (
    <div class="screen" ref={top}>
      <div class="screen-head">
        <div>
          <div class="eyebrow">Practice, {skill.id}</div>
          <p class="muted small">
            {stats.correct} of {stats.answered} right
          </p>
        </div>
        <button type="button" class="btn btn--small" onClick={onDone}>
          Done
        </button>
      </div>

      <Table table={q.table} />
      <p class="prompt">{q.prompt}</p>

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
        <NumberInput unit={q.input.unit} onSubmit={(value) => setResult(run.submit({ kind: 'number', value }))} />
      )}
      {result && q.input.kind === 'choice' && (
        <ChoiceInput options={q.input.options} onPick={() => {}} picked={picked ?? ''} correctId={correctId} />
      )}
      {result && (
        <Feedback result={result} skillTitle={`${skill.id} ${skill.title}`} nextLabel="Next question" onNext={next} />
      )}
    </div>
  );
}
