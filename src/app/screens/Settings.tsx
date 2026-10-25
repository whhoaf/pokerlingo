import { useRef, useState } from 'preact/hooks';
import pkg from '../../../package.json';
import { BackupError, parseBackup, type BackupFile } from '../../storage/exportImport';
import { NEW_SKILL_CHOICES, SESSION_LENGTHS, type Settings } from '../../storage/repo';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatShortDate } from '../format';

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

interface Props {
  settings: Settings;
  lastExportAt: string | null;
  exporting: boolean;
  exportMessage: string | null;
  onChange(settings: Settings): void;
  onExport(): void;
  onImport(backup: BackupFile): Promise<void>;
  onReset(): Promise<void>;
}

export function SettingsScreen({
  settings,
  lastExportAt,
  exporting,
  exportMessage,
  onChange,
  onExport,
  onImport,
  onReset,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const chooseFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still fires
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setMessage(null);
    } catch (err) {
      const text = err instanceof BackupError ? err.message : 'That file could not be read.';
      setMessage({ text: `${text} Your progress has not been changed.`, error: true });
    }
  };

  const confirmImport = async () => {
    const backup = pending;
    setPending(null);
    if (!backup) return;
    try {
      await onImport(backup);
      setMessage({
        text: `Backup restored: ${count(backup.skillStates.length, 'skill')} and ${count(backup.sessions.length, 'session')}.`,
        error: false,
      });
    } catch {
      setMessage({ text: 'The backup could not be restored. Your progress has not been changed.', error: true });
    }
  };

  const doReset = async () => {
    setConfirmReset(false);
    await onReset();
    setMessage({ text: 'Progress erased. You can start again from the first skill.', error: false });
  };

  return (
    <div class="screen screen--tabs">
      <h1>Settings</h1>

      <div class="stack">
        <div class="field-label" id="len-label">
          Session length
        </div>
        <div class="segmented" role="group" aria-labelledby="len-label">
          {SESSION_LENGTHS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={settings.sessionMinutes === m}
              onClick={() => onChange({ ...settings, sessionMinutes: m })}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div class="stack">
        <div class="field-label" id="new-label">
          New skills per session
        </div>
        <div class="segmented" role="group" aria-labelledby="new-label">
          {NEW_SKILL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={settings.newPerSession === n}
              onClick={() => onChange({ ...settings, newPerSession: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <p class="muted small">New skills only appear once your reviews are cleared.</p>
      </div>

      <div class="stack">
        <div class="field-label">Backup</div>
        <p class="muted small">
          {lastExportAt ? `Last backup: ${formatShortDate(lastExportAt)}.` : 'You have not made a backup yet.'} Your progress
          lives only on this device, so keep a copy.
        </p>
        <button type="button" class="btn" onClick={onExport} disabled={exporting}>
          {exporting ? 'Exporting' : 'Export progress'}
        </button>
        <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
          Import a backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          class="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={chooseFile}
        />
      </div>

      {exportMessage && !message && (
        <div class="message" role="status">
          {exportMessage}
        </div>
      )}
      {message && (
        <div class={message.error ? 'message message--error' : 'message'} role="status">
          {message.text}
        </div>
      )}

      <div class="stack">
        <div class="field-label">Reset</div>
        <button type="button" class="btn btn--danger" onClick={() => setConfirmReset(true)}>
          Reset progress
        </button>
      </div>

      <p class="muted small">
        pokerlingo {pkg.version}. Everything stays on this device. There are no accounts, no analytics and no tracking.
      </p>

      {pending && (
        <ConfirmDialog
          title="Replace your progress?"
          confirmLabel="Replace with this backup"
          danger
          onConfirm={confirmImport}
          onCancel={() => setPending(null)}
        >
          <p>
            This backup has {count(pending.skillStates.length, 'skill')} and {count(pending.sessions.length, 'session')},
            saved on {formatShortDate(pending.exportedAt)}.
          </p>
          <p>Importing replaces all progress on this device.</p>
        </ConfirmDialog>
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Erase all progress?"
          confirmLabel="Erase everything"
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        >
          <p>This deletes your skills, review history and sessions on this device. Your settings stay.</p>
          <p>Export a backup first if you want to keep a copy.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
