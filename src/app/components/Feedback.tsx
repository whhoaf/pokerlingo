import { useLayoutEffect, useRef } from 'preact/hooks';
import type { GradeResult } from '../../engine/types';
import { sortByRank } from '../../engine/cards';
import { DraftNote } from './DraftNote';
import { CardRow } from './PlayingCard';
import { RangeGrid } from './RangeGrid';

interface Props {
  result: GradeResult;
  skillTitle: string;
  /** Extra line, for example when a new skill was placed straight into reviews. */
  note?: string;
  nextLabel?: string;
  onNext(): void;
}

/**
 * Right or wrong, the correct answer, one line of reasoning and the supporting picture, on a sheet that slides up
 * from the bottom. The Next button stays on the sheet, and the screen behind gets room to scroll above it.
 */
export function Feedback({ result, skillTitle, note, nextLabel = 'Next', onNext }: Props) {
  // Outs are sorted high to low. Labelled cards keep the order the skill gave them.
  const shown =
    result.highlight && result.highlight.length > 0
      ? result.highlightLabel
        ? result.highlight
        : sortByRank(result.highlight)
      : null;
  const shownLabel = result.highlightLabel ?? `Your outs (${shown?.length ?? 0})`;

  const sheet = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const root = document.documentElement.style;
    const update = () => root.setProperty('--sheet-h', `${el.offsetHeight}px`);
    update();
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    watcher?.observe(el);
    return () => {
      watcher?.disconnect();
      root.setProperty('--sheet-h', '0px');
    };
  }, []);

  return (
    <section ref={sheet} class={result.correct ? 'sheet sheet--good' : 'sheet sheet--bad'} aria-live="polite">
      <div class="sheet-body">
        <div class="res">
          <span class="res-word">{result.correct ? 'Right!' : 'Not quite'}</span>
          {result.correct && <span class="plus">+1</span>}
        </div>
        <div class="ansbox">
          <div class="lbl">Answer</div>
          <div class="ansline">{result.correctLabel}</div>
        </div>
        <p class="why">{result.reason}</p>
        {result.rangeGrid && <RangeGrid grid={result.rangeGrid} showTitle={false} compact />}
        {result.working && result.working.length > 0 && (
          <ul class="work">
            {result.working.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {shown && (
          <div class="outs">
            <div class="lbl">{shownLabel}</div>
            <CardRow cards={shown} left />
          </div>
        )}
        {result.sources && result.sources.length > 0 && (
          <p class="small sources">
            {result.sources.length === 1 ? 'Source' : 'Sources'}: {result.sources.join('; ')}
          </p>
        )}
        {result.draft && <DraftNote />}
        {note && <div class="note-box">{note}</div>}
        <p class="small">Skill: {skillTitle}</p>
      </div>
      <div class="sheet-foot">
        <button type="button" class="btn btn--big btn--orange" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}
