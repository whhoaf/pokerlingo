# pokerlingo: notes for coding agents

- **What to build:** `PRD.md` (scope, source of truth). **How:** `docs/PLAN.md`. **Progress reports:** `docs/progress/`.
- Do not edit `PRD.md` or `docs/prd-summary.html`. If the PRD and the plan conflict, follow the PRD and note the conflict in the progress report.
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run preview`.
- Never run `npm run deploy` or `git push`. The owner deploys. Commit after each task with a clear message. Never force-push or rewrite history.
- Engine code (`src/engine`, `src/skills`, `src/storage`) is pure TypeScript with no DOM access, and every module has tests. A question must be fully determined by its skill ID and seed.
- Writing rules for every user-facing string, code comment and doc: no em dashes or en dashes (use a comma, colon or full stop, or the word "to" for ranges). Short, plain sentences. British spelling (colour, practise as a verb).
- No analytics, no third-party requests, no fonts or scripts from other servers or CDNs. Fonts bundled in the repo are fine. The app works offline after the first load.
- Phone portrait first (390 px wide). Tap targets at least 48 px. No horizontal scroll.
- Card notation inside the code: pokersolver strings such as `As`, `Td`, `9h`. On screen: rank plus suit symbol, with hearts and diamonds in red.
