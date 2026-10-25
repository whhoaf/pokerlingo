import { backupFileName, type BackupFile } from '../storage/exportImport';

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hand the backup to the user. The Web Share API with a file is used when the
 * browser supports it (iOS), otherwise a download link.
 */
export async function saveBackupFile(backup: BackupFile, now: Date): Promise<SaveOutcome> {
  const name = backupFileName(now);
  const text = JSON.stringify(backup, null, 2);
  const file = new File([text], name, { type: 'application/json' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'pokerlingo backup' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Sharing failed for another reason: fall through to a download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
