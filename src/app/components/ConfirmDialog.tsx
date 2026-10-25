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
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <div class="stack">{children}</div>
        <button type="button" class={danger ? 'btn btn--primary btn--danger-solid' : 'btn btn--primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
