# Delivery Academy design system

One system, merged from three lenses: `brilliant.md` (how a lesson teaches), `duolingo.md` (how progress feels) and `apple.md` (how it looks). When this file and a lens disagree, **this file wins**. Values live in `src/styles/tokens.css`; primitives live in `src/ui`.

**The test for every choice:** can a senior engineer reading in a second language learn for an hour without effort, and always know the one next thing to do?

---

## 1. Principles

1. **One next action per screen.** Home has "Continue". A chapter has one Start. A lesson step has one primary button in a fixed place.
2. **Visual first, then words.** The picture carries the meaning. Text explains the picture in short, literal sentences.
3. **Calm canvas, meaningful color.** About 90% of every screen is neutral gray and white. Color only ever means something.
4. **Kind mechanics.** XP, streaks and a path, but no hearts, no timers, no guilt copy, no locks that block.
5. **Precise finish.** Three weights, one icon family, one radius scale, springs for movement.

---

## 2. Settled conflicts

| Question | Decision | Why (one line) |
|---|---|---|
| Tinted vs neutral grays | **True neutral grays** (Apple) | Tinted neutrals fight the six part colors and make the UI feel themed. |
| Dark background | **`#0C0C0E`**, not pure black, not blue-black | Pure black causes halation in long reading; blue-black is a tint. |
| Accent | **Apple blue** `#0071E3` / `#0A84FF` | The most recognised "you can act here" color, distinct from every part color. |
| Switch "on" color | **`--accent`**, not green | Green means "correct" in this product. |
| Lesson progress fill | **Part color** | Progress is "where am I", which is what part colors mean; green stays for results. |
| 3D buttons (Duolingo) vs flat (Apple) | **Tactile edge only on things you press to move forward**: primary, good, danger buttons (3px), answer tiles and path nodes (4px). Secondary buttons get a 2px hairline edge. Tinted, ghost and plain buttons are flat and scale to 0.97. | The edge says "press me"; giving it to everything makes it noise. |
| Button case | **Sentence case** | All caps is hard to read in a second language. |
| Typeface | **System (SF) on Apple, Inter elsewhere** (Google Fonts, variable `opsz`). Mono: SF Mono, then JetBrains Mono. | One clear sans; no serif, no switching letter shapes. |
| Body size | **19/30 lesson prose, 17/24 UI** (phone: 17/27 prose) | Larger reading text lowers effort for second-language readers. |
| Step transition | **Fade plus 24px slide on the Smooth spring** | Duolingo's direction, Apple's restraint; no full-screen slides. |
| Wrong-answer motion | **One damped 6px shake of the chosen tile.** No screen shake, no sound. | A wrong answer is information, not punishment. |
| Locks | **Soft lock** with "Start anyway" | A senior engineer must be able to skip ahead. |
| Sound | **None** | People study in offices and on trains. |
| Feedback words | **"Correct"** and **"Not quite"**, always the same | Rotating praise and idioms are harder to read. |

---

## 3. Color

**Neutrals** (light / dark): `--bg` #F5F5F7 / #0C0C0E · `--surface` #FFF / #1C1C1E · `--surface-2` #F2F2F7 / #2C2C2E · `--surface-3` #E5E5EA / #3A3A3C · `--ink` #1D1D1F / #F5F5F7 · `--ink-2` #424245 / #D1D1D6 · `--muted` #6E6E73 / #98989D · `--line` #D8D8DD / #3A3A3C · `--line-soft` #E8E8ED / #2C2C2E (card hairlines).

**Three color jobs, never mixed:**
- **Accent (blue) = "you can act here".** Primary buttons, links (`--accent-text`), selected options, the focused diagram path, the switch, the slider fill. Never decoration.
- **Semantic = "result".** `--good`, `--bad`, `--warn` appear only after the reader acts (answer checked, cache HIT, origin overload). Always paired with a word or icon. Text on a soft background uses the `-ink` variant; white text on a filled button uses the `-strong` variant.
- **Part colors (`--p0`…`--p6`) = "where am I".** Small identifiers only: a 6–8px dot, the chapter number, an eyebrow, a 3px rule, the path node fill, the lesson progress fill. **Never** a card fill, a header fill or a button. Never inside diagrams. Keep part color under about 5% of a screen.

**Callouts:** a soft tint, a 3px leading bar and a semibold label in the callout color; body text stays `--ink`. Crunchyroll orange is reserved for the "At Crunchyroll" callout.

**Dark mode:** depth comes from lighter surfaces plus a 1px top inner highlight (`--highlight`), not shadows. Body weight never drops below 400.

---

## 4. Typography

Stacks: `--font-display`, `--font-body`, `--font-mono`. Weights **400, 600, 700 only** (500 allowed for small labels). Never italics or all caps for long text. `tabular-nums` on every changing number. `text-wrap: balance` on headings, `pretty` on paragraphs, no hyphenation.

| Token | Desktop | Phone (≤480px) | Weight / tracking | Use |
|---|---|---|---|---|
| `--fs-display` | 48/52 | 34/40 | 700 / -0.022em | Home hero |
| `--fs-title1` | 34/41 | 30/36 | 700 / -0.018em | Page large titles |
| `--fs-title2` | 28/34 | 24/30 | 700 / -0.014em | Lesson title, section titles |
| `--fs-title3` | 22/28 | 20/26 | 600 / -0.010em | Step title, card titles |
| `--fs-headline` | 17/22 | 17/22 | 600 / -0.02em | List titles, labels |
| `--fs-reading` | **19/30** | 17/27 | 400 / -0.011em | Lesson prose |
| `--fs-body` | 17/24 | 17/24 | 400 | UI text |
| `--fs-callout` | 16/24 | 16/24 | 400 | Callouts, explanations |
| `--fs-footnote` | 14/20 | 14/20 | 400 | Hints, sources, metadata |
| `--fs-caption` | 12/16 | 12/16 | 500 | Badges, captions. **Floor: nothing below 12px.** |

Reading measure: 60–66 characters, `--col-reading` 640px. Paragraph gap 0.9em. Bold marks a **term** the first time it appears, not emphasis.

---

## 5. Shape, depth, space

- **Radii:** `--radius-xs` 6 (badges) · `--radius-s` 10 (buttons, inputs) · `--radius-m` 14 (inner cards, nodes, callouts) · `--radius-l` 20 (cards, Stage) · `--radius-xl` 28 (sheet top corners) · pill. Nested corners are concentric.
- **Elevation, three levels:** flat (surface + `--line-soft` hairline) for most cards; raised (`--shadow-1`) for interactive cards and diagram nodes; floating (`--shadow-2`, `--shadow-3`) for sheets, popovers, the palette. Never a hairline and a shadow on the same edge.
- **Materials:** the top bar and the lesson bottom bar use `--material` with `backdrop-filter: saturate(180%) blur(20px)`. Transparent at scroll 0, material plus hairline after 8px. `prefers-reduced-transparency` makes it opaque.
- **Spacing:** 8pt grid, `--sp-1`…`--sp-10` = 4, 8, 12, 16, 24, 32, 40, 48, 64, 80. Inside components 8–12, between related blocks 16–24, between sections 48–64.
- **Gutters:** `--gutter` 16px on phones, 20px from 430px, 32px from 768px. Columns: reading 640, pages 1040, labs 1100.
- **Hit targets:** 44×44px minimum. Visible focus ring everywhere (2px accent, 2–3px offset).

---

## 6. Motion

Springs (exported as `springs` from `@/ui`): **smooth** 195/28 (steps, pages, progress) · **snappy** 440/36 (thumbs, presses) · **sheet** 158/22 · **bouncy** 250/22 (correct check, XP, streak only). Color and opacity use 150–220ms tweens with `--ease-color`. CSS durations: `--dur-fast` 120ms (press, hover), `--dur` 220ms, `--dur-slow` 360ms (diagram focus).

Page change: fade plus 12px rise on the smooth spring. Nothing loops for decoration. No parallax, no auto-scroll while reading. **Reduced motion:** every move becomes a 150ms fade, springs lose overshoot, packets become a static numbered path, simulations start paused.

---

## 7. Components (`@/ui`)

Existing contract (unchanged props): `Button`, `Slider`, `Segmented`, `Toggle`, `Stat`, `StatGrid`, `Stage`, `WidgetFrame`, `Chip`, `Callout`, `Log`, `LineChart`.

Added: `Button` variants `good`, `tinted`, `plain` and a `block` prop · `IconButton` · `Icon` (24px grid, 1.75 stroke, `currentColor`) · `Card` (flat, `raised`, link via `href`) · `ProgressBar` · `Ring` · `Eyebrow` · `Kbd` · `Sheet` (dialog on desktop, bottom sheet on phones, focus trapped) · `springs`.

- **Buttons:** 52px (l) for the lesson action, 40px (m) default, 32px (s) in dense controls. One primary per screen. Disabled is flat `--surface-3` with `--muted` text: "can I press this?" is visible before reading.
- **Segmented:** 32px track in `--surface-3`, white thumb (#636366 in dark).
- **Slider:** 4px track, accent fill, 24px white thumb with floating shadow.
- **Stage:** 1px dots at 9% ink on a 24px grid, `--radius-l`, `--line-soft` border.

---

## 8. Learning UX rules (for the lesson player and pages)

- **Lesson player:** one step at a time. Compact top bar (close, part-color progress capsule, "7 of 15"). Visual above text. Bottom material bar with one full-width button (max 400px on desktop): **Check** (disabled until an answer exists) becomes **Continue** in the same place.
- **Feedback sheet:** slides up from the bottom bar. "Correct" in `--good-ink` on `--good-soft`, or "Not quite" in `--bad-ink` on `--bad-soft`, with the explanation in both cases. First miss: hint and retry; second miss: reveal and explain. For number steps, detect ×8 (bits vs bytes) and ×1,000 and name them.
- **Answer tiles:** 56px min, 2px `--line` border, 4px `--tile-edge`; selected = accent border, `--accent-soft` fill, `--accent-edge` edge. Keys 1–4, Enter = Check/Continue, Esc closes sheets.
- **Lesson complete:** one screen, three stats (XP, accuracy, time) counting up, a 12–16 particle burst in the part color for 700ms, one Continue.
- **Home path:** parts are units with sticky banners (neutral surface, part-color dot and eyebrow, not a filled color band). Chapters are section headers. Lessons are 56px nodes in a gentle wave on desktop and a straight left rail under 640px. States: done (part fill, white check), next (part fill, larger, accent-soft halo, floating "Start" card), not started (surface with tile edge, still clickable: soft lock with "Start anyway").
- **Streak:** a number plus seven day-dots, never a flame. Broken streak copy: "New streak: day 1".
- **Copy:** literal, short, no idioms, no exclamation marks, no emojis.

---

## 9. Ten rules

1. **Do** keep one primary action per screen, in a fixed place.
2. **Do** keep neutrals neutral. **Don't** tint grays or fill surfaces with part colors.
3. **Do** use blue only for "act", semantic colors only for "result", part colors only for "where am I".
4. **Do** set prose at 19/30 in a 640px column. **Don't** go below 12px for any text.
5. **Do** use 400/600/700, tabular numbers and balanced headings. **Don't** use italics or caps for long text.
6. **Do** give the tactile edge to forward-moving buttons, tiles and path nodes only.
7. **Do** use springs for movement and tweens for color. **Don't** loop decoration or animate text.
8. **Do** make reduced motion and dark mode first-class: check both before you finish.
9. **Do** reuse `@/ui`. **Don't** build a new button, slider or card.
10. **Do** let readers skip ahead. **Don't** use hearts, timers, hard locks or guilt.
