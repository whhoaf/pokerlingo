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
  // Outs are sorted high to low. Labelled cards keep the order the skill gave them.
  const shown =
    result.highlight && result.highlight.length > 0
      ? result.highlightLabel
        ? result.highlight
        : sortByRank(result.highlight)
      : null;
  const shownLabel = result.highlightLabel ?? `Your outs (${shown?.length ?? 0})`;
  // The button is a direct child of the screen, not of the stack. A sticky element cannot leave its
  // parent, so inside the stack it was pushed below the fold when feedback began near the bottom.
  return (
    <>
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
          {shown && (
            <>
              <div class="outs-label">{shownLabel}</div>
              <CardRow cards={shown} left />
            </>
          )}
        </div>
        {note && <div class="message">{note}</div>}
        <p class="muted small">Skill: {skillTitle}</p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn--primary" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </>
  );
}
