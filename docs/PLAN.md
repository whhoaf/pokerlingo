# pokerlingo implementation plan

Scope comes from [`PRD.md`](../PRD.md). This file says how to build it. If the two disagree, the PRD wins.

## Rules for coding agents

- Read `PRD.md` and this file before starting. Write one progress report per milestone in `docs/progress/`.
- Do not edit `PRD.md` or `docs/prd-summary.html`. Do not create `CLAUDE.md` or `AGENTS.md`. If the PRD and this plan conflict, follow the PRD and note the conflict in the progress report.
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run preview`.
- Never run `npm run deploy` or `git push`; the owner deploys. Commit after each task with a clear message. Never force-push or rewrite history.
- Engine code (`src/engine`, `src/skills`, `src/storage`) is pure TypeScript with no DOM access, and every module has tests. A question must be fully determined by its skill ID and seed.
- Writing rules for every user-facing string, code comment and doc: no em dashes or en dashes (use a comma, colon or full stop, or the word "to" for ranges). Short, plain sentences. British spelling (colour, practise as a verb).
- No analytics, no third-party requests, no web fonts or CDNs. The app works offline after the first load.
- Card notation inside the code: pokersolver strings such as `As`, `Td`, `9h`. On screen: rank plus suit symbol, with hearts and diamonds in red.

## Builder decisions

PRD section 8 left these to the implementation plan.

- **Stack:** Vite, TypeScript (strict), Preact. Vitest for tests, `fake-indexeddb` for storage tests. `vite-plugin-pwa` for the manifest and service worker. `idb` for IndexedDB. `ts-fsrs` for scheduling, `pokersolver` for hand evaluation.
- **Deploy:** `npm run deploy` builds and publishes `dist/` to the `gh-pages` branch with the `gh-pages` package (`gh-pages -d dist -t`). GitHub Pages serves that branch. No GitHub Actions workflow. Only the owner runs deploys.
- **Base path:** `/pokerlingo/` (served at https://whhoaf.github.io/pokerlingo/).
- **Look and feel:** builder's pick, described below.

## Layout

```
src/
  main.tsx                 mount the app, register the service worker
  app/
    App.tsx                screen state machine
    screens/               Install, Home, Session, Summary, SkillMap, SkillDetail, Settings
    components/            PlayingCard, Table, ChoiceInput, NumberInput, Feedback, Timer, Explainer
    styles.css
  engine/                  pure TypeScript, no DOM, fully unit tested
    rng.ts                 seeded PRNG (mulberry32) and helpers: int, pick, shuffle
    cards.ts               Card type, deck, parse and format, suit symbols, dealing without replacement
    handEval.ts            typed wrapper around pokersolver
    outs.ts                brute-force outs counter with predicates
    odds.ts                requiredEquity, ruleOf2And4, exactEquity
    scheduler.ts           ts-fsrs wrapper
    session.ts             session engine with an injectable clock
    curriculum.ts          skill registry, intro order, prerequisites, skill states
    day.ts                 day key with a 4am rollover, streaks
    types.ts               shared contracts (below)
  skills/
    B/B1.ts ... B/B9.ts    one SkillDef per file
    index.ts               registry of all skills
  storage/
    db.ts                  IndexedDB schema
    repo.ts                load and save
    exportImport.ts        backup file export and import
  pwa/
    install.ts             isIosSafari, isStandalone
public/                    icons, .nojekyll
scripts/make_icons.py      draws the icons with Pillow
tests/                     mirrors src/
docs/progress/             one report per milestone
```

## Contracts

```ts
export type Area = 'A' | 'B' | 'C' | 'D';
export type Card = string; // pokersolver notation: rank (2-9, T, J, Q, K, A) + suit (s, h, d, c)

export interface TableView {
  hole?: Card[];      // your cards
  board?: Card[];     // 0, 3, 4 or 5 cards
  villain?: Card[];   // only in showdown questions
  pot?: number;       // pot before the current bet, in chips
  bet?: number;       // amount you must call
  seat?: string;      // e.g. 'BTN'
  players?: number;   // table size
  note?: string;      // one line of context, e.g. 'One card to come'
}

export type AnswerInput =
  | { kind: 'choice'; options: { id: string; label: string; cards?: Card[] }[] }
  | { kind: 'number'; unit: 'outs' | '%' | 'chips' | 'bb' };

export type Answer = { kind: 'choice'; id: string } | { kind: 'number'; value: number };

export interface GradeResult {
  correct: boolean;
  correctLabel: string;   // e.g. '9 outs', 'Call'
  reason: string;         // one line
  working?: string[];     // short lines, e.g. ['You need 25%', 'You have about 18%']
  highlight?: Card[];     // cards to highlight in feedback
}

export interface Question {
  skillId: string;
  seed: number;
  prompt: string;
  table: TableView;
  input: AnswerInput;
  grade(answer: Answer): GradeResult;
}

export interface SkillDef {
  id: string;             // 'B1' and so on, stable forever
  area: Area;
  title: string;
  prereqs: string[];
  generate(seed: number): Question;   // deterministic for a given seed
  explainer: {
    body: string[];       // short paragraphs, one screen in total
    example: { prompt: string; table: TableView; answer: string; working: string[] };
  };
  furtherReading?: { label: string; url: string }[];
}
```

## Learning engine rules

These make PRD section 4 exact.

- **FSRS parameters:** `request_retention: 0.9`, `enable_fuzz: true`, `enable_short_term: true`, `learning_steps: ['1m', '10m']`, `relearning_steps: ['10m']`.
- **Ratings:** right is Good, wrong is Again. A placement (both probe questions right) is Easy as the first rating.
- **Skill states for the map:** Locked (a prerequisite not yet introduced), New (unlocked, never introduced), Learning (FSRS Learning or Relearning), Reviewing (Review with stability under 21 days), Strong (Review with stability of 21 days or more).
- **Due:** `card.due <= now`. Due reviews are served lowest retrievability first.
- **Session** (length default 10 minutes; setting 5, 10, 15 or 20):
  1. Build the due list at session start.
  2. Serve due skills one at a time. After a wrong answer, schedule an in-session retry 2 to 4 questions later (seeded random) with a fresh question seed, if time remains. Every answer, retries included, updates FSRS.
  3. When no due or retry items remain, at least 2 minutes remain, and fewer than `newPerSession` skills (default 2, setting 1 to 3) were introduced today, introduce the next unlocked skill in intro order: 2 probe questions; both right means placement (Easy) and the skill is done for now; otherwise show the explainer, then practice questions until one is right or 3 have been asked, and the first FSRS rating comes from the last practice answer.
  4. When the timer reaches zero, the current question finishes (feedback included), then the session ends. It ends early when nothing is left.
  5. Unanswered due items stay due. No new skill is introduced while any review is due, overdue ones from earlier days included.
- **Day key:** the local date of `now - 4 hours`. **Streak:** consecutive day keys with a finished session. A finished session is one where the timer ran out or nothing was left.
- **Extra practice** from the skill map: questions and feedback as usual, logged with `practice: true`, never changes FSRS state.

## Storage

- IndexedDB database `pokerlingo`, version 1. Stores:
  - `skillStates`, key `skillId`: `{ skillId, card, introducedAt }`, with the ts-fsrs card's dates stored as ISO strings.
  - `reviewLogs`, auto-increment: `{ skillId, at, correct, rating, ms, seed, practice }`.
  - `sessions`, auto-increment: `{ dayKey, startedAt, endedAt, answered, correct, finished }`.
  - `meta`, key-value: settings, `lastExportAt`, `schemaVersion`.
- **Export:** `{ app: 'pokerlingo', schemaVersion: 1, exportedAt, skillStates, reviewLogs, sessions, meta }` saved as `pokerlingo-backup-YYYY-MM-DD.json`. Use the Web Share API with a File when available (iOS), otherwise a download link.
- **Import:** check `app` and `schemaVersion`, ask for confirmation, then replace every store in one transaction.
- Call `navigator.storage.persist()` when available.
- Home shows an export banner when the last export is more than 7 days old (or there has never been one and at least one session is finished).

## Install and offline

- Manifest: `name` and `short_name` 'pokerlingo', `start_url` and `scope` '/pokerlingo/', `display: 'standalone'`, `theme_color: '#1f6b4a'`, `background_color: '#f5f2ea'`, icons 192 and 512 (512 also maskable).
- `index.html`: apple-touch-icon (180), `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` 'pokerlingo', `viewport-fit=cover`.
- Service worker from `vite-plugin-pwa` (`generateSW`, `registerType: 'autoUpdate'`), precaching every build asset, so the app works offline after the first load.
- **Install screen (PRD F1):** shown on iOS and iPadOS Safari when not running standalone (`navigator.standalone !== true` and not `display-mode: standalone`). It explains Share, then Add to Home Screen, in words. A "Continue in the browser" link stays available, warning that progress made there will not carry into the Home Screen app. Other browsers skip this screen.

## Look and feel

- Palette from `docs/prd-summary.html`: paper `#f5f2ea`, ink `#1c1c1a`, felt `#1f6b4a`, red `#b3261e` for hearts and diamonds, ink for spades and clubs, gold `#9a6b00` for highlights.
- System font stack. No web fonts, no CDNs, no third-party requests.
- Playing cards: white rounded rectangles, rank above the suit symbol, about 56 by 78 px on a 390 px screen. The table is a felt-green rounded panel: board in the middle, your cards below, pot and bet as labelled chips.
- Phone portrait first, 390 px wide. Tap targets at least 48 px tall. No horizontal scroll. Respect safe-area insets. Primary buttons sit low, within thumb reach.
- Copy: short and plain, British spelling, no em dashes or en dashes anywhere.

## Milestone 1: engine, app shell, Area B

**Tasks**

1. Scaffold by hand (no interactive create tools): `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`. Scripts: `dev`, `build`, `preview`, `test`, `typecheck`, `deploy`.
2. `engine/rng.ts` with tests: same seed gives the same sequence; values in range.
3. `engine/cards.ts` with tests.
4. `engine/handEval.ts` with tests on known hands (name, comparison, ties).
5. `engine/outs.ts` with tests: flush draw 9, open-ended straight draw 8, gutshot 4, two overcards to top pair 6, flush draw plus open-ended straight draw 15.
6. `engine/odds.ts` with tests: required equity is `bet / (pot + 2 * bet)` where `pot` is the pot before the bet, so 1/3 pot gives 20%, 1/2 gives 25%, 2/3 gives 28.6%, full pot gives 33.3%. Rule of 2 and 4. Exact equity for one and two cards to come.
7. `engine/scheduler.ts` with tests: rating mapping, Easy placement, state buckets, retrievability ordering.
8. `engine/day.ts` with tests: 4am rollover, streak counting and reset.
9. `engine/session.ts` with fake-clock tests: due ordering, retry 2 to 4 questions later, new skills only when nothing is due and 2 minutes remain, the per-day cap, timer end after the current question, early end when nothing is left.
10. Skills B1 to B9 (specs below). For each, a test runs 500 seeds and checks that the question is valid (no duplicate cards), that the grader's answer matches an independent computation (`outs.ts` brute force, `odds.ts`), and that a wrong answer grades as wrong.
11. Storage with `fake-indexeddb` tests: export then import gives identical data; a bad file is rejected without touching existing data.
12. UI: every screen and component listed in the layout, including the probe, explainer and practice flow for new skills, the export banner and settings (session length, new skills per session, export, import, reset with confirmation).
13. Offline and install: manifest, icons (`scripts/make_icons.py`), service worker, meta tags, install screen.
14. Visual check: build, run `vite preview`, capture 390 by 844 screenshots of every screen and state with a Playwright script, look at each one, fix any layout defect.
15. Write `docs/progress/M1.md`: what was built, test counts, known gaps, any place the plan was changed and why.

**Acceptance:** `npm test`, `npm run typecheck` and `npm run build` pass. A full session can be played in the preview from first run to summary. Progress survives a reload. Export then import restores the same state. Screenshots show no overflow or clipped text.

### Area B skill specs

Outs for B1, B2, B3 and B5 are the unseen cards that give you a straight or a flush (or a straight flush) when you have neither now. Generators use unpaired boards, so every out is clean, and the explainer says v1 counts clean outs only. Prompts never name the draw: recognising it is part of the skill.

- **B1, flush draw:** you hold four to a flush (two suited hole cards and two of that suit on the board, or one hole card and three on the board), on the flop or the turn, with no straight draw. Answer 9.
- **B2, open-ended straight draw:** four consecutive ranks using at least one hole card, open at both ends (no ace at either end), no flush draw. Answer 8.
- **B3, gutshot:** one rank missing inside a straight, no flush draw, exactly 4 outs by brute force (avoid double gutshots). Answer 4.
- **B4, overcards:** two hole cards above every board card, unpaired dry board, no straight or flush draw. Outs to top pair: cards that pair one of your hole cards. Answer 6.
- **B5, combination draws:** flush draw plus open-ended straight draw (15) or flush draw plus gutshot (12). The brute force decides the answer. The explainer shows why overlapping cards count once.
- **B6, rule of 2 and 4:** a draw scenario plus "one card to come" or "two cards to come, you are all in". Answer: outs times 2 or times 4, within 2 percentage points. Feedback also shows the exact figure.
- **B7, price of a call:** pot before the bet from 20 to 400 and a bet from 1/4 to 1.5 times the pot, rounded to 5. Answer `bet / (pot + 2 * bet)` as a percentage, within 2 points.
- **B8, bet size to required equity:** a bet of 1/3, 1/2, 2/3 or full pot. Four choices: 20%, 25%, 29%, 33%.
- **B9, call or fold with a draw:** the turn (one card to come), your draw, the pot and the bet. Call when your equity beats the price. Generate only spots where exact equity and required equity differ by at least 5 points. The explainer says v1 ignores money you could win on later streets (implied odds).

**Prerequisites:** B5 needs B1, B2 and B3. B6 needs B1. B8 needs B7. B9 needs B6 and B7. Intro order: B1, B2, B3, B4, B5, B6, B7, B8, B9.

**Further reading for Area B:** BBZ Poker pot odds quiz (https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/), PokerRift trainer (https://pokerrift.com/learn-poker/). Links open in a new tab.

## Milestone 2: Area C, reading the board

- Engine: a nuts finder that evaluates every remaining two-card holding on a board of 3 to 5 cards.
- **C1:** your cards plus five board cards. Four hand-name choices, the right one from pokersolver, distractors from neighbouring categories.
- **C2:** your cards, the opponent's cards, five board cards. Choices: You win, Opponent wins, Split.
- **C3:** like C2, but generators force the same hand category, so a kicker or the board decides, including splits where the board plays.
- **C4:** a board of 3 to 5 cards. Four two-card holdings shown as cards; the right one is the strongest by enumeration, distractors are the next strongest distinct holdings.
- **C5:** a board of 3 to 5 cards. Choices: Flush possible, Straight possible, Both, Neither, computed by enumeration.
- **C6:** counterfeiting. You make two pair with both hole cards; a later board card pairs the board and your hand loses value. Graded by a pokersolver showdown, with your final five cards shown in feedback.
- 500-seed tests per skill, screenshots, `docs/progress/M2.md`. The intro order interleaves areas B and C.

## Milestone 3: Area A, hands by seat

Needs `content/house-chart.json`, drafted from cited sources and shared with the owner before it ships. Skills A1 to A9 as listed in the PRD. Spec written when the chart is ready.

## Milestone 4: Area D, bet sizing

Needs `content/sizing-rules.json`, drafted from cited sources. Skills D1 to D5. D1 is pure arithmetic and can come earlier. Spec written when the rules are ready.

## Milestone 5: polish and QA

A full playthrough on an iPhone from the Home Screen, an exploratory QA pass, an offline test, and export and import on the device. A fix list goes in `docs/progress/M5.md`.
