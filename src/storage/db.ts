import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SkillRecord } from '../engine/curriculum';
import type { ReviewLogRecord, SessionRecord } from '../engine/session';

export const DB_NAME = 'pokerlingo';
export const DB_VERSION = 1;
/** The version of the backup file and of the stored data. */
export const SCHEMA_VERSION = 1;

export interface PokerlingoDB extends DBSchema {
  skillStates: { key: string; value: SkillRecord };
  reviewLogs: { key: number; value: ReviewLogRecord };
  sessions: { key: number; value: SessionRecord };
  meta: { key: string; value: unknown };
}

export type Db = IDBPDatabase<PokerlingoDB>;

export const STORE_NAMES = ['skillStates', 'reviewLogs', 'sessions', 'meta'] as const;

export function openDb(name: string = DB_NAME): Promise<Db> {
  return openDB<PokerlingoDB>(name, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      db.createObjectStore('skillStates', { keyPath: 'skillId' });
      db.createObjectStore('reviewLogs', { autoIncrement: true });
      db.createObjectStore('sessions', { autoIncrement: true });
      db.createObjectStore('meta');
      void tx.objectStore('meta').put(SCHEMA_VERSION, 'schemaVersion');
    },
  });
}
