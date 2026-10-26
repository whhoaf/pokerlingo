import { useEffect, useState } from 'preact/hooks';
import type { Curriculum } from '../../engine/curriculum';
import type { Session, SessionSummary, Step } from '../../engine/session';
import { correctChoiceIds } from '../choices';
import { ChoiceInput } from '../components/ChoiceInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Explainer } from '../components/Explainer';
import { Feedback } from '../components/Feedback';
import { NumberInput, NumberShown } from '../components/NumberInput';
import { Table } from '../components/Table';
import { Timer } from '../components/Timer';
import { formatDueIn } from '../format';
import { useMood } from '../useMood';

interface Props {
  session: Session;
  curriculum: Curriculum;
  totalMs: number;
  onEnded(summary: SessionSummary): void;
}

type QuestionStep = Extract<Step, { kind: 'question' }>;

interface TagContent {
  kind: 'new' | 'review' | 'retry';
  label: string;
  value: string;
}

/** Short area names for the top bar. */
const AREA_TAG: Record<string, string> = { A: 'Seats', B: 'Outs, odds', C: 'Board', D: 'Sizing' };

/**
 * The tag in the top bar: what kind of question this is.
 * Reviews show only the area. A skill ID or title would give the answer away (B1 is always a flush draw).
 */
function tagFor(step: QuestionStep, curriculum: Curriculum): TagContent {
  const area = AREA_TAG[curriculum.get(step.skillId).area] ?? 'Review';
  switch (step.purpose) {
    case 'review':
      return { kind: 'review', label: 'Review', value: area };
    case 'retry':
      return { kind: 'retry', label: 'Second try', value: area };
    case 'probe':
      return { kind: 'new', label: 'New skill', value: `${step.probeNumber ?? 1} of 2` };
    case 'practice':
      return { kind: 'new', label: 'New skill', value: 'Practice' };
  }
}

export function SessionScreen({ session, curriculum, totalMs, onEnded }: Props) {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [given, setGiven] = useState<number | undefined>(undefined);
  const [low, setLow] = useState(false);
  const step = session.step;

  // Green normally, blue while a new skill is being introduced, red in the last minute.
  const introducing = step.kind === 'explainer' || (step.kind === 'question' && (step.purpose === 'probe' || step.purpose === 'practice'));
  useMood(low ? 'red' : introducing ? 'blue' : 'green');

  useEffect(() => {
    window.scrollTo(0, 0);
    setPicked(undefined);
    setGiven(undefined);
  }, [step]);

  useEffect(() => {
    if (step.kind === 'ended') onEnded(step.summary);
  }, [step]);

  if (step.kind === 'ended') {
    return (
      <div class="screen">
        <p class="panel">Saving your session</p>
      </div>
    );
  }

  const tag: TagContent =
    step.kind === 'question' ? tagFor(step, curriculum) : { kind: 'new', label: 'New skill', value: step.skill.id };

  const top = (
    <header class="hud">
      <Timer remainingMs={() => session.remainingMs()} totalMs={totalMs} onLowChange={setLow} />
      <div class={`panel tag tag--${tag.kind}`}>
        <span class="lbl">{tag.label}</span>
        <b>{tag.value}</b>
      </div>
      <button type="button" class="btn btn--red" onClick={() => setConfirmQuit(true)}>
        End
      </button>
    </header>
  );

  const dialog = confirmQuit && (
    <ConfirmDialog
      title="End this session?"
      confirmLabel="End session"
      cancelLabel="Keep going"
      danger
      onConfirm={() => {
        setConfirmQuit(false);
        session.quit();
        bump();
      }}
      onCancel={() => setConfirmQuit(false)}
    >
      <p>Your answers so far are saved, but an early end does not count towards your streak.</p>
    </ConfirmDialog>
  );

  if (step.kind === 'explainer') {
    return (
      <div class="screen">
        {top}
        <div class="panel stack">
          <div class="lbl">New skill</div>
          <h1>{step.skill.title}</h1>
          <p>Take a minute with this one, then try some questions.</p>
        </div>
        <Explainer skill={step.skill} withReading={false} />
        <div class="actions">
          <button
            type="button"
            class="btn btn--big btn--orange"
            onClick={() => {
              session.advance();
              bump();
            }}
          >
            Start practice
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  const q = step.question;
  const skill = curriculum.get(step.skillId);
  const result = step.result;

  const submitChoice = (id: string) => {
    setPicked(id);
    session.submit({ kind: 'choice', id });
    bump();
  };
  const submitNumber = (value: number) => {
    setGiven(value);
    session.submit({ kind: 'number', value });
    bump();
  };

  let note: string | undefined;
  if (step.placed) {
    const record = session.currentRecords().get(step.skillId);
    const when = record ? formatDueIn(record.card.due, new Date()).toLowerCase() : 'soon';
    note = `You already know this one. ${skill.title} goes straight into your reviews. Next review: ${when}.`;
  }

  const correctIds = correctChoiceIds(q, result);

  return (
    <div class="screen">
      {top}
      <Table key={`${q.skillId}-${q.seed}`} table={q.table} />
      <p class="panel prompt">{q.prompt}</p>

      <div class="answer">
        {!result && q.input.kind === 'choice' && <ChoiceInput options={q.input.options} onPick={submitChoice} />}
        {!result && q.input.kind === 'number' && <NumberInput unit={q.input.unit} onSubmit={submitNumber} />}

        {result && q.input.kind === 'choice' && (
          <ChoiceInput options={q.input.options} onPick={() => {}} picked={picked ?? ''} correctIds={correctIds} />
        )}
        {result && q.input.kind === 'number' && given !== undefined && (
          <NumberShown unit={q.input.unit} value={given} correct={result.correct} />
        )}
      </div>
      {result && (
        <Feedback
          result={result}
          skillTitle={`${skill.id} ${skill.title}`}
          note={note}
          nextLabel={session.remainingMs() === 0 ? 'Finish session' : 'Next'}
          onNext={() => {
            session.advance();
            bump();
          }}
        />
      )}
      {dialog}
    </div>
  );
}
