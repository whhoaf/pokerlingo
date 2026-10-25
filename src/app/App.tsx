import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { curriculum } from '../skills';
import { PracticeRun, Session, type SessionSummary } from '../engine/session';
import { readBrowser, shouldShowInstallScreen } from '../pwa/install';
import type { Db } from '../storage/db';
import { buildBackup, importBackup, type BackupFile } from '../storage/exportImport';
import { createRepo, type Settings } from '../storage/repo';
import { saveBackupFile } from './backupFile';
import { needsExport } from './backupStatus';
import { loadAppData, overview, type AppData } from './data';
import { HomeScreen } from './screens/Home';
import { InstallScreen } from './screens/Install';
import { PracticeScreen } from './screens/Practice';
import { SessionScreen } from './screens/Session';
import { SettingsScreen } from './screens/Settings';
import { SkillDetailScreen } from './screens/SkillDetail';
import { SkillMapScreen } from './screens/SkillMap';
import { SummaryScreen } from './screens/Summary';

type Screen =
  | { name: 'install' }
  | { name: 'home' }
  | { name: 'session'; session: Session; totalMs: number }
  | { name: 'summary'; summary: SessionSummary }
  | { name: 'skills' }
  | { name: 'skill'; id: string }
  | { name: 'practice'; run: PracticeRun; id: string }
  | { name: 'settings' };

const TAB_SCREENS = new Set(['home', 'skills', 'skill', 'settings']);
const DISMISS_KEY = 'pokerlingo-install-dismissed';

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] as number;
}

function installDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function App({ db }: { db: Db }) {
  const repo = useMemo(() => createRepo(db), [db]);
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>(() => {
    const { browser, display } = readBrowser();
    return shouldShowInstallScreen(browser, display, installDismissed()) ? { name: 'install' } : { name: 'home' };
  });
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Saves run one after another, so a session's records land in order.
  const writes = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    writes.current = writes.current.then(job).catch((e) => console.error('Save failed', e));
  }, []);

  const reload = useCallback(async () => {
    await writes.current;
    setData(await loadAppData(repo));
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!data) {
    return (
      <div class="screen">
        <p class="muted">Loading</p>
      </div>
    );
  }

  const now = new Date();
  const ov = overview(data, curriculum, now);

  const go = (s: Screen) => setScreen(s);

  const startSession = () => {
    const session = new Session({
      curriculum,
      records: data.records,
      settings: data.settings,
      now: () => new Date(),
      seed: randomSeed(),
      onReview: (event) => enqueue(() => repo.saveReview(event)),
      onEnd: (record) => enqueue(() => repo.addSession(record)),
    });
    go({ name: 'session', session, totalMs: data.settings.sessionMinutes * 60_000 });
  };

  const sessionEnded = async (summary: SessionSummary) => {
    await reload();
    go({ name: 'summary', summary });
  };

  const startPractice = (id: string) => {
    const run = new PracticeRun({
      skill: curriculum.get(id),
      now: () => new Date(),
      seed: randomSeed(),
      onReview: (event) => enqueue(() => repo.saveReview(event)),
    });
    go({ name: 'practice', run, id });
  };

  const exportProgress = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const when = new Date();
      const backup = await buildBackup(db, when);
      const outcome = await saveBackupFile(backup, when);
      if (outcome === 'cancelled') {
        setExportMessage('Export cancelled. Nothing was saved.');
      } else {
        await repo.setLastExportAt(when.toISOString());
        setExportMessage(outcome === 'shared' ? 'Backup shared.' : 'Backup downloaded.');
        await reload();
      }
    } catch (e) {
      console.error(e);
      setExportMessage('The backup could not be saved. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const importProgress = async (backup: BackupFile) => {
    await importBackup(db, backup);
    await reload();
  };

  const resetProgress = async () => {
    await repo.resetProgress();
    await reload();
  };

  const changeSettings = async (settings: Settings) => {
    await repo.saveSettings(settings);
    await reload();
  };

  const showExportBanner = needsExport(data.lastExportAt, ov.finishedSessions, now);

  let body;
  switch (screen.name) {
    case 'install':
      body = (
        <InstallScreen
          onContinue={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // Storage may be blocked. The choice then lasts until the next load.
            }
            go({ name: 'home' });
          }}
        />
      );
      break;
    case 'home':
      body = (
        <HomeScreen
          ov={ov}
          sessionMinutes={data.settings.sessionMinutes}
          nextDue={ov.nextDue}
          now={now}
          showExportBanner={showExportBanner}
          exporting={exporting}
          exportMessage={exportMessage}
          onStart={startSession}
          onExport={exportProgress}
        />
      );
      break;
    case 'session':
      body = (
        <SessionScreen
          session={screen.session}
          curriculum={curriculum}
          totalMs={screen.totalMs}
          onEnded={(summary) => void sessionEnded(summary)}
        />
      );
      break;
    case 'summary':
      body = (
        <SummaryScreen
          summary={screen.summary}
          streak={ov.streak}
          curriculum={curriculum}
          onDone={() => go({ name: 'home' })}
        />
      );
      break;
    case 'skills':
      body = (
        <SkillMapScreen curriculum={curriculum} records={data.records} onOpen={(id) => go({ name: 'skill', id })} />
      );
      break;
    case 'skill':
      body = (
        <SkillDetailScreen
          skillId={screen.id}
          curriculum={curriculum}
          records={data.records}
          logs={data.logs}
          now={now}
          onBack={() => go({ name: 'skills' })}
          onPractise={() => startPractice(screen.id)}
        />
      );
      break;
    case 'practice':
      body = (
        <PracticeScreen
          run={screen.run}
          skill={curriculum.get(screen.id)}
          onDone={async () => {
            await reload();
            go({ name: 'skill', id: screen.id });
          }}
        />
      );
      break;
    case 'settings':
      body = (
        <SettingsScreen
          settings={data.settings}
          lastExportAt={data.lastExportAt}
          exporting={exporting}
          onChange={changeSettings}
          onExport={exportProgress}
          onImport={importProgress}
          onReset={resetProgress}
        />
      );
      break;
  }

  const tab = screen.name === 'skill' ? 'skills' : screen.name;
  return (
    <>
      {body}
      {TAB_SCREENS.has(screen.name) && (
        <nav class="tabbar" aria-label="Main">
          <div class="tabbar-inner">
            {(
              [
                ['home', 'Today'],
                ['skills', 'Skills'],
                ['settings', 'Settings'],
              ] as const
            ).map(([name, label]) => (
              <button
                key={name}
                type="button"
                class="tab"
                aria-current={tab === name ? 'page' : undefined}
                onClick={() => go({ name })}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
