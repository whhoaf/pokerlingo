# pokerlingo: product requirements

**Version 0.2, signed off.** 25 October 2026 (HKT). Build plan: [`docs/PLAN.md`](docs/PLAN.md).
Visual summary of this document: [`docs/prd-summary.html`](docs/prd-summary.html). This file is the source of truth; the summary is rebuilt whenever it changes.

## Summary

pokerlingo is a phone-first web app for learning casual Texas Hold'em in short daily sessions. Every question is generated fresh and graded by the app, and a spaced repetition scheduler brings each skill back just before you would forget it. It runs entirely in the browser, keeps progress on the phone, and is hosted free on GitHub Pages.

## 1. Problem and user

**User.** One casual player, the owner. Knows the rules and hand rankings. Plays home cash games with 6 to 9 players. Practises on an iPhone in short sessions.

**Problem.** Existing tools each cover part of this:

- **Lesson apps** teach in short units. [Poker Coach](https://pokercoach.app/) has 14 units of short drills on position, ranges and pot odds. Poker Skill has free lessons, a daily puzzle and coached games against AI ([its makers' comparison post](https://www.pokerskill.com/blog/poker-trainer-app-that-isnt-expensive/)). Neither mentions spaced repetition on the pages read.
- **Spaced repetition trainers** mostly cover preflop ranges only, and teach solver strategy for online games: Forge.poker (free) and GTO Poker Trainer: Preflop ($69.99 a year, per the same comparison post). Poker Toolkit turns your own notes into review cards.
- **General flashcard apps** such as Anki fit poker badly. A rival trainer's write-up names the two main failures: flipping a card lets you recognise a chart instead of rebuilding it, and grading yourself lets you over-rate half-right answers, which pushes the next review too far out ([Forge](https://forge.poker/en/blog/anki-flashcards-poker-ranges)).

No tool found covers every casual-game skill with one review system. That gap is the reason to build. The survey read landing pages and comparison posts only.

## 2. Goals and non-goals

**Goals**

- **G1.** One review system across every skill in scope, not just preflop ranges.
- **G2.** A 10-minute daily habit on the phone.
- **G3.** Recall, not recognition: every question is freshly generated and graded by the app.
- **G4.** Advice for home cash games, not solver play for online games.
- **G5.** No running cost, no accounts, works offline.

**Non-goals**

- Real money, wagering, or links to gambling sites.
- Bots or opponents to play against.
- Multiplayer, accounts, leaderboards, cross-device sync.
- Answers that match solver output.
- Tournament play (short-stack all-in decisions, payout pressure).
- Push notifications in v1, since they need a server.

## 3. Decisions so far

All dates HKT.

| # | Date | Decision |
|---|---|---|
| D1 | 2026-10-25 | Reason to build: one review system across all skills. |
| D2 | 2026-10-25 | Single user, phone first, installed to the Home Screen, progress kept on the phone with a backup export, hosted on GitHub Pages. |
| D3 | 2026-10-25 | Standalone. ts-fsrs for scheduling, pokersolver for hand evaluation. |
| D4 | 2026-10-25 | v1 skill areas: hands by seat, outs and pot odds, reading the board, bet sizing. |
| D5 | 2026-10-25 | Fixed 10-minute session. Reviews first, new skills only if time is left. |
| D6 | 2026-10-25 | Cash games with 6 to 9 players. No tournament content. |
| D7 | 2026-10-25 | Bet sizing in v1 covers rule-based sizing only (owner indifferent, builder's recommendation). |
| D8 | 2026-10-25 | The v1 and Later split in section 11 accepted as proposed. |
| D9 | 2026-10-25 | Name: pokerlingo, served at whhoaf.github.io/pokerlingo. |
| D10 | 2026-10-25 | This PRD lives in the GitHub repo, next to the code. |
| D11 | 2026-10-25 | PRD v0.1 signed off; build started. |
| D12 | 2026-10-25 | Look and feel: the builder picks (no mockup round). |
| D13 | 2026-10-25 | Poker advice: the chart and sizing rules are drafted from cited sources and shown to the owner when ready; review optional. Builder default, owner can change it. |
| D14 | 2026-10-26 | Look: "Readable arcade", inspired by Balatro (pixel font for numbers, labels and buttons; system font for reading), with the larger text of the "Full arcade" sketch. Spec in `docs/DESIGN.md`. |
| D15 | 2026-10-26 | Suits in red and black, like real cards. Builder default, owner can switch to four colours. |

## 4. Learning model

**What gets scheduled is a skill, not a card.** For example, "count outs for a flush draw" or "price of a call facing a half-pot bet". Each skill has:

- a **generator** that deals a new scenario every time (fresh cards, pot and bet), from a logged random seed;
- a **grader** that knows the right answer and explains it;
- a one-screen **explainer** and a **worked example**;
- **prerequisites** (for example, "call or fold with a draw" unlocks only after outs counting and pot odds).

Because every review is a new scenario, you cannot memorise the answer to one particular card, and about 30 skills replace the thousands of cards a flashcard deck would need.

**Scheduler.** FSRS through [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT licence). Target retention 0.9. Short-term steps on, so a missed skill comes back later in the same session.

**Grading.** The app grades every answer; you never rate yourself.

- Wrong maps to Again, right maps to Good. The FSRS tutorial says Again and Good alone work fine, and its authors' research found that slightly more accurate than heavy use of all four ratings ([FSRS tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)).
- Answer time is logged but does not affect the schedule in v1.
- Number answers allow a tolerance: exact for outs, within 2 percentage points for percentages, within 5% for chip amounts.
- Preflop hands the chart marks "either" accept both actions.
- Bet sizing answers are right when they fall inside the house rule's range.

**Skip what you know.** Each new skill opens with two questions before any teaching. Both right: the skill goes straight into reviews with a long first gap (first rating Easy). Otherwise: explainer, worked example, then practice.

**Feedback after every answer.** Right or wrong, the correct answer, one line of reasoning, and the supporting picture: the chart with this hand highlighted, the outs marked, or the pot odds sum written out.

## 5. Curriculum (v1)

29 skills in four areas. Skill IDs are stable, so content updates never break saved progress.

### A. Hands by seat (cash games, 6 to 9 players)

One house chart, keyed to seats counted back from the button: BTN, CO, HJ, LJ, then the early seats that exist only at 7 to 9 players. At a 6-player table the first seat to act plays the lojack's range. The chart is simplified for loose home games. Questions vary the table size between 6 and 9 players.

| ID | Skill |
|---|---|
| A1 | Name the seats at a 6 to 9 player table |
| A2 | Open or fold: early seats (7 to 9 players) |
| A3 | Open or fold: lojack and hijack |
| A4 | Open or fold: cutoff and button |
| A5 | Small blind, folded to you |
| A6 | Facing limpers: raise or fold |
| A7 | Facing one raise: re-raise, call or fold |
| A8 | Big blind facing a raise |
| A9 | Same hand, different table size |

### B. Outs and pot odds

| ID | Skill |
|---|---|
| B1 | Count outs: flush draw |
| B2 | Count outs: open-ended straight draw |
| B3 | Count outs: gutshot |
| B4 | Count outs: overcards to top pair |
| B5 | Count outs: combination draws, without double counting |
| B6 | Outs to equity: the rule of 2 and 4 |
| B7 | Price of a call as a percentage |
| B8 | Bet size to required equity (1/3, 1/2, 2/3 and full pot) |
| B9 | Call or fold with a draw |

v1 counts clean outs only and says so in the explainer.

### C. Reading the board

| ID | Skill |
|---|---|
| C1 | Best five-card hand from seven cards |
| C2 | Who wins at showdown |
| C3 | Kickers, split pots and playing the board |
| C4 | The best possible hand on this board (the nuts) |
| C5 | Can a flush or straight be out there? |
| C6 | Counterfeited hands |

All graded with [pokersolver](https://github.com/goldfire/pokersolver) (MIT licence), which evaluates hands of up to seven cards in the browser. The nuts comes from evaluating every remaining two-card combination (1,081 on a five-card board).

### D. Bet sizing (rule-based)

| ID | Skill |
|---|---|
| D1 | Turn a pot fraction into chips |
| D2 | Preflop raise size, adding for limpers |
| D3 | Re-raise size, in and out of position |
| D4 | Continuation bet size by board texture |
| D5 | Value bet size against players who call too much |

D2 to D5 are graded against written house rules. Each rule states a range, a one-line reason and a source. Answers inside the range are right.

### Content to write during the build

- The house chart: opens by seat, facing limpers, facing one raise, big blind defence, with "either" marks for borderline hands.
- The house bet sizing rules for D2 to D5.
- One explainer and one worked example per skill.
- Every chart entry and rule cites a source. Owner review: see open question 2.

### Further reading inside the app

From the original resource list. Links open in a new tab. Embedding is not possible: PokerRift and BBZ Poker send `X-Frame-Options: SAMEORIGIN` (checked 25 October 2026).

| Area | Links |
|---|---|
| A | [PokerCoaching preflop charts](https://pokercoaching.com/preflop-charts), [EV Poker starting-hand ranges](https://www.evpoker.org/tips/starting-hands-range.html), Upswing's Preflop Prodigy app |
| B | [BBZ Poker pot odds quiz](https://bbzpoker.com/poker-quiz/poker-pot-odds-quiz-ratios-percentages/), [PokerRift trainer](https://pokerrift.com/learn-poker/) |
| C | [PokerRift trainer](https://pokerrift.com/learn-poker/) (hand ranks drill), [Upswing hand rankings](https://upswingpoker.com/poker-hands-rankings) |
| D | Source to be found while writing the sizing rules |

## 6. Core flows

**F1. First run**

1. Opening the site in Safari shows an install screen first, explaining how to add it to the Home Screen.
2. Why: Safari deletes a site's stored data after 7 days of Safari use without a visit, and a Home Screen web app is exempt and keeps its data separate from Safari ([WebKit](https://webkit.org/tracking-prevention/)). Progress made in a Safari tab would not carry over.
3. A "continue in the browser" link stays available, with a warning. Useful on a laptop.
4. Then a short welcome and straight into the first session.

**F2. Daily session**

1. Start. A 10-minute timer runs.
2. Due skills first, the ones most at risk of being forgotten first.
3. A missed skill comes back two to four questions later with a fresh scenario.
4. When nothing is due and at least 2 minutes remain, the next unlocked skill is introduced (up to 2 per session).
5. At zero the current question finishes, then the session ends. It also ends early if nothing is due and no new skill is allowed.
6. Summary: questions answered, accuracy, streak, skills due tomorrow.
7. Leftover due skills roll over to the next session. New skills wait until the reviews are cleared.

**F3. Answering a question**

1. A table picture: hole cards, board, pot, bet to call, your seat.
2. Answer by tapping an option or entering a number.
3. Instant feedback (section 4), then Next.

**F4. Skill map**

- Every skill by area, with its state: locked, new, learning, reviewing, strong.
- Tapping a skill shows its explainer, accuracy, next review date and a Practise button. Practice outside the schedule does not change the schedule.

**F5. Backup**

- Export downloads one JSON file with all progress. Import restores it after a confirmation.
- A banner asks for an export when the last one is more than 7 days old.

**F6. Settings**

- Session length (default 10 minutes), new skills per session (default 2), reset progress.

**Gamification, kept light**

- Streak: days with a finished session (the timer ran out, or nothing was left to do).
- A daily done state and the session summary.
- The skill map, with strength levels taken from the scheduler.
- No XP, leagues or badges in v1.

## 7. Data and storage

- All data stays on the device, in IndexedDB inside the Home Screen app's own storage. No network calls except loading the app and its updates. No analytics.
- Stored records:
  - **Skill state:** skill ID plus the FSRS card fields (due, stability, difficulty, reps, lapses, state, last review).
  - **Review log:** skill ID, time, correct or not, rating, answer time, question seed.
  - **Sessions:** date, start, end, questions answered, accuracy.
  - **Settings and meta:** schema version, last export time, streak.
- Skills, generators and graders are code in the repo, not stored data.
- Export is one JSON file with every record and the schema version. Import checks the version and migrates when needed.
- The day rolls over at 4am local time, so a late-night session counts for the day it started.

## 8. Technical constraints

- Static site on GitHub Pages at whhoaf.github.io/pokerlingo. No server, no backend.
- Installable web app: manifest, Home Screen icon, and a service worker so it works offline.
- Libraries: ts-fsrs for scheduling and pokersolver for hand evaluation, both MIT. pokersolver has not been updated in years; its API is small, so swapping it out is cheap if needed.
- Seeded random generation, so any question can be rebuilt from its seed for testing.
- Tests: every generator and grader has unit tests, outs counts are checked by brute force against pokersolver, and a content check fails the build if a chart entry or rule has no source.
- Phone portrait first: one-handed use, large tap targets, suits shown by colour and symbol.
- Build tooling: Vite, TypeScript and Preact, deployed from a local build to a `gh-pages` branch. Details in `docs/PLAN.md`.

## 9. Success measures

After 4 weeks of use:

- Sessions finished on at least 5 of every 7 days.
- Review accuracy around 90%, the scheduler's target.
- Median answer time on outs and pot odds questions falling.
- At the table, you can price a typical call in your head (self-check).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Progress lost (phone reset, storage cleared) | Weekly export banner. Sync is in Later. |
| Progress split between Safari and the Home Screen app | Install-first onboarding (F1). |
| Wrong or ambiguous generated questions | Brute-force tests. Clean outs only in v1. |
| Bad advice in the chart or sizing rules | Every entry sourced. Owner review per open question 2. |
| A skill too broad, so its scheduling is noisy | Split any skill with mixed accuracy. Stable IDs keep progress. |
| The habit fades without reminders | Streak in v1. An optional daily message is in Later. |
| Content is most of the work | Build in milestones, the computable areas (B, C) first. |

## 11. Scope

**v1**

- The daily session (F2), the skill map (F4), backup (F5) and settings (F6).
- The learning model in section 4: generated questions, automatic grading, FSRS scheduling, skip what you know.
- The 29 skills in section 5, with explainers, worked examples and further reading.
- Install-first onboarding (F1), offline support, Home Screen icon.
- Light gamification: streak, daily done state, skill strength.

**Later**

- Rebuild a whole range on a 13x13 grid from memory.
- Play a full hand street by street, using every skill together.
- Player types, home-game mechanics such as side pots, and bluff sizing.
- Equity drills: your hand against a hand or a range.
- Turn a spot from your real game into a review item.
- Reminders, for example a daily message on Telegram, since push needs a server.
- Tune the scheduler to your own review history once there are months of data.
- Cross-device sync.

**Not doing:** see the non-goals in section 2.

## 12. Open questions

None blocking. Sign-off, look and feel, and advice review are settled as D11 to D13.

## 13. Next steps after sign-off

1. Implementation plan with milestones: the engine with outs and pot odds first, then reading the board, then hands by seat, then bet sizing, then install, offline and backup.
2. Draft the house chart and sizing rules with sources.
3. Build, test on the phone, deploy to GitHub Pages.

## Sources

- Poker Coach: https://pokercoach.app/
- Poker Skill comparison post (written by Poker Skill's makers): https://www.pokerskill.com/blog/poker-trainer-app-that-isnt-expensive/
- Forge.poker on Anki for poker ranges (written by a rival trainer): https://forge.poker/en/blog/anki-flashcards-poker-ranges
- Poker Toolkit on spaced repetition: https://poker-toolkit.com/en/spaced-repetition-poker
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- FSRS tutorial: https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
- pokersolver: https://github.com/goldfire/pokersolver
- WebKit tracking prevention (7-day storage cap, Home Screen exemption): https://webkit.org/tracking-prevention/
- Embedding check: HTTP headers of pokerrift.com and bbzpoker.com, fetched 25 October 2026.
