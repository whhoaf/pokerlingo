import type { SkillRecord } from '../engine/curriculum';
import type { ReviewEvent, ReviewLogRecord, SessionRecord, SessionSettings } from '../engine/session';
import { SCHEMA_VERSION, type Db } from './db';

export const SESSION_LENGTHS = [5, 10, 15, 20] as const;
export const NEW_SKILL_CHOICES = [1, 2, 3] as const;

export type Settings = SessionSettings;

export const DEFAULT_SETTINGS: Settings = { sessionMinutes: 10, newPerSession: 2 };

export function isValidSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (SESSION_LENGTHS as readonly unknown[]).includes(v.sessionMinutes) &&
    (NEW_SKILL_CHOICES as readonly unknown[]).includes(v.newPerSession)
  );
}

export interface Repo {
  loadSkillRecords(): Promise<Map<string, SkillRecord>>;
  /** Save one answer: its log, and the skill record if the schedule changed, in one transaction. */
  saveReview(event: ReviewEvent): Promise<void>;
  addSession(session: SessionRecord): Promise<void>;
  listSessions(): Promise<SessionRecord[]>;
  listReviewLogs(): Promise<ReviewLogRecord[]>;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getLastExportAt(): Promise<string | null>;
  setLastExportAt(iso: string): Promise<void>;
  /** Erase progress: skills, logs, sessions and the export date. Settings stay. */
  resetProgress(): Promise<void>;
  close(): void;
}

export function createRepo(db: Db): Repo {
  return {
    async loadSkillRecords() {
      const all = await db.getAll('skillStates');
      return new Map(all.map((r) => [r.skillId, r]));
    },

    async saveReview(event) {
      const tx = db.transaction(['skillStates', 'reviewLogs'], 'readwrite');
      if (event.record) void tx.objectStore('skillStates').put(event.record);
      void tx.objectStore('reviewLogs').add(event.log);
      await tx.done;
    },

    async addSession(session) {
      await db.add('sessions', session);
    },

    listSessions: () => db.getAll('sessions'),
    listReviewLogs: () => db.getAll('reviewLogs'),

    async loadSettings() {
      const stored = await db.get('meta', 'settings');
      return isValidSettings(stored) ? { ...stored } : { ...DEFAULT_SETTINGS };
    },

    async saveSettings(settings) {
      await db.put('meta', { ...settings }, 'settings');
    },

    async getLastExportAt() {
      const v = await db.get('meta', 'lastExportAt');
      return typeof v === 'string' ? v : null;
    },

    async setLastExportAt(iso) {
      await db.put('meta', iso, 'lastExportAt');
    },

    async resetProgress() {
      const tx = db.transaction(['skillStates', 'reviewLogs', 'sessions', 'meta'], 'readwrite');
      void tx.objectStore('skillStates').clear();
      void tx.objectStore('reviewLogs').clear();
      void tx.objectStore('sessions').clear();
      void tx.objectStore('meta').delete('lastExportAt');
      void tx.objectStore('meta').put(SCHEMA_VERSION, 'schemaVersion');
      await tx.done;
    },

    close: () => db.close(),
  };
}
