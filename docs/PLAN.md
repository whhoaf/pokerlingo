# pokerlingo implementation plan

Scope comes from [`PRD.md`](../PRD.md). This file says how to build it. If the two disagree, the PRD wins.

## Rules for coding agents

- Read `PRD.md` and this file before starting. Write one progress report per milestone in `docs/progress/`.
- Do not edit `PRD.md`, `docs/prd-summary.html` or `CLAUDE.md`. If the PRD and this plan conflict, follow the PRD and note the conflict in the progress report.
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run preview`.
- Never run `npm run deploy` or `git push`; the owner deploys. Commit after each task with a clear message. Never force-push or rewrite history.
- Engine code (`src/engine`, `src/skills`, `src/storage`) is pure TypeScript with no DOM access, and every module has tests. A question must be fully determined by its skill ID and seed.
- Writing rules for every user-facing string, code comment and doc: no em dashes or en dashes (use a comma, colon or full stop, or the word "to" for ranges). Short, plain sentences. British spelling (colour, practise as a verb).
- No analytics, no third-party requests, no web fonts or CDNs. The app works offline after the first load. Exception, owner decision of 26 October 2026: the m6x11plus pixel font is bundled in `public/fonts/` and precached (see `docs/DESIGN.md`). Bundled files are not third-party requests.
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
  2. Serve due skills one at a time. After a wrong answer, schedule an in-session retry 2 to 4 questions later (seeded random) with a fresh question seed, if time remains. At most 3 retries per skill per session; after that the skill stays due for the next session. Every answer, retries included, updates FSRS.
  3. When no due or retry items remain, at least 2 minutes remain, and fewer than `newPerSession` skills (default 2, setting 1 to 3) were introduced in this session (PRD F2), introduce the next unlocked skill in intro order: 2 probe questions; both right means placement (Easy) and the skill is done for now; otherwise show the explainer, then practice questions until one is right or 3 have been asked, and the first FSRS rating comes from the last practice answer.
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

See [`docs/DESIGN.md`](DESIGN.md): the "Readable arcade" look chosen on 26 October 2026. It replaces the first look described here.

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

## Milestones 3 and 4: Area A (hands by seat) and Area D (bet sizing)

Built in two steps. Step 1 (code) builds every mechanism against placeholder content. Step 2 (content) replaces the placeholders with the researched chart and rules, written by the owner side. Code must never hard-code a range, size or reason from the content: everything the player is taught comes from the two content files.

### Content files and validation

- `content/house-chart.json` and `content/sizing-rules.json`, imported at build time. Types in `src/content/types.ts`, a validator in `src/content/validate.ts`, both tested.
- Top level of both files: `{ "version": 1, "draft": true, "sources": { "S1": { "title": "...", "site": "...", "url": "..." } }, ... }`.
- While `draft` is true, content may use one placeholder source `"TBD": { "title": "Placeholder, to be replaced", "site": "", "url": "" }`, and every explainer and feedback screen for Areas A and D shows a small "Draft advice" note. A test fails if `draft` is false and any item cites `TBD` or a source ID that does not exist.
- Validator rules: every situation and rule cites at least one source; every range string parses; within one situation no hand sits in two action buckets except through `either`; every `either` entry accepts at least two of that situation's choices; numbers are positive and every `min` is at most its `max`.

### Hand range notation

`src/engine/ranges.ts`, with tests. The 169 hand classes are pairs (`77`), suited (`AKs`) and offsuit (`AKo`). Range strings are comma separated tokens:

- `77` one pair; `77+` that pair and every higher pair; `22-66` pairs from 22 to 66.
- `AKs`, `AKo` one class; `AK` both. `ATs+` the kicker rises up to one below the top card (ATs, AJs, AQs, AKs). `A2s-A5s` a run of kickers.
- Unknown tokens throw. Expansion returns hand classes; `combos(class)` is 6 for a pair, 4 suited, 12 offsuit.

### Seats

`src/engine/seats.ts`, with tests. Seats are counted back from the button: BTN, CO, HJ, LJ, then UTG+2, UTG+1, UTG as the table grows; plus SB and BB. A 6-player table is UTG (it plays the lojack's chart), HJ, CO, BTN, SB, BB. Use `seatNames(players)` for 6 to 9 players and `chartSeat(seat, players)`, which maps a seat to the chart row it uses (at 6 players UTG maps to LJ; at 7 UTG maps to EP and so on).

### house-chart.json situations

```json
"situations": {
  "open.EP": {
    "title": "Folded to you in an early seat",
    "seats": ["UTG", "UTG+1", "UTG+2"],
    "players": [7, 9],
    "choices": ["raise", "fold"],
    "ranges": { "raise": "77+, AJs+, KQs, AQo+" },
    "either": [{ "hands": "66, ATs", "accept": ["raise", "fold"] }],
    "default": "fold",
    "reason": "One line shown in feedback.",
    "sources": ["S1"]
  }
}
```

- Situation IDs: `open.EP`, `open.LJ`, `open.HJ`, `open.CO`, `open.BTN`, `open.SB`; `limpers.early`, `limpers.late`, `limpers.SB`, `limpers.BB`; `raise.vsEarly`, `raise.vsLate`; `bb.vsRaise`.
- Optional fields: `limpers` (for example `[1, 3]`, how many limpers the question may show), `raiser` (seats the raise can come from), `choices` from `raise`, `call`, `check`, `reraise`, `fold`. `default` is the action for any hand not listed.
- Button labels: raise "Raise", call "Call", check "Check", reraise "Re-raise", fold "Fold".

### Area A skills

- **A1, name the seats:** a table picture with 6 to 9 seats, the dealer button marked, one seat highlighted. Four seat-name choices. Pure seat logic, no chart.
- **A2, early seats:** `open.EP` at 7 to 9 players. **A3:** `open.LJ` and `open.HJ`. **A4:** `open.CO` and `open.BTN`. **A5:** `open.SB`. **A6:** the `limpers.*` situations, with 1 to 3 limpers shown. **A7:** `raise.vsEarly` and `raise.vsLate`, with the raiser's seat shown. **A8:** `bb.vsRaise`.
- **A9, same hand, other table size:** half the questions ask which seat at a 9-player table the first seat at a 6-player table plays like (choices LJ, HJ, UTG, CO); half show a hand whose right action differs between `open.EP` and `open.LJ` and ask about the first seat at a 6-player table.
- Hand sampling for A2 to A8: about 60% from near the boundary (`either` hands and the hands just inside and just outside each listed range in a fixed strength order), the rest across all 169 classes weighted by combos.
- Question picture: the table with seat names, the button, the blinds, any limpers or raiser marked, your seat highlighted, your two cards (with real suits chosen by seed).
- Feedback: right or wrong, the accepted action or actions, the situation's `reason`, the source names, and a 13 by 13 range grid for the situation (one solid colour per action, borderline hands marked with a corner dot, never stripes) with your hand outlined.
- Prerequisites: A2 to A5 need A1; A6 needs A4; A7 needs A3 and A4; A8 needs A4; A9 needs A2 and A3. Interleave A into the intro order after the first few B and C skills.
- Explainers say what the chart is for and how to read it. They may quote values only by reading them from the content file.

### sizing-rules.json and Area D skills

```json
"rules": {
  "D2": { "title": "Preflop raise size", "unit": "bb", "base": { "min": 4, "max": 5 }, "perLimper": 1, "reason": "...", "sources": ["S1"] },
  "D3": { "title": "Re-raise size", "unit": "x", "inPosition": { "min": 3, "max": 3.5 }, "outOfPosition": { "min": 4, "max": 4.5 }, "reason": "...", "sources": ["S1"] },
  "D4": { "title": "Continuation bet size", "unit": "pot", "dry": { "min": 0.25, "max": 0.5 }, "wet": { "min": 0.5, "max": 0.75 }, "reason": "...", "sources": ["S1"] },
  "D5": { "title": "Value bet against players who call too much", "unit": "pot", "range": { "min": 0.66, "max": 1 }, "reason": "...", "sources": ["S1"] }
}
```

The numbers above are placeholders only.

- **D2:** blinds 1 and 2 chips, 0 to 3 limpers. "Raise to how many chips?" Right when inside `(base + perLimper * limpers)` times the big blind, rounded to whole chips.
- **D3:** an opponent opens to a stated amount; you are in position (for example BTN against CO) or out of position (SB or BB against BTN). "Re-raise to how many chips?" Right inside the multiplier range times the open.
- **D4:** a flop that is clearly dry (rainbow, unconnected, for example K 7 2 of three suits) or clearly wet (two of a suit and connected, for example J T 8 with two hearts), from a tested texture classifier in `src/engine/texture.ts`. Choices: 1/4, 1/3, 1/2, 2/3, 3/4 and full pot. Every choice inside the rule's range is right.
- **D5:** the river, an opponent described as calling too much, your strong made hand, a stated pot. "Bet how many chips?" Right inside the range times the pot.
- Prerequisites: D2 needs D1; D3 needs D2; D4 needs D1 and C5; D5 needs D1.

## Milestone 5: polish and QA

An exploratory QA pass, an offline test, export and import, and fixes. Known items so far: the Check button looks see-through before an answer is entered (make the disabled state look intentional), and the gold note on the felt is the weakest contrast. The owner does the real iPhone playthrough. A fix list goes in `docs/progress/M5.md`.
