import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { reviewCard } from '../../src/engine/scheduler';
import type { SkillRecord } from '../../src/engine/curriculum';
import type { ReviewLogRecord, SessionRecord } from '../../src/engine/session';
import { SCHEMA_VERSION, openDb, type Db } from '../../src/storage/db';
import {
  BackupError,
  backupFileName,
  buildBackup,
  importBackup,
  importBackupText,
  parseBackup,
} from '../../src/storage/exportImport';
import { DEFAULT_SETTINGS, createRepo, type Repo } from '../../src/storage/repo';

const T0 = new Date('2026-10-25T08:00:00.000Z');
let counter = 0;
let db: Db;
let repo: Repo;

beforeEach(async () => {
  db = await openDb(`pokerlingo-test-${++counter}`);
  repo = createRepo(db);
});

function record(id: string, outcome: 'again' | 'good' | 'easy' = 'easy'): SkillRecord {
  return { skillId: id, card: reviewCard(undefined, T0, outcome).card, introducedAt: T0.toISOString() };
}

function log(skillId: string, correct: boolean, practice = false): ReviewLogRecord {
  return { skillId, at: T0.toISOString(), correct, rating: correct ? 3 : 1, ms: 4200, seed: 12345, practice };
}

function session(dayKey: string, finished = true): SessionRecord {
  return {
    dayKey,
    startedAt: T0.toISOString(),
    endedAt: new Date(T0.getTime() + 600_000).toISOString(),
    answered: 12,
    correct: 10,
    finished,
  };
}

async function fill(r: Repo) {
  await r.saveReview({ log: log('B1', true), record: record('B1') });
  await r.saveReview({ log: log('B2', false), record: record('B2', 'again') });
  await r.saveReview({ log: log('B1', true, true) }); // practice: no record
  await r.addSession(session('2026-10-24'));
  await r.addSession(session('2026-10-25', false));
  await r.saveSettings({ sessionMinutes: 15, newPerSession: 3, animatedBackground: false });
}

/** Everything in the database, in a form that can be compared. */
async function snapshot(d: Db) {
  return {
    skillStates: await d.getAll('skillStates'),
    reviewLogs: await d.getAll('reviewLogs'),
    sessions: await d.getAll('sessions'),
    settings: await d.get('meta', 'settings'),
    lastExportAt: await d.get('meta', 'lastExportAt'),
    schemaVersion: await d.get('meta', 'schemaVersion'),
  };
}

describe('repo', () => {
  it('starts empty with default settings and the schema version', async () => {
    expect((await repo.loadSkillRecords()).size).toBe(0);
    expect(await repo.listSessions()).toEqual([]);
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await repo.getLastExportAt()).toBeNull();
    expect(await db.get('meta', 'schemaVersion')).toBe(SCHEMA_VERSION);
  });

  it('saves and loads skill records, replacing by skill id', async () => {
    await repo.saveReview({ log: log('B1', true), record: record('B1', 'good') });
    await repo.saveReview({ log: log('B1', true), record: record('B1', 'easy') });
    const all = await repo.loadSkillRecords();
    expect(all.size).toBe(1);
    expect(all.get('B1')).toEqual(record('B1', 'easy'));
  });

  it('keeps ISO date strings in the stored card', async () => {
    await repo.saveReview({ log: log('B1', true), record: record('B1') });
    const card = (await repo.loadSkillRecords()).get('B1')!.card;
    expect(typeof card.due).toBe('string');
    expect(new Date(card.due).toISOString()).toBe(card.due);
  });

  it('logs every answer, including practice ones, without a record', async () => {
    await repo.saveReview({ log: log('B1', true, true) });
    expect((await repo.loadSkillRecords()).size).toBe(0);
    expect(await repo.listReviewLogs()).toEqual([log('B1', true, true)]);
  });

  it('stores sessions in order', async () => {
    await repo.addSession(session('2026-10-24'));
    await repo.addSession(session('2026-10-25'));
    expect((await repo.listSessions()).map((s) => s.dayKey)).toEqual(['2026-10-24', '2026-10-25']);
  });

  it('saves settings and the last export time', async () => {
    await repo.saveSettings({ sessionMinutes: 5, newPerSession: 1, animatedBackground: false });
    await repo.setLastExportAt(T0.toISOString());
    expect(await repo.loadSettings()).toEqual({ sessionMinutes: 5, newPerSession: 1, animatedBackground: false });
    expect(await repo.getLastExportAt()).toBe(T0.toISOString());
  });

  it('falls back to defaults if stored settings are not valid', async () => {
    await db.put('meta', { sessionMinutes: 7, newPerSession: 9 }, 'settings');
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);
    await db.put('meta', { sessionMinutes: 10, newPerSession: 2, animatedBackground: 'yes' }, 'settings');
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reads settings saved before the animated background switch as having it on', async () => {
    await db.put('meta', { sessionMinutes: 20, newPerSession: 1 }, 'settings');
    expect(await repo.loadSettings()).toEqual({ sessionMinutes: 20, newPerSession: 1, animatedBackground: true });
  });

  it('survives closing and reopening the database', async () => {
    const name = `pokerlingo-persist-${++counter}`;
    const first = createRepo(await openDb(name));
    await first.saveReview({ log: log('B1', true), record: record('B1') });
    first.close();
    const second = createRepo(await openDb(name));
    expect((await second.loadSkillRecords()).get('B1')).toEqual(record('B1'));
    expect(await second.listReviewLogs()).toHaveLength(1);
  });

  it('resets progress but keeps settings', async () => {
    await fill(repo);
    await repo.setLastExportAt(T0.toISOString());
    await repo.resetProgress();
    expect((await repo.loadSkillRecords()).size).toBe(0);
    expect(await repo.listReviewLogs()).toEqual([]);
    expect(await repo.listSessions()).toEqual([]);
    expect(await repo.getLastExportAt()).toBeNull();
    expect(await repo.loadSettings()).toEqual({ sessionMinutes: 15, newPerSession: 3, animatedBackground: false });
    expect(await db.get('meta', 'schemaVersion')).toBe(SCHEMA_VERSION);
  });
});

describe('export', () => {
  it('has the format from the plan', async () => {
    await fill(repo);
    const backup = await buildBackup(db, T0);
    expect(Object.keys(backup).sort()).toEqual(
      ['app', 'exportedAt', 'meta', 'reviewLogs', 'schemaVersion', 'sessions', 'skillStates'].sort(),
    );
    expect(backup.app).toBe('pokerlingo');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe(T0.toISOString());
    expect(backup.skillStates).toHaveLength(2);
    expect(backup.reviewLogs).toHaveLength(3);
    expect(backup.sessions).toHaveLength(2);
    expect(backup.meta.settings).toEqual({ sessionMinutes: 15, newPerSession: 3, animatedBackground: false });
    expect(backup.meta.lastExportAt).toBe(T0.toISOString());
  });

  it('does not change the database', async () => {
    await fill(repo);
    const before = await snapshot(db);
    await buildBackup(db, T0);
    expect(await snapshot(db)).toEqual(before);
  });

  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 9, 5, 22, 30))).toBe('pokerlingo-backup-2026-10-05.json');
  });
});

describe('export then import', () => {
  it('gives identical data in a fresh database', async () => {
    await fill(repo);
    const backup = await buildBackup(db, T0);
    await repo.setLastExportAt(T0.toISOString()); // what the app does after saving the file

    const other = await openDb(`pokerlingo-test-${++counter}`);
    await importBackupText(other, JSON.stringify(backup));
    expect(await snapshot(other)).toEqual(await snapshot(db));
  });

  it('survives a trip through JSON text', async () => {
    await fill(repo);
    const text = JSON.stringify(await buildBackup(db, T0));
    expect(parseBackup(text)).toEqual(JSON.parse(text));
  });

  it('replaces what was there before', async () => {
    await fill(repo);
    const backup = await buildBackup(db, T0);

    const other = await openDb(`pokerlingo-test-${++counter}`);
    const otherRepo = createRepo(other);
    await otherRepo.saveReview({ log: log('B9', true), record: record('B9') });
    await otherRepo.addSession(session('2026-01-01'));
    await importBackup(other, backup);

    const records = await otherRepo.loadSkillRecords();
    expect([...records.keys()].sort()).toEqual(['B1', 'B2']);
    expect((await otherRepo.listSessions()).map((s) => s.dayKey)).toEqual(['2026-10-24', '2026-10-25']);
    expect(await otherRepo.listReviewLogs()).toHaveLength(3);
  });

  it('imports an empty backup, clearing everything', async () => {
    const empty = await buildBackup(await openDb(`pokerlingo-test-${++counter}`), T0);
    await fill(repo);
    await importBackup(db, empty);
    expect((await repo.loadSkillRecords()).size).toBe(0);
    expect(await repo.listReviewLogs()).toEqual([]);
    expect(await repo.listSessions()).toEqual([]);
  });

  it('exports again to the same content', async () => {
    await fill(repo);
    const first = await buildBackup(db, T0);
    const other = await openDb(`pokerlingo-test-${++counter}`);
    await importBackup(other, parseBackup(JSON.stringify(first)));
    const second = await buildBackup(other, T0);
    expect(second).toEqual(first);
  });
});

describe('a bad file', () => {
  async function expectRejected(text: string, message: RegExp) {
    await fill(repo);
    const before = await snapshot(db);
    await expect(importBackupText(db, text)).rejects.toThrow(BackupError);
    await expect(importBackupText(db, text)).rejects.toThrow(message);
    expect(await snapshot(db)).toEqual(before); // existing data untouched
  }

  async function goodBackup() {
    const srcDb = await openDb(`pokerlingo-test-${++counter}`);
    await fill(createRepo(srcDb));
    return JSON.parse(JSON.stringify(await buildBackup(srcDb, T0)));
  }

  it('rejects text that is not JSON', async () => {
    await expectRejected('this is not json', /not a pokerlingo backup/);
    await expectRejected('', /not a pokerlingo backup/);
  });

  it('rejects other JSON', async () => {
    await expectRejected('[]', /not a pokerlingo backup/);
    await expectRejected('{"app":"other","schemaVersion":1}', /not a pokerlingo backup/);
    await expectRejected('null', /not a pokerlingo backup/);
  });

  it('rejects a missing or invalid version', async () => {
    await expectRejected('{"app":"pokerlingo"}', /version/);
    await expectRejected('{"app":"pokerlingo","schemaVersion":"1"}', /version/);
    await expectRejected('{"app":"pokerlingo","schemaVersion":0}', /version/);
    await expectRejected('{"app":"pokerlingo","schemaVersion":1.5}', /version/);
  });

  it('rejects a newer version', async () => {
    const file = { ...(await goodBackup()), schemaVersion: SCHEMA_VERSION + 1 };
    await expectRejected(JSON.stringify(file), /newer version/);
  });

  it('rejects a file with a missing store', async () => {
    for (const key of ['skillStates', 'reviewLogs', 'sessions', 'meta', 'exportedAt']) {
      const file = await goodBackup();
      delete file[key];
      await expectRejected(JSON.stringify(file), /damaged/);
    }
  });

  it('rejects damaged records without writing anything', async () => {
    const mutations: ((f: any) => void)[] = [
      (f) => (f.skillStates[0].skillId = 7),
      (f) => delete f.skillStates[0].card,
      (f) => (f.skillStates[0].card.state = 9),
      (f) => (f.skillStates[0].card.due = 'yesterday-ish'),
      (f) => (f.skillStates[0].card.stability = 'high'),
      (f) => f.skillStates.push({ ...f.skillStates[0] }),
      (f) => (f.reviewLogs[0].correct = 'yes'),
      (f) => delete f.reviewLogs[1].seed,
      (f) => (f.sessions[0].dayKey = '25/10/2026'),
      (f) => (f.sessions[1].finished = 1),
      (f) => (f.meta.settings = { sessionMinutes: 7, newPerSession: 2 }),
      (f) => (f.meta.settings = { sessionMinutes: 10, newPerSession: 2, animatedBackground: 'on' }),
      (f) => (f.meta.lastExportAt = 'never'),
      (f) => (f.meta = 'none'),
      (f) => (f.reviewLogs = {}),
    ];
    for (const mutate of mutations) {
      const file = await goodBackup();
      mutate(file);
      await expectRejected(JSON.stringify(file), /damaged/);
    }
  });

  it('rejects a damaged record even when it comes late in a long file', async () => {
    const file = await goodBackup();
    for (let i = 0; i < 200; i++) file.reviewLogs.push({ ...file.reviewLogs[0] });
    file.reviewLogs.push({ ...file.reviewLogs[0], ms: 'slow' });
    await expectRejected(JSON.stringify(file), /damaged/);
  });
});
