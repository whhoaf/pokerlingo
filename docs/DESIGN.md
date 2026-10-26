# pokerlingo design

The look is "Readable arcade": Balatro's style for everything you glance at, a normal font for everything you read, with large text. Reference sketch: [`sketches/001-readable-arcade/index.html`](../sketches/001-readable-arcade/index.html). Owner's choice, 26 October 2026: that sketch, with the larger text sizes of the Full arcade sketch.

Inspired by Balatro, not copied from it. No game assets, sprites or shader code. The background is our own code. The suit icons are our own pixel drawings (in the sketch).

## Colour

| Token | Hex | Use |
|---|---|---|
| `--red` | `#FE5F55` | End, Reset, wrong answers, day streak |
| `--red-d` | `#B8453D` | red button shadow |
| `--blue` | `#009DFF` | Check, Start, review tags, "due" counts |
| `--blue-d` | `#0070B5` | blue button shadow |
| `--orange` | `#FDA200` | Next, Continue |
| `--orange-d` | `#B87600` | orange button shadow |
| `--gold` | `#EAC058` | the correct answer line, notes on the felt |
| `--green` | `#4BC292` | "Right!", Strong skills |
| `--purple` | `#8867A5` | new skill tags, New skills |
| `--dark` | `#374244` | panels |
| `--dark-2` | `#4F6367` | panel borders |
| `--grey` | `#5F7377` | locked items, muted numbers |
| `--light` | `#BFC7D5` | labels on dark panels |
| `--sheet` | `#283133` | the feedback sheet |
| `--card` | `#FBFAF3` | card faces, number fields |
| `--card-edge` | `#E3DFD2` | card borders |

Suits are red and black, like real cards: hearts and diamonds `#E5453C`, spades and clubs `#2B3436`.

Palette values follow Balatro's published colour table (red `FE5F55`, blue `009DFF`, orange `FDA200` and so on).

## Type

Two faces, never mixed inside one line.

- **Pixel:** m6x11plus by Daniel Linssen, bundled at `public/fonts/m6x11plus.ttf` and precached. Free to use with attribution; credit it in Settings and the README. Sizes 18, 36 and 54 px only, so the pixels land on whole device pixels on 2x and 3x screens. Font smoothing off. Use it for numbers, labels, card ranks, buttons, tags, timer, headings and result words ("Right!", "Not quite").
- **Reading:** the system font stack (San Francisco on iPhone). Use it for questions, explanations, working, explainer bodies, settings descriptions and any sentence.

| Role | Face | Size and line height | Weight |
|---|---|---|---|
| Question prompt | system | 28 px / 1.25 | 600 |
| Explanation, explainer body | system | 20 px / 1.45 | 400 |
| Working lines, captions | system | 18 px / 1.4 | 400 |
| Small print | system | 16 px / 1.4 | 400 |
| Section labels | pixel | 18 px, uppercase, 1 px letter spacing | |
| Buttons (big) | pixel | 36 px | |
| Buttons (small), tags | pixel | 18 px | |
| Card rank | pixel | 36 px | |
| Headings, answer line | pixel | 36 px | |
| Timer, number input, result word, big stats | pixel | 54 px | |

## Surfaces

- **Panels:** `--dark` at 94% opacity, 2 px `--dark-2` border, 12 px radius, hard shadow `0 6px 0 rgba(0,0,0,.35)`.
- **Felt** (the board area): `rgba(0,0,0,.28)`, 12 px radius, inner 2 px line at 6% white.
- **Cards:** `--card` face, 2 px `--card-edge` border, 9 px radius, hard shadow `0 6px 0 rgba(0,0,0,.38)`. Rank top left in pixel 36 px; small suit under it on large cards; big suit bottom right. Suits are the 9 by 9 pixel drawings from the sketch, as inline SVG with `shape-rendering: crispEdges`. Board cards 62 by 86 px, your cards 84 by 116 px, slightly fanned (minus 5 and plus 5 degrees). Mini cards in choices about 44 by 60 px.
- **Buttons:** flat colour, 12 px radius, white pixel text with a `0 3px 0 rgba(0,0,0,.25)` text shadow, hard shadow `0 6px 0` in the darker shade. When pressed the button moves down 6 px onto its shadow (60 ms). Big buttons fill the width.
- **Feedback sheet:** slides up from the bottom, opaque `--sheet`, 2 px `--dark-2` top border, hard shadow upwards, rounded top corners.

## Background

- An animated swirl drawn on a canvas at about 78 by 169 pixels and scaled up with `image-rendering: pixelated`. Our own sine-field code, as in the sketch, at its slow speed and lower contrast.
- About 20 frames a second at most. Paused when the page is hidden.
- The colours follow the moment: green in a normal session and on Home, blue while a new skill is being introduced (probes, explainer, practice), red when under 1 minute remains, purple on the summary.
- Settings has an "Animated background" switch, on by default. Off draws one still frame.
- With `prefers-reduced-motion`, the swirl runs at a quarter of its speed.

## Motion

- Cards deal in with a short overshoot (0.5 s), 120 ms apart.
- The feedback sheet slides up with an overshoot (0.38 s).
- Right answer: the "+1" chip pops in. Wrong answer: the answer panel gives one short shake.
- Summary: numbers roll up to their value (300 ms ease-out).
- No idle wobble.
- With `prefers-reduced-motion`: no overshoot, shake or roll; short fades only.

## Screen notes

- **Session:** the HUD across the top (timer panel, a tag such as "NEW SKILL 1 of 2" in purple or "REVIEW 3 of 8" in blue, a small red End button), then the felt with the board, your cards, the question panel, and the answer area at the bottom (number field or choice buttons, then the Check button).
- **Choices:** chunky buttons in `--dark` with a light border; the chosen one turns blue; after checking, the right one turns green and a wrong pick turns red.
- **Home:** "pokerlingo" in pixel 54 px, two stat boxes side by side (blue "DUE TODAY", red "DAY STREAK"), the big Start button low on the screen, Skill map and Settings as smaller buttons.
- **Skill map:** one panel per area with a pixel heading; every skill row has a state tag: Locked grey, New purple, Learning orange, Reviewing blue, Strong green.
- **Settings:** panels with pixel labels and system-font descriptions; a Credits line for the font.
- **App icon:** the pixel spade, white, on a dark green rounded square, redrawn by `scripts/make_icons.py`.

## Checks

- Every screen at 390 by 844: no horizontal overflow, nothing clipped, tap targets at least 48 px.
- Text contrast: system-font text on dark panels at least 7:1; pixel button text relies on the text shadow and its large size.
- No em dashes or en dashes in any string.
