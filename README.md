# pokerlingo

A phone-first web app for learning casual Texas Hold'em in short daily sessions, with generated questions, automatic grading and spaced repetition.

**Status:** Milestone 1 built (engine, app shell, Area B). See [`docs/progress/M1.md`](docs/progress/M1.md). Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.

- [`PRD.md`](PRD.md): product requirements, the source of truth for scope.
- [`docs/prd-summary.html`](docs/prd-summary.html): visual summary of the PRD for sign-off. Rebuild it whenever `PRD.md` changes.

When built, the app will be served at https://whhoaf.github.io/pokerlingo/.

## Design

The look is "Readable arcade", described in [`docs/DESIGN.md`](docs/DESIGN.md). It is inspired by Balatro and uses none of its assets. The pixel suit icons and the animated background are our own drawings and code.

## Credits

Pixel font: m6x11plus by Daniel Linssen (https://managore.itch.io/m6x11). It is free to use with attribution and is bundled in `public/fonts/`, so the app makes no request to another server for it.
