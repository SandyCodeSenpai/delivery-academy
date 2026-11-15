# Delivery Academy: the Apple lens

The test for every choice: can a senior engineer reading in a second language read for an hour without effort? The current neutrals are tinted blue-violet (`#F6F7FB`, `#12162A`); a tint makes the UI feel "themed" and fights the six part colors. Switch to the true grays below. Token names stay; only values change.

---

## 1. Typography

**Stack.** Display: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, "Segoe UI", Roboto, sans-serif`. Text: the same stack with "SF Pro Text" in place of "SF Pro Display". Mono: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`.

**Google Fonts fallback:** Inter (variable, `opsz` axis, weights 400–700) with `font-optical-sizing: auto`. Load it only off Apple platforms; at display sizes it needs about 0.005em more negative tracking to match SF.

**Type scale** (desktop / phone at 375px):

| Role | Size / line height | Weight | Tracking |
|---|---|---|---|
| Display (home hero) | 48/52 · 34/40 | 700 | -0.022em |
| Title 1 (chapter large title) | 34/41 · 30/36 | 700 | -0.018em |
| Title 2 (lesson title) | 28/34 · 24/30 | 700 | -0.014em |
| Title 3 (step title) | 22/28 · 20/26 | 600 | -0.010em |
| Headline (card titles, labels) | 17/22 | 600 | -0.022em |
| **Reading body (lesson prose)** | **19/30 · 17/27** | 400 | -0.011em |
| UI body (controls, lists) | 17/22 | 400 | -0.022em |
| Callout (callout boxes, explanations) | 16/24 | 400 | -0.016em |
| Footnote (hints, sources) | 13/18 | 400 | -0.006em |
| Caption (diagram captions, badges) | 12/16 | 500 | 0 |

**Rules for long text.**
- Reading measure: 60–66 characters (about 34em, 620px at 19px), never above 72. Short lines help a second-language reader keep their place.
- Line height 1.55–1.6 for prose, 1.2–1.3 for titles; 0.9em between paragraphs.
- Use three weights only: 400, 600 and 700. Never use 300 or lighter for text; thin weights break up on Windows and in dark mode.
- Do not set long text in italics or all caps. Both are harder to read in a second language. Use semibold for emphasis.
- Use `tabular-nums` for every number that changes (stats, sliders, timers). Use `text-wrap: balance` on headings and `pretty` on paragraphs, and keep hyphenation off.
- 12px is the absolute floor. Do not use Apple's 11px "Caption 2".

## 2. Color

**Neutrals.**

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F5F5F7` | `#000000` (lesson reading area `#0C0C0E`) |
| `--surface` | `#FFFFFF` | `#1C1C1E` |
| `--surface-2` | `#F2F2F7` | `#2C2C2E` |
| `--surface-3` | `#E5E5EA` | `#3A3A3C` |
| `--ink` | `#1D1D1F` | `#F5F5F7` |
| `--ink-2` | `#424245` | `#D1D1D6` |
| `--muted` | `#6E6E73` | `#98989D` |
| `--line` | `#D2D2D7` | `#38383A` |

The dark lesson column uses `#0C0C0E`, because white on pure black glows (halation) during long reading.

**Accent.** Apple blue: fills `#0071E3` / `#0A84FF`, inline links `#0066CC` (5.6:1 on white) / `#2997FF`, `--accent-soft` `#E8F2FD` / `#0B2A4A`. Blue means "you can act here" (buttons, links, selection, the focused diagram path), never decoration.

**Semantic colors.** Use Apple's accessible variants, so the color also works as text. Good is `#248A3D` / `#30D158`. Bad is `#D70015` / `#FF453A`. Warn is `#C93400` / `#FF9F0A`. Their `-soft` versions are the color at 10% (light) or 18% (dark) over the surface. Semantic color only appears *after* the reader acts (an answer checked, a cache hit or miss in a sim). Never pair a color with no text: a wrong answer shows red and the word "Not quite".

**Six part colors without a rainbow.** Bring them to the same lightness and lower the saturation, so no part shouts louder than another:

| Part | Light | Dark |
|---|---|---|
| p1 teal | `#0E8A80` | `#40C8BC` |
| p2 indigo | `#4E5BD0` | `#8C98FF` |
| p3 violet | `#8450C8` | `#BC9BF5` |
| p4 rose | `#C0436F` | `#F28AAE` |
| p5 amber | `#B5650C` | `#F5A855` |
| p6 green | `#2F7D47` | `#6BCB85` |

A part color is an **identifier, not a surface**: a 6px dot, a 3px top rule on a chapter card, the eyebrow label ("Part 2 · Caching") and the chapter number. It never fills a card, header or button. Inside a part, only that part's color appears; the home path shows all six only as dots and numerals on neutral cards, so the page reads as gray with sparks. Keep part color under about 5% of a screen's pixels.

**Callout colors** follow the same rule: a 3px leading bar plus a semibold label in color, with body text in `--ink`. The Crunchyroll orange (`#F47521`) is reserved for the "At Crunchyroll" callout only.

## 3. Materials and depth

- **Translucent bars.** The top bar and the bottom "Continue" bar use a material: `rgba(255,255,255,0.72)` in light mode and `rgba(28,28,30,0.72)` in dark mode, with `backdrop-filter: saturate(180%) blur(20px)`. If the browser does not support it, or the user has `prefers-reduced-transparency`, use the opaque surface instead.
- **Scroll-edge behavior.** At the top of a page, the bar is fully transparent with no separator. After 8px of scroll, the material and the hairline fade in over 200ms.
- **Elevation, three levels only.**
  - *Flat:* surface plus a hairline. Use it for most cards and list rows.
  - *Raised* (`--shadow-1`): `0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.05)`. Use it for interactive cards and diagram nodes.
  - *Floating* (`--shadow-2`): `0 2px 6px rgba(0,0,0,.06), 0 16px 40px rgba(0,0,0,.14)`. Use it for sheets, popovers and slider thumbs.
  - In dark mode shadows are nearly invisible. Show elevation with a lighter surface step plus a 1px top inner highlight at `rgba(255,255,255,.06)`.
- **Corner radii.** Use 6 (badges), 10 (buttons, inputs, segmented control), 14 (inner cards, diagram nodes), 20 (lesson cards, the widget Stage) and 28 (sheet top corners), plus pill. Nested corners must be concentric: inner radius = outer radius minus padding. For a continuous-corner feel, use `corner-shape: squircle` as a progressive enhancement where the browser supports it. Elsewhere, add 2px to the radius so the corner reads softer.
- **Hairlines.** Separators are 1px on standard screens and 0.5px on 2x screens, in `--line`. List separators start at the text inset, not the card edge. Never put a hairline and a shadow on the same edge.

## 4. Layout

- **Spacing scale on an 8pt grid** (4 is the only half step): 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96. Use 8–12 inside components, 16–24 between related blocks, and 48–64 between sections.
- **Gutters:** 16px on phones, 20px from 430px wide, 32px on tablets, and a centered column above that (lesson 680px, labs 1100px).
- **Safe areas.** Set `viewport-fit=cover`. The top bar and bottom action bar add `env(safe-area-inset-*)` to their padding, so the "Continue" button never sits under the home indicator.
- **Large-title navigation** (home, chapter overview, labs, glossary): a 34px Title 1 sits under an empty translucent bar. While scrolling, the large title moves up under the bar, and a 17px semibold inline title fades into the bar's center. Back is a chevron plus the parent's short name ("Inside a CDN").
- **Lesson player.** There is no large title here; the content is the hero. A compact bar holds a close button, a 4px progress capsule and the step count "7 of 15". The bottom bar holds one full-width primary button (50px tall, radius 12, max 400px on desktop).
- **Glossary terms.** Inline terms get a 1px dotted underline in `--accent` at a 3px offset, with the text in `--ink`.
  - *Phone or coarse pointer:* tap opens a **sheet** at a medium detent (about 50% height) with a 36×5px grabber, 28px top radius and a `rgba(0,0,0,.25)` scrim. Swipe down, tap the scrim or press Esc to close it.
  - *Desktop with a fine pointer:* click opens a **popover** anchored to the term, 320px wide, radius 14, floating elevation, with a 12px arrow. Show the term in Headline, the definition in Callout and a "See in glossary" link.
  - Trap focus inside while it is open, and return focus to the term when it closes.

## 5. Motion

Map Apple's spring settings (response, damping ratio) to framer-motion with mass 1: stiffness = (2π / response)², damping = 2 × ratio × (2π / response).

| Spring | Use | stiffness / damping |
|---|---|---|
| **Smooth** (response 0.45, ratio 1.0) | step transitions, page pushes, progress fill | 195 / 28 |
| **Snappy** (0.30, 0.85) | segmented thumb, switch knob, slider snap, button press | 440 / 36 |
| **Sheet** (0.50, 0.86) | sheets and popovers in and out | 158 / 22 |
| **Bouncy** (0.40, 0.70) | correct-answer check, XP chip, streak only | 250 / 22 |

- **What animates:** step changes (a 24px slide plus a fade, never a full-screen slide), control thumbs, sheets, progress, diagram focus dimming (250ms) and packets moving along edges. Color and opacity changes use 150–200ms tweens with `cubic-bezier(.28,.11,.32,1)`, not springs.
- **What must never animate:** body text size, weight or tracking. The reading column layout while someone is reading. Auto-scroll. Parallax. Looping decoration. Confetti on ordinary answers. A wrong answer gets one damped 6px shake of the answer card at most.
- **Reduced motion.** Slides become 150ms crossfades. Overshoot is removed (every spring uses ratio 1). Diagram packets become a static highlighted path with numbered steps. Simulations start paused, and the reader steps through them manually.

## 6. Iconography

- Use a **24px grid** with a 2px margin, so the drawing area is 20px. Optical sizes: a circle is 20px, a square is 18px, a wide shape is 20×16px.
- Strokes are **1.5px**, with round caps and round joins. Inner rectangles have a 3px corner radius. Use no fills, except a "selected" variant that fills the main shape at 15% opacity.
- Draw each icon in one color (`currentColor`, `--ink-2`). Tone goes on the tile behind the icon, never as multicolor inside it.
- One obvious glyph per NodeKind (person = viewer, cylinder = origin/storage, cylinder with bolt = cache, two server units = edge, lock = drm, waveform = monitor). No vendor logos.

## 7. Diagram finish (the keynote look)

- **Space.** About 40% of the canvas stays empty. Nodes sit exactly on the grid, with equal gaps between them, and every arrow points in the reading direction.
- **Nodes.** A surface card with radius 14, raised elevation, 12px padding and a 32px icon tile (radius 9, tinted with the tone's `-soft` color). The label is 15px semibold and the sub line is 12px `--muted`. A badge is a 12px semibold capsule.
- **Edges.** 1.5px lines in `--muted` at 70% opacity, with open 8px arrowheads. Use orthogonal routing with 12px rounded elbows: no free curves and no crossings. Edge labels sit in a surface-colored pill on top of the line.
- **Focus.** Nodes that are not in focus drop to 28% opacity and lose saturation. The focused path turns to `--accent` at 2px. Highlight one idea per step: one accent path, and at most one semantic tone.
- **Packets.** An 8px accent dot with a soft 6px glow and no trail. It moves at a constant speed of about 240px per second, eases in and out at the ends, and pauses for 200ms at each node.
- **Groups.** A radius-20 rectangle in `--surface-2` with no border, labeled with a 13px semibold eyebrow in sentence case.

## 8. Interaction quality

- **Segmented control:** a 32px-tall track in `--surface-3` with radius 9 and a 2px inset. The thumb is a white surface (`#636366` in dark mode) with radius 7 and a small two-layer shadow. The thumb slides with the Snappy spring. Labels are 14px, and the selected label is semibold.
- **Switch:** a 51×31 track with a 27px thumb. The on state uses `--accent`, not green, because green means "correct" in this product.
- **Slider:** a 4px track with the filled part in `--accent` and a 28px white thumb with floating elevation. While dragging, a value bubble with units appears ("4.0 Mbps"). Discrete values show ticks, and the thumb snaps to them with the Snappy spring.
- **Buttons:** filled (accent), tinted (accent-soft with accent text) and plain. Heights are 44px, or 50px for the primary action. On press, scale to 0.97 at 85% opacity. Every hit target is at least 44×44px.
- **Premium simulations:** respond in under 100ms; animate transforms only, at 60fps; update readouts at most 10 times a second with tabular figures and a 250ms tween; give every number a unit; choose defaults that tell a story; put Play/Pause/Reset in the same place in every widget; Stage dots 1px at 8% ink on a 24px grid; chart lines 2px with round joins.

## 9. Ten rules

1. **Do** set lesson prose at 19/30 with a measure of 66 characters or less. **Don't** shrink text to fit a widget; reflow the widget instead.
2. **Do** use true neutral grays. **Don't** tint the neutrals.
3. **Do** treat part colors as small identifiers. **Don't** fill cards, headers or buttons with them.
4. **Do** keep blue for "you can act here". **Don't** use it as decoration.
5. **Do** use three elevation levels and concentric radii. **Don't** stack a border and a shadow, or mix radii at random.
6. **Do** use springs for movement and tweens for color. **Don't** animate text or loop decoration.
7. **Do** make reduced motion and reduced transparency full first-class modes. **Don't** just turn animation off and leave broken layouts.
8. **Do** show one idea per diagram step, with everything else dimmed. **Don't** use more than one accent path at once.
9. **Do** pair every semantic color with words. **Don't** rely on red or green alone.
10. **Do** use 44px targets and the same control positions everywhere. **Don't** add a new style of control when `@/ui` already has one.
