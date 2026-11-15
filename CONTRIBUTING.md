# Delivery Academy: rules for every agent

**What we are building.** Delivery Academy is an interactive course website made from the book in `../chapters/*.md`. The book is *CDN & Media Delivery: From Zero to Staff*, and its running example is Crunchyroll. The reader is a senior backend engineer moving into media delivery, and English may not be their first language. They want to learn the material in the style of **Brilliant.org**: short steps, one idea at a time, learning by doing, a prediction before every reveal, and real simulations to play with. Progress should feel like **Duolingo** (a lesson path, XP, streaks, fast feedback), and the finish should be **Apple**: calm, precise typography, generous whitespace, soft depth and smooth motion.

**Stack.** Vite + React 18 + TypeScript (strict), plain CSS that uses the design tokens, and `framer-motion` for motion. **Do not add dependencies.** Build visuals with SVG, CSS and React.

## Commands (run them from `app/`)
- The dev server is **already running** at `http://127.0.0.1:5180`. Never start another one, and never kill it. It hot-reloads your files.
- Type-check only your own files: `bunx tsc --noEmit 2>&1 | grep -E "src/(widgets/<your-id>|content/chNN)"`. Other agents are editing other files at the same time, so ignore errors that are not in your files.
- Take a screenshot and capture console errors: `tools/shot.sh '<route>' /abs/out.png [width] [height]`.
- Drive the page with clicks, waits and screenshots: `node tools/probe.mjs '<route>' /abs/out.png '[{"clickText":"Play"},{"wait":1500},{"shot":"/abs/s2.png"}]' [w] [h]`. Then look at the PNGs with the Read tool.
- Write scratch files only under `/tmp/da-scratch/<your-name>/`.

## Routes (plain hash names, no slashes)
| Route | Shows |
|---|---|
| `#home` | Home |
| `#ch5` | Chapter 5 overview |
| `#ch5-3` | Lesson 3 of chapter 5 |
| `#labs` | All labs |
| `#lab-<widgetId>` | One lab, full page |
| `#glossary` | Glossary |
| `#w-<widgetId>` | Widget harness, compact mode, 680px column |
| `#w-<widgetId>@375` | Widget harness in a phone-width column |
| `#w-<widgetId>!full` | Widget harness, full page mode |
| `#diagrams` | Diagram engine demo |

## File ownership: edit ONLY your own files
| Owner | Files |
|---|---|
| Content agent for chapter N | `src/content/chNN.ts` |
| Widget agent `<id>` | everything under `src/widgets/<id>/` (split into several files and a local `.css` if useful) |
| Diagram engine agent | `src/diagram/**` |
| Design lead (pages) | `src/pages/**` except `LessonPage.tsx` and the two harnesses, `src/styles/**`, `src/ui/**`, `index.html`, `design/DESIGN.md` |
| Lesson-player agent | `src/player/**`, `src/pages/LessonPage.tsx` |
| Editor | everything else (`types.ts`, `registry.ts`, `ids.ts`, `lib/`, `tools/`, `App.tsx`) |

If you need a change in a shared file, do not make it. Note it in your final report.

## Design tokens (`src/styles/tokens.css`)
Use only these token names and never hard-code colors, because each token has a light value and a dark value.
- Surfaces and text: `--bg --surface --surface-2 --surface-3 --ink --ink-2 --muted --line`
- Accent: `--accent --accent-ink --accent-soft`
- Status: `--good --good-soft --bad --bad-soft --warn --warn-soft`
- Part colors: `--p1` … `--p6`
- Callout colors: `--c-staff --c-mistake --c-industry --c-cr`, each with a `-soft` variant
- Shape and motion: `--radius-s/m/l/pill --shadow-1/2 --font-display --font-body --font-mono --ease --dur`

In SVG, set colors through `style={{ fill: "var(--p2)" }}` or through CSS classes. Do not use `fill="#hex"`.

## Shared UI (`@/ui`): use these instead of building your own
`Button`, `Slider`, `Segmented`, `Toggle`, `Stat`, `StatGrid`, `Stage` (dotted simulation canvas), `WidgetFrame` (stage + controls, responsive), `Chip`, `Callout`, `Log`, `LineChart`.
- Helpers in `@/lib/format`: `fmtNum`, `fmtPct`, `fmtBps`, `fmtBytes`, `fmtMoney`, `fmtMs`, `clamp`.
- Hooks in `@/lib/hooks`: `useRaf(cb(dt), running)`, `useWidth(ref)`, `useReducedMotion()`, `rng(seed)`.

## The running example (keep these numbers consistent everywhere)
All of these are ASSUMED unless the book cites them:
- About 21M paid subscribers (2026) and 100M+ fans; 50,000+ episodes.
- About 300M streaming hours a month (a deliberately generous upper bound).
- Average bitrate about 4 Mbps.
- About 1M concurrent viewers at a normal peak, and about 2M at a big simulcast premiere.
- Peak egress about 8 Tbps; design for about 12 Tbps.
- About 540 PB delivered a month.
- 4–6 second segments.
- Cache hit ratio 95%+ by bytes.

Never invent Crunchyroll internals. Label anything unpublished as "assumed" or "likely".

## Quality bar (every agent)
- **Simple English.** Short sentences. Define each term the first time it appears.
- **Both themes.** The page must work in light mode and dark mode (dark is `data-theme="dark"` on `<html>`). To test dark mode, run `document.documentElement.dataset.theme='dark'` in a probe `eval` step.
- **Responsive.** Lessons render widgets about 640px wide (compact). Lab pages render them up to 1100px. Everything must stay usable at 375px with no horizontal page scroll; switch layout with `useWidth` or container queries. Text must never be smaller than 12px on screen.
- **Accessible.** Real buttons and inputs, visible focus, `aria-label` on SVGs, and respect for `useReducedMotion()`.
- **No console errors.**
- **No emojis.**
- Before you finish, look at your own screenshots: desktop, 375px and dark mode.
