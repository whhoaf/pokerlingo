import type { AnswerInput } from '../../engine/types';
import { CardRow } from './PlayingCard';

interface Props {
  options: Extract<AnswerInput, { kind: 'choice' }>['options'];
  onPick(id: string): void;
  /** Once answered the buttons lock and show which was picked and which was right. */
  picked?: string;
  correctId?: string;
}

export function ChoiceInput({ options, onPick, picked, correctId }: Props) {
  const locked = picked !== undefined;
  return (
    <div class="choices" role="group" aria-label="Answer choices">
      {options.map((o) => {
        const classes = ['choice'];
        if (locked && o.id === picked) classes.push('choice--picked');
        if (locked && correctId !== undefined && o.id === correctId) classes.push('choice--right');
        else if (locked && o.id === picked) classes.push('choice--wrong');
        return (
          <button key={o.id} type="button" class={classes.join(' ')} disabled={locked} onClick={() => onPick(o.id)}>
            {o.cards && <CardRow cards={o.cards} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
