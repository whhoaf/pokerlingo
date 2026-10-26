import { useState } from 'preact/hooks';
import type { AnswerInput } from '../../engine/types';

type Unit = Extract<AnswerInput, { kind: 'number' }>['unit'];

const UNIT_LABEL: Record<Unit, string> = {
  outs: 'outs',
  '%': '%',
  chips: 'chips',
  bb: 'bb',
};

/** Read what was typed: digits and one decimal point, with an optional % sign. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, '').replace(',', '.').trim();
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

interface Props {
  unit: Unit;
  onSubmit(value: number): void;
}

export function NumberInput({ unit, onSubmit }: Props) {
  const [text, setText] = useState('');
  const value = parseNumber(text);

  const submit = (e: Event) => {
    e.preventDefault();
    if (value !== null) onSubmit(value);
  };

  return (
    <form class="stack" onSubmit={submit}>
      <label class="panel numfield">
        <span class="visually-hidden">Your answer in {UNIT_LABEL[unit]}</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          placeholder="0"
          value={text}
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        />
        <span class="numfield-unit">{UNIT_LABEL[unit]}</span>
      </label>
      <button type="submit" class="btn btn--big btn--blue" disabled={value === null}>
        Check
      </button>
    </form>
  );
}

/** What was answered, kept on screen behind the feedback sheet: green border if right, red if not. */
export function NumberShown({ unit, value, correct }: { unit: Unit; value: number; correct: boolean }) {
  return (
    <div class={correct ? 'panel numfield numfield--right' : 'panel numfield numfield--wrong'}>
      <span class="numfield-value">{value}</span>
      <span class="numfield-unit">{UNIT_LABEL[unit]}</span>
    </div>
  );
}
