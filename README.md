# pokerlingo

A phone-first web app for learning casual Texas Hold'em in short daily sessions, with generated questions, automatic grading and spaced repetition.

**Status:** all five milestones are built. The app has 29 skills in four areas. See the reports in [`docs/progress/`](docs/progress/), the latest being [`docs/progress/M5.md`](docs/progress/M5.md). Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run preview`.

- [`PRD.md`](PRD.md): product requirements, the source of truth for scope.
- [`docs/PLAN.md`](docs/PLAN.md): how it is built.
- [`docs/prd-summary.html`](docs/prd-summary.html): visual summary of the PRD for sign-off. Rebuild it whenever `PRD.md` changes.

When deployed, the app is served at https://whhoaf.github.io/pokerlingo/.

## What it does

- **A daily 10-minute session.** Due skills come first, then up to two new skills if time is left. A missed skill comes back later in the same session.
- **29 skills in four areas.** Every question is generated fresh from a seed and graded by the app, so you never rate yourself.
  - **A. Hands by seat (9 skills).** Name the seats at a 6 to 9 player table. Open or fold from the early seats, lojack, hijack, cutoff, button and small blind. Facing limpers, facing one raise, the big blind facing a raise, and the same hand at a different table size. Each answer shows the house chart as a 13 by 13 grid with your hand outlined.
  - **B. Outs and pot odds (9 skills).** Count outs for flush, open-ended, gutshot, overcard and combination draws. Turn outs into equity with the rule of 2 and 4. Price a call, turn a bet size into the equity you need, and decide to call or fold with a draw.
  - **C. Reading the board (6 skills).** The best five-card hand from seven cards, who wins at showdown, kickers and split pots, the nuts, flush and straight threats, and counterfeited hands.
  - **D. Bet sizing (5 skills).** Turn a pot fraction into chips, then the house rules for the preflop raise, the re-raise, the continuation bet and the value bet. Every rule states a range, a reason and a source.
- **Skip what you know.** A new skill opens with two questions. Get both right and it goes straight into reviews.
- **Spaced repetition.** FSRS through ts-fsrs, with a target retention of 0.9. Wrong maps to Again and right to Good.
- **A skill map** with the state of every skill (locked, new, learning, reviewing, strong), an explainer and a worked example for each, and a Practise button that does not change the schedule.
- **Backup.** Export all progress to one JSON file and import it again. A banner asks for a backup when the last one is more than 7 days old.
- **Settings.** Session length, new skills per session, an animated background switch, and reset.
- **Works offline** after the first load. Progress stays on the phone, in IndexedDB. There is no account, no analytics and no request to another server.
- **Install first.** On iPhone Safari the first screen explains how to add the app to the Home Screen, where Safari keeps its data.

The advice in Areas A and D comes from two content files, [`content/house-chart.json`](content/house-chart.json) and [`content/sizing-rules.json`](content/sizing-rules.json). Every entry cites a source. Edit these files to change the advice; `npm test` checks them.

## Checks

- `npm test` runs the unit tests, including 500-seed tests for every skill.
- `scripts/screenshots.py`, `scripts/layout_check.py` and `scripts/offline_check.py` drive the built app in Chromium. See the top of each file for how to run it.

## Design

The look is "Readable arcade", described in [`docs/DESIGN.md`](docs/DESIGN.md). It is inspired by Balatro and uses none of its assets. The pixel suit icons and the animated background are our own drawings and code.

## Credits

Pixel font: m6x11plus by Daniel Linssen (https://managore.itch.io/m6x11). It is free to use with attribution and is bundled in `public/fonts/`, so the app makes no request to another server for it.
