import type { AnswerInput } from '../../engine/types';
import { CardRow } from './PlayingCard';

interface Props {
  options: Extract<AnswerInput, { kind: 'choice' }>['options'];
  onPick(id: string): void;
  /** Once answered the buttons lock and show which was picked and which was right. */
  picked?: string;
  /** Every choice that counts as right. More than one when the chart accepts two actions, or several sizes fit. */
  correctIds?: string[];
}

export function ChoiceInput({ options, onPick, picked, correctIds }: Props) {
  const locked = picked !== undefined;
  const withCards = options.some((o) => o.cards);
  // Four short labels, such as seat names, sit two by two. That saves two rows of height on a phone.
  const pairs = !withCards && options.length === 4 && options.every((o) => o.label.length <= 5);
  return (
    <div
      class={withCards ? 'choices choices--cards' : pairs ? 'choices choices--pairs' : 'choices'}
      role="group"
      aria-label="Answer choices"
    >
      {options.map((o) => {
        const classes = ['choice'];
        if (locked && o.id === picked) classes.push('choice--picked');
        if (locked && correctIds !== undefined && correctIds.includes(o.id)) classes.push('choice--right');
        else if (locked && o.id === picked) classes.push('choice--wrong');
        return (
          <button key={o.id} type="button" class={classes.join(' ')} disabled={locked} onClick={() => onPick(o.id)}>
            {o.cards ? (
              <>
                {/* Choices that are holdings show as mini cards. The label stays for screen readers. */}
                <span aria-hidden="true">
                  <CardRow cards={o.cards} />
                </span>
                <span class="visually-hidden">{o.label}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        );
      })}
    </div>
  );
}
