# Restyle: Readable arcade

Date: 26 October 2026. Spec: `docs/DESIGN.md` (PRD D14 and D15). Reference sketch: `sketches/001-readable-arcade/index.html`, with the larger text of the Full arcade sketch.

This is a visual change. Every flow and every behaviour is as it was, except where listed under "Differences from DESIGN.md and the old app".

## What changed

- **Tokens.** All colours, radii, faces and the safe-area values are CSS custom properties in one `:root` block at the top of `src/app/styles.css`. The old palette is gone. The palette follows the DESIGN.md table, plus a few shades it does not list (`--green-d`, `--purple-l`, `--suit-red`, `--suit-black`, `--text`, `--text-soft`, `--page`).
- **Pixel font.** `public/fonts/m6x11plus.ttf` is loaded with `@font-face` from the bundle, preloaded in `index.html` and precached by the service worker (the `ttf` extension is in the workbox glob). Pixel text is used at 18, 36 and 54 px only. Sentences are set in the system font at 28, 20, 18 and 16 px as in the type table. Nothing is loaded from another server, and the screenshot script now fails on any request outside `localhost:4173`.
- **Suits.** `src/app/suits.ts` holds the four 9 by 9 pixel drawings and turns each into one SVG path. Hearts and diamonds are `#E5453C`, spades and clubs `#2B3436`. The sketch only contained a diamond, a heart and a club, so the spade is our own drawing in the same style.
- **Cards and felt.** Board cards 62 by 86, your cards 84 by 116 with a minus 5 and plus 5 degree fan, mini cards 44 by 60 (outs, best five, choices). Cards deal in with the overshoot, 120 ms apart. The question, practice and example tables are all one `Table` component.
- **Background.** `src/app/background.ts` draws the sine-field swirl on a 78 by 169 canvas, scaled with `image-rendering: pixelated`. About 20 frames a second at most, paused while the page is hidden, a quarter of the speed under `prefers-reduced-motion`. Moods: green (Home and normal questions), blue (probes, explainer and practice of a new skill), red (under one minute, which wins over blue), purple (summary). Colours blend over about half a second.
- **Animated background setting.** New `animatedBackground` field in `Settings` (default on). It is saved with the other settings and written to and read from backups. Backups and stored settings made before this field existed are still valid and read as on. Off draws one still frame. A switch in Settings controls it.
- **Motion.** Deal-in, feedback sheet slide with overshoot (0.38 s), "+1" pop on right answers, one shake of the answer box on wrong answers, summary numbers rolling up over 300 ms. With `prefers-reduced-motion` these become short fades (cards and sheet), and the roll and shake are dropped.
- **Screens.** Install, Home (welcome, export banner, done and caught-up states), Session (top bar, felt, prompt, number and choice inputs, mini-card choices), probe, explainer and practice, the feedback sheet (right and wrong), Summary, Skill map, Skill detail, Practice, Settings (with a Credits section) and every dialog.
- **Credits.** Settings has the line "Pixel font: m6x11plus by Daniel Linssen (managore.itch.io/m6x11)." and the README has a Credits section.
- **Icons.** `scripts/make_icons.py` draws the 9 by 9 pixel spade in white, with a hard shadow, on a dark green rounded square. The Home Screen icon and the maskable icon fill the whole square, because the phone rounds them.
- **PWA colours.** `theme_color` and `background_color` in the manifest, and the `theme-color` meta tag, are now `#1b3a33` (the plan had `#1f6b4a` and `#f5f2ea`).

## Tests

- New `tests/app/styles.test.ts`: every rule that sets the pixel face has a font size of 18, 36 or 54 px; nothing that touches pixel text gets another size; every `font-size` is a plain pixel value and there is no `font` shorthand; the palette lives in `:root` with no stray colour literals; the font URL is local; a reduced-motion block exists; no dashes.
- New `tests/app/background.test.ts`: frames are deterministic, opaque and inside the palette; each mood has the right colour balance; blending; frame rate and reduced speed constants; the suit drawings are 9 by 9 and their paths match the pixel counts.
- `tests/storage/storage.test.ts`: expected settings now include `animatedBackground`. Added cases for a stored value that is not a boolean, for settings saved before the switch existed, and for an invalid value in a backup. No behaviour check was weakened.
- `npm test` (319 tests), `npm run typecheck` and `npm run build` pass.

## Screenshots

`scripts/screenshots.py` was updated for the new markup (selectors, the "Right!" word, the top-bar tag, Home buttons instead of tabs, waiting for animations to finish before a picture, viewport pictures for screens with a sheet). It also now checks that:

- the background has the right colour for a new skill (blue), a review (green), the last minute (red) and the summary (purple);
- the Animated background switch starts on, saves, goes into the backup, survives import and a reload, and turns back on;
- the app makes no request outside `localhost:4173`.

The last full run reported no layout problems, console errors or data problems. I opened the pictures for Install, Home (first run, done with the export banner), the probe question and feedback, choice question and wrong feedback, the explainer, Summary, Skill map, a locked Skill detail, Settings, the import and end-session dialogs, the timer under one minute and at zero, C2 and C4 questions, and D1 and C6 wrong feedback. A bug found this way was fixed: the pixel text shadow was leaking into the mini card ranks, and dialogs were see-through.

## Differences from DESIGN.md and the old app

- **Home has no tab bar.** DESIGN.md puts "Skill map" and "Settings" as smaller buttons under Start, so Home shows those buttons and no tabs. The Skills, Skill detail and Settings screens keep the tab bar (labels Today, Skills, Settings), so every screen is still reachable.
- **Review tag.** DESIGN.md mentions a tag like "REVIEW 3 of 8". The session engine does not expose how many reviews are queued, and this job does not change the engine, so the blue tag shows "REVIEW" and the skill id (for example B7). A retry shows an orange "SECOND TRY" tag, a probe "NEW SKILL 1 of 2", and a new-skill practice question "NEW SKILL Practice".
- **Wording.** The result words are "Right!" and "Not quite" (was "Correct"). The answer is a gold line under an "Answer" label. The long top-of-screen sentences such as "New skill, question 1 of 2" became the tag.
- **Timer bar.** I kept a slim progress bar in the timer panel, which the old timer had. "Time is up" shows at 36 px, since it does not fit at 54.
- **Number answers.** After checking a number question, the answer given stays on screen (green or red edge) behind the sheet. Before, the field disappeared.
- **Choices.** Every choice label is pixel text at 36 px. Choices that are cards sit two across.
- **Mini card ranks** are pixel 18 px (36 px does not fit a 44 by 60 card).
- **Skill-state tags** are Locked grey, New purple, Learning orange, Reviewing blue, Strong green, as in the spec. White pixel text on orange, green and blue relies on the shadow and the size, as DESIGN.md allows.
- **The sheet and the answer area.** The feedback sheet covers the lower part of the screen, so the green and red colouring of choice buttons is visible by scrolling up from the sheet (the page has room to scroll above it). The sheet itself scrolls when its content is long, and the Next button stays pinned at its foot.

## Known gaps

- Not tried on a real iPhone. In particular, check that the pixel font looks crisp at 2x and 3x, and the safe-area spacing in the Home Screen app.
- Contrast was chosen from the palette, not measured with a tool. The gold note on the felt is the weakest spot (gold on the translucent felt over the lighter bands of the swirl is below 7:1 in places). Pixel labels in `--light` rely on size.
- `prefers-reduced-motion` is covered by CSS and by the background's speed constant, but I did not run the screenshot script with reduced motion switched on.
- Under reduced motion the background still moves at a quarter of the speed, as specified. People who find any motion hard can use the switch.
- The Install screen, shown only on iPhone Safari, was captured with a Safari user agent in Chromium, not on a phone.
