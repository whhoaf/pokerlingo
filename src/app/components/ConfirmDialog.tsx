import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  children: ComponentChildren;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: Props) {
  return (
    <div class="overlay" role="presentation">
      <div class="panel dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <div class="stack">{children}</div>
        <button type="button" class={danger ? 'btn btn--big btn--red' : 'btn btn--big btn--blue'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" class="btn btn--big btn--dark" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
