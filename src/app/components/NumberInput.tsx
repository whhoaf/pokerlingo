import { useState } from 'preact/hooks';
import type { AnswerInput } from '../../engine/types';

const UNIT_LABEL: Record<Extract<AnswerInput, { kind: 'number' }>['unit'], string> = {
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
  unit: Extract<AnswerInput, { kind: 'number' }>['unit'];
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
      <div class="number-input">
        <label class="number-field">
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
          <span class="number-unit">{UNIT_LABEL[unit]}</span>
        </label>
      </div>
      <button type="submit" class="btn btn--primary" disabled={value === null}>
        Check
      </button>
    </form>
  );
}
