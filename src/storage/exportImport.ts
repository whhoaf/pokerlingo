import type { SkillRecord } from '../engine/curriculum';
import type { ReviewLogRecord, SessionRecord } from '../engine/session';
import type { StoredCard } from '../engine/scheduler';
import { SCHEMA_VERSION, type Db } from './db';
import { isValidSettings } from './repo';

export interface BackupFile {
  app: 'pokerlingo';
  schemaVersion: number;
  exportedAt: string;
  skillStates: SkillRecord[];
  reviewLogs: ReviewLogRecord[];
  sessions: SessionRecord[];
  meta: Record<string, unknown>;
}

/** Thrown for any backup file that cannot be imported. The message is safe to show. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** pokerlingo-backup-YYYY-MM-DD.json, using the local date. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `pokerlingo-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Read every store into a backup object. Does not change the database. */
export async function buildBackup(db: Db, now: Date): Promise<BackupFile> {
  const tx = db.transaction(['skillStates', 'reviewLogs', 'sessions', 'meta'], 'readonly');
  const [skillStates, reviewLogs, sessions, metaKeys, metaValues] = await Promise.all([
    tx.objectStore('skillStates').getAll(),
    tx.objectStore('reviewLogs').getAll(),
    tx.objectStore('sessions').getAll(),
    tx.objectStore('meta').getAllKeys(),
    tx.objectStore('meta').getAll(),
  ]);
  const meta: Record<string, unknown> = {};
  metaKeys.forEach((key, i) => {
    meta[String(key)] = metaValues[i];
  });
  meta.lastExportAt = now.toISOString();
  meta.schemaVersion = SCHEMA_VERSION;
  return {
    app: 'pokerlingo',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    skillStates,
    reviewLogs,
    sessions,
    meta,
  };
}

// ---- validation ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isDate = (v: unknown): v is string => isString(v) && !Number.isNaN(Date.parse(v));

function fail(what: string): never {
  throw new BackupError(`This backup file is damaged (${what}).`);
}

function readCard(v: unknown): StoredCard {
  if (!isObject(v)) return fail('a skill has no schedule');
  const { due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state } = v;
  if (
    !isDate(due) ||
    !isNumber(stability) ||
    !isNumber(difficulty) ||
    !isNumber(elapsed_days) ||
    !isNumber(scheduled_days) ||
    !isNumber(learning_steps) ||
    !isNumber(reps) ||
    !isNumber(lapses) ||
    !isNumber(state) ||
    !Number.isInteger(state) ||
    state < 0 ||
    state > 3
  ) {
    return fail('a skill schedule is not valid');
  }
  const card: StoredCard = { due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state };
  if (v.last_review !== undefined) {
    if (!isDate(v.last_review)) return fail('a skill schedule has a bad date');
    card.last_review = v.last_review;
  }
  return card;
}

function readSkillState(v: unknown): SkillRecord {
  if (!isObject(v) || !isString(v.skillId) || v.skillId === '' || !isDate(v.introducedAt)) {
    return fail('a skill record is not valid');
  }
  return { skillId: v.skillId, introducedAt: v.introducedAt, card: readCard(v.card) };
}

function readReviewLog(v: unknown): ReviewLogRecord {
  if (
    !isObject(v) ||
    !isString(v.skillId) ||
    !isDate(v.at) ||
    !isBool(v.correct) ||
    !isNumber(v.rating) ||
    !isNumber(v.ms) ||
    !isNumber(v.seed) ||
    !isBool(v.practice)
  ) {
    return fail('a review log entry is not valid');
  }
  return { skillId: v.skillId, at: v.at, correct: v.correct, rating: v.rating, ms: v.ms, seed: v.seed, practice: v.practice };
}

function readSession(v: unknown): SessionRecord {
  if (
    !isObject(v) ||
    !isString(v.dayKey) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.dayKey) ||
    !isDate(v.startedAt) ||
    !isDate(v.endedAt) ||
    !isNumber(v.answered) ||
    !isNumber(v.correct) ||
    !isBool(v.finished)
  ) {
    return fail('a session record is not valid');
  }
  return {
    dayKey: v.dayKey,
    startedAt: v.startedAt,
    endedAt: v.endedAt,
    answered: v.answered,
    correct: v.correct,
    finished: v.finished,
  };
}

function readArray<T>(value: unknown, name: string, read: (v: unknown) => T): T[] {
  if (!Array.isArray(value)) return fail(`${name} is missing`);
  return value.map(read);
}

function readMeta(value: unknown): Record<string, unknown> {
  if (!isObject(value)) return fail('settings are missing');
  const meta: Record<string, unknown> = { schemaVersion: SCHEMA_VERSION };
  if (value.settings !== undefined) {
    if (!isValidSettings(value.settings)) return fail('the settings are not valid');
    meta.settings = { sessionMinutes: value.settings.sessionMinutes, newPerSession: value.settings.newPerSession };
  }
  if (value.lastExportAt !== undefined) {
    if (!isDate(value.lastExportAt)) return fail('the last export date is not valid');
    meta.lastExportAt = value.lastExportAt;
  }
  return meta;
}

/** Older backups are upgraded here. Version 1 is the only one so far. */
function migrate(file: Record<string, unknown>): Record<string, unknown> {
  return file;
}

/**
 * Parse and check backup text. Throws BackupError if it cannot be used.
 * Nothing is written, so a bad file never touches existing data.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not a pokerlingo backup. It could not be read.');
  }
  if (!isObject(raw) || raw.app !== 'pokerlingo') {
    throw new BackupError('This file is not a pokerlingo backup.');
  }
  if (!isNumber(raw.schemaVersion) || !Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) {
    throw new BackupError('This backup has no valid version number.');
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of pokerlingo. Update the app first.');
  }
  const file = migrate(raw);
  if (!isDate(file.exportedAt)) return fail('the export date is missing');

  const skillStates = readArray(file.skillStates, 'the skill list', readSkillState);
  const ids = new Set(skillStates.map((s) => s.skillId));
  if (ids.size !== skillStates.length) return fail('a skill appears twice');

  return {
    app: 'pokerlingo',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: file.exportedAt,
    skillStates,
    reviewLogs: readArray(file.reviewLogs, 'the review log', readReviewLog),
    sessions: readArray(file.sessions, 'the session list', readSession),
    meta: readMeta(file.meta),
  };
}

/** Replace every store with the backup, in one transaction. All or nothing. */
export async function importBackup(db: Db, backup: BackupFile): Promise<void> {
  const tx = db.transaction(['skillStates', 'reviewLogs', 'sessions', 'meta'], 'readwrite');
  const skills = tx.objectStore('skillStates');
  const logs = tx.objectStore('reviewLogs');
  const sessions = tx.objectStore('sessions');
  const meta = tx.objectStore('meta');

  void skills.clear();
  void logs.clear();
  void sessions.clear();
  void meta.clear();
  for (const s of backup.skillStates) void skills.put(s);
  for (const l of backup.reviewLogs) void logs.add(l);
  for (const s of backup.sessions) void sessions.add(s);
  for (const [key, value] of Object.entries(backup.meta)) void meta.put(value, key);
  void meta.put(SCHEMA_VERSION, 'schemaVersion');
  await tx.done;
}

/** Parse then import. Convenience for the settings screen. */
export async function importBackupText(db: Db, text: string): Promise<BackupFile> {
  const backup = parseBackup(text);
  await importBackup(db, backup);
  return backup;
}
