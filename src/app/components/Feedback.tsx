import type { GradeResult } from '../../engine/types';
import { sortByRank } from '../../engine/cards';
import { CardRow } from './PlayingCard';

interface Props {
  result: GradeResult;
  skillTitle: string;
  /** Extra line, for example when a new skill was placed straight into reviews. */
  note?: string;
  nextLabel?: string;
  onNext(): void;
}

/** Right or wrong, the correct answer, one line of reasoning and the supporting picture. */
export function Feedback({ result, skillTitle, note, nextLabel = 'Next', onNext }: Props) {
  const outs = result.highlight && result.highlight.length > 0 ? sortByRank(result.highlight) : null;
  return (
    <div class="stack" aria-live="polite">
      <div class={result.correct ? 'panel panel--good' : 'panel panel--bad'}>
        <div class="feedback-head">
          <span class="feedback-title">{result.correct ? 'Correct' : 'Not quite'}</span>
          <span class="feedback-answer">Answer: {result.correctLabel}</span>
        </div>
        <p style="margin-top:8px">{result.reason}</p>
        {result.working && result.working.length > 0 && (
          <ul class="working">
            {result.working.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {outs && (
          <>
            <div class="outs-label">Your outs ({outs.length})</div>
            <CardRow cards={outs} left />
          </>
        )}
      </div>
      {note && <div class="message">{note}</div>}
      <p class="muted small">Skill: {skillTitle}</p>
      <button type="button" class="btn btn--primary" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
