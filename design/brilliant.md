# Delivery Academy: the Brilliant lens

*Written from the point of view of a product designer on Brilliant.org's design team. This is one of three lenses (Brilliant, Duolingo, Apple). The design lead merges them into `DESIGN.md`.*

Brilliant's core belief is simple: **people learn by doing, and the screen exists to make the next small action obvious.** Every decision below follows from it. The reader here is a senior engineer who reads English as a second language and wants to learn "perfectly". That changes two things. Text must be short, plain and calm. Visuals must carry the meaning, so the reader never has to decode a long sentence to understand a system.

---

## 1. The lesson player

**One step on screen at a time.** A step is one idea, one question or one simulation. Never show two questions at once. Never scroll a lesson as one long page.

**Layout, top to bottom (compact, under 1024px):**
1. **Top bar, 56px.** Close (X) on the left. A progress bar in the middle. Nothing on the right except the XP counter, which is the Duolingo lens's job.
2. **Visual.** Full column width, above the text. The eye sees the picture first, then reads what it means.
3. **Text.** The title (optional), then the body.
4. **Answer area** (options, number input, order list).
5. **Bottom action bar**, pinned to the bottom of the viewport, 80px tall, with one primary button.

**Wide layout (1024px and up), only for widget steps and large flow diagrams:** visual on the left at 60%, text and controls on the right at 40%, with a 48px gutter. For read and quiz steps, keep the single centered column even on wide screens. A 640px column surrounded by calm space looks intentional, not empty.

**Width.** The content column is 640px max. Visuals may bleed to 720px. Text never goes wider than 640px.

**Progress bar.** 6px tall, fully rounded, `--surface-3` track, part color fill. One continuous bar, not segments: with 10–22 steps, segments become noise. Animate the fill forward over 400ms after each Continue. Never animate it backward.

**Buttons.**
- The **Check** button stays disabled (`--surface-3` fill, `--muted` text) until the reader picks an answer. It then becomes `--accent`. This one rule teaches the whole interaction without words.
- After Check, the same button becomes **Continue**. Same place, same size. The reader's thumb never moves.
- Read steps show only Continue. Enter and Space press it.
- Buttons are 52px tall, full width on phones, 240px wide on desktop and aligned right.

**Feedback after answering.** A tray slides up from the bottom action bar (240ms). It holds:
- A one-word verdict in bold: **"Correct"** in `--good`, or **"Not quite"** in `--bad`. Never "Wrong", never "Incorrect".
- The `explain` text, at body size, in `--ink`.
- Green and red appear only as a 4px left edge on the tray and a tint on the chosen option (`--good-soft` or `--bad-soft`). Never fill the whole screen with color.

**Wrong answers teach, they do not punish.**
- **First miss:** mark the chosen option "Not quite", show a short hint (for number steps, use `hint`), and let the reader try again. Do not show the correct answer yet.
- **Second miss:** reveal the correct option, show the full `explain`, and say "Here is why." The reader continues with no penalty beyond a smaller XP reward.
- For number steps, if the answer is within 3x the tolerance, say "Close. Check your units." Engineers usually miss by a factor of 8 (bits vs bytes) or 1,000. Detect those two cases and name them. This is the single most valuable feedback in this course.
- Never shake the screen. Never play a buzzer. A wrong answer is information.

---

## 2. Visuals that invite play

**The default state must already be interesting.** A simulation that opens on a blank stage asks the reader to guess what to do. Open each lab mid-story: traffic flowing, cache at 92%, one PoP lit up. Movement says "this is alive, touch it".

**One obvious control first.** The `task` text names one control, and that control carries a soft pulse (a 2px `--accent` ring, breathing every 2s) until the reader touches it once. After the first touch, the pulse stops forever.

**Direct manipulation over form fields.** Drag the slider, tap the node, click the server to make it fail. A dropdown in a simulation is a sign the design is not finished.

**"Try this" prompts.** Every widget step has a task line above the stage in 15px semibold `--ink-2`, written as an action: "Turn collapsing off. Press Premiere. Watch the origin." Three short sentences maximum. When the reader does the task, a small check mark appears next to it and Continue becomes active.

**Predict, then check.** The best Brilliant moment is "I thought X, the simulation showed Y". Build it in:
1. A quiz step asks: "If 2M viewers press play at once and collapsing is off, what happens at the origin?"
2. The very next step is the widget with that exact setup.
3. The step after that is a read step that names the gap between the guess and the result.

Use this triple at least once per lesson.

**Instant response.** Every control changes the visual within 100ms. If the model is slow, show the change in the visual first and update the numbers after.

---

## 3. Pacing

The rhythm that works: **show, say, ask.** Visual first, then 60–90 words, then a question about that visual.

- **No more than two read steps in a row.** The third step must ask the reader to do something.
- **Start each lesson with a question or a picture**, never with a definition. "Why does the 2M-viewer premiere hurt the origin, but the 1M normal evening does not?" is a better first step than "A CDN is...".
- **Build one diagram across three or four steps.** Repeat the same flow spec and move the `focus` forward. The reader learns the layout once, then each step adds one meaning. This is the most important pacing tool the engine has.
- **Reveal steps** come after a widget, not before. Thinking about a design is easier after you have seen it break.
- **End every lesson with a summary step**, three to five bullets, each one sentence the reader could say out loud in a design review.

---

## 4. Typography for long technical reading

Use the system font on Apple devices and **Inter** (Google Fonts) everywhere else. Use **JetBrains Mono** (Google Fonts) for code, headers, numbers in tables and all units. Do not mix in a serif. For a second-language reader, one clear sans is easier than switching letter shapes.

| Role | Size / line height | Weight | Notes |
|---|---|---|---|
| Step title | 26px / 1.25 (22px on phone) | 650 | Letter spacing -0.01em |
| Body | 18px / 1.6 (17px on phone) | 400 | `--ink`, never `--muted` |
| Quiz prompt | 20px / 1.45 | 550 | Prompt is the most important text on the screen |
| Option text | 17px / 1.4 | 450 | |
| Explanation | 17px / 1.6 | 400 | |
| Diagram label | 13px / 1.2 | 600 | |
| Diagram sub-label | 12px / 1.2 | 450 | `--muted`, the floor size |
| Code | 15px / 1.55 | 450 | Mono, `--surface-2` block |
| Caption | 14px / 1.45 | 450 | `--muted`, centered under visual |

- **Line length: 60–70 characters.** At 18px Inter that is about 600–640px. This is why the column is 640px.
- **Bold is for terms, not for emphasis.** Bold a term the first time it appears (and link it to the glossary). If everything is bold, nothing is.
- **Numbers use tabular figures** (`font-variant-numeric: tabular-nums`) so counters in labs do not jitter.
- Paragraphs get 16px between them. No indents.

---

## 5. Color

**The canvas is calm.** `--bg` and `--surface` do almost all the work. A lesson screen should be about 90% neutral.

**Color only means something.**
- `--accent`: "you can act here" (the primary button, the selected option, the active control).
- `--good` / `--bad` / `--warn`: result states only (cache HIT, origin overload, buffering). Never decoration.
- **Part colors** (`--p1`…`--p6`) identify where you are in the course: the progress bar fill, the chapter header strip, the lesson path nodes. Never use part colors inside diagrams. A diagram node in purple would look like it means something.
- Callout colors are only for callout cards: a soft tint background with a 3px left border.

**Inside diagrams, color has one job: tell the reader where to look.** Neutral nodes are `--surface` with a `--line` border. The focused path uses `--accent`. HIT is `--good`, MISS is `--warn`, failure is `--bad`. That is the full set.

---

## 6. Diagrams that never look homemade

"Homemade" comes from inconsistency: five stroke widths, three arrowhead styles, emoji-like icons. Lock everything down.

- **Icons.** One line icon family, drawn on a 24px grid with a 1.75px stroke, round caps and round joins. No fills except a 10% tint. One icon per `NodeKind`, drawn in the same hand. Icons sit at 20px in a node.
- **Node shapes.** All nodes are rounded rectangles, 12px radius, 1.5px `--line` border, `--surface` fill, `--shadow-1`. Fixed size: 148 × 56 (label plus sub-label). Icon on the left, text on the right. Do not use circles for some kinds and boxes for others. Shape is not a code here; the icon is.
- **Groups** (a PoP, a region): a dashed 1px `--line` border, 16px radius, `--surface-2` fill at 50%, and the label in 12px uppercase `--muted` at the top left.
- **Edges.** 1.5px stroke, `--muted`. Orthogonal routing with 10px rounded corners, never diagonal lines. Arrowheads are small filled chevrons, 7px long and 6px wide, sitting exactly on the node border. Dashed edges use a 4/4 dash pattern. Edge labels sit on a small `--bg` pill so the line never crosses the text.
- **Highlight and dim.** Focused nodes and edges are at full opacity, with an `--accent` border at 2px. Everything else drops to 30% opacity, not hidden. The reader must still see where the focused part lives.
- **Badges** (HIT, MISS, 404, x32): 11px mono bold, uppercase, pill, tone color on a tone-soft background, sitting on the top right corner of the node.
- **Animated packets.** An 8px circle in `--accent` with a soft 12px glow, moving along the `flow` path at a constant speed (about 240px per second, not a fixed time per edge). When it reaches a node, the node pulses once (scale 1.04 over 160ms). Pause 600ms at the end, then loop. Only one packet at a time in read steps. Labs may show many.

---

## 7. Motion

| What | Duration | Easing |
|---|---|---|
| Button press, hover | 120ms | `--ease` |
| Option select, toggle | 160ms | `--ease` |
| Feedback tray in | 240ms | `--ease` (the token is right) |
| Step change | 280ms: old step fades and moves up 12px, new step fades in from 12px below | `--ease` |
| Diagram focus change | 360ms crossfade of opacity and border | ease-in-out |
| Progress bar fill | 400ms | `--ease` |
| Correct answer | Check mark draws on over 300ms | ease-out |

Rules: motion explains change and never decorates. Nothing bounces. With `useReducedMotion()`, swap every move for a 120ms fade and show packets as a static dotted path with numbered steps.

---

## 8. Course map and lesson list

- **The course map is a vertical path**, one column, grouped by part. Each part has a header strip in its part color, the part name and a one-line blurb.
- **Each chapter is a card**: number, title, hook, a small ring showing lessons done, and the estimated minutes left.
- **The chapter page lists lessons as rows**: a status circle (empty, part-color ring for "next", filled check for done), the title, the goal sentence in `--muted`, and minutes on the right. The "next" lesson row is highlighted and carries the only Start button on the page.
- **Always show one obvious next action.** On home, it is a large "Continue: Chapter 5, Lesson 3" card at the top. Everything else is secondary.
- Do not lock lessons. A senior engineer may want to jump to chapter 12. Show a quiet "recommended order" hint instead of a padlock.

---

## 9. Dark mode

- Do not use pure black. The token `--bg: #0B0D17` is right.
- Depth in dark mode comes from **lighter surfaces, not shadows**: `--surface` sits above `--bg`, `--surface-2` above that.
- Diagram strokes need more contrast in dark mode. Use `--muted` for edges, never `--line`.
- Dim to 35% in dark mode instead of 30%, because low-opacity strokes vanish on a dark background.
- Packet glow is stronger in dark mode (16px) and weaker in light mode (8px).
- Body text is `--ink` at weight 400. Do not go lighter than 400 in dark mode, because thin text blurs.

---

## 10. Ten rules

1. **Do** show one step at a time with one primary button in a fixed place.
2. **Do** put the visual above the text, and make the question about the visual.
3. **Do** ask the reader to predict before every simulation and every reveal.
4. **Do** give a hint and a second try before showing the answer. Say "Not quite", never "Wrong".
5. **Do** build a diagram across steps by moving `focus`, not by drawing a new diagram.
6. **Don't** put more than two read steps in a row or more than 90 words in one step.
7. **Don't** use color for decoration. Accent means "act", green/red/amber mean "result", part colors mean "where am I".
8. **Don't** mix icon styles, stroke widths or node shapes. One stroke (1.5px), one radius (12px), one arrowhead.
9. **Don't** open a simulation on a blank or frozen state. Open it already moving, with the one control to try marked.
10. **Don't** let text go smaller than 12px, wider than 640px or lighter than `--ink` for body copy.
