import { useEffect, useState } from 'preact/hooks';
import type { Curriculum } from '../../engine/curriculum';
import type { Session, SessionSummary, Step } from '../../engine/session';
import { ChoiceInput } from '../components/ChoiceInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Explainer } from '../components/Explainer';
import { Feedback } from '../components/Feedback';
import { NumberInput } from '../components/NumberInput';
import { Table } from '../components/Table';
import { Timer } from '../components/Timer';
import { formatDueIn } from '../format';

interface Props {
  session: Session;
  curriculum: Curriculum;
  totalMs: number;
  onEnded(summary: SessionSummary): void;
}

type QuestionStep = Extract<Step, { kind: 'question' }>;

function purposeText(step: QuestionStep): string {
  switch (step.purpose) {
    case 'review':
      return 'Review';
    case 'retry':
      return 'Second try, with a fresh question';
    case 'probe':
      return `New skill, question ${step.probeNumber ?? 1} of 2`;
    case 'practice':
      return 'New skill, practice';
  }
}

export function SessionScreen({ session, curriculum, totalMs, onEnded }: Props) {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const step = session.step;

  useEffect(() => {
    window.scrollTo(0, 0);
    setPicked(undefined);
  }, [step]);

  useEffect(() => {
    if (step.kind === 'ended') onEnded(step.summary);
  }, [step]);

  if (step.kind === 'ended') {
    return (
      <div class="screen">
        <p class="muted">Saving your session</p>
      </div>
    );
  }

  const top = (
    <div class="session-top">
      <Timer remainingMs={() => session.remainingMs()} totalMs={totalMs} />
      <button type="button" class="btn btn--plain btn--small" onClick={() => setConfirmQuit(true)}>
        End
      </button>
    </div>
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
        <div class="eyebrow">New skill</div>
        <h1>{step.skill.title}</h1>
        <p class="muted">Take a minute with this one, then try some questions.</p>
        <Explainer skill={step.skill} withReading={false} />
        <div class="actions">
          <button
            type="button"
            class="btn btn--primary"
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
    session.submit({ kind: 'number', value });
    bump();
  };

  let note: string | undefined;
  if (step.placed) {
    const record = session.currentRecords().get(step.skillId);
    const when = record ? formatDueIn(record.card.due, new Date()).toLowerCase() : 'soon';
    note = `You already know this one. ${skill.title} goes straight into your reviews. Next review: ${when}.`;
  }

  const correctId =
    result && q.input.kind === 'choice' ? q.input.options.find((o) => o.label === result.correctLabel)?.id : undefined;

  return (
    <div class="screen">
      {top}
      <div class="eyebrow">{purposeText(step)}</div>
      <Table table={q.table} />
      <p class="prompt">{q.prompt}</p>

      {!result && q.input.kind === 'choice' && <ChoiceInput options={q.input.options} onPick={submitChoice} />}
      {!result && q.input.kind === 'number' && <NumberInput unit={q.input.unit} onSubmit={submitNumber} />}

      {result && q.input.kind === 'choice' && (
        <ChoiceInput options={q.input.options} onPick={() => {}} picked={picked ?? ''} correctId={correctId} />
      )}
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
