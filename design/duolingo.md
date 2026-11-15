# Delivery Academy: the Duolingo lens

Author: product designer, Duolingo design team. Written for the design lead to merge with the Brilliant and Apple lenses.

**The one idea.** Duolingo works because there is always a clear next step, every answer gets an instant and honest response, and finishing feels good. None of that needs a mascot. Our reader is a busy senior engineer reading in a second language. Keep the *mechanics* (path, instant feedback, XP, streak, a real finish). Drop the *pressure* (hearts, guilt copy, loud rewards).

---

## 1. The home learning path

**Structure.** A part is a *unit*, a chapter is a *section* inside the unit, and a lesson is a *node*. Part 0 (chapter 0) is a short "Start here" unit at the top. Each unit opens with a full-width **unit banner** in its part color (`--p1` … `--p6`): part name, one line of blurb, "4 of 22 lessons". Each chapter gets a slim header row (number, `short` name, progress), then its lesson nodes, then a **lab node** for any lab it introduces.

**Nodes.** Circles of 64px, with a 3D bottom edge (see section 4). Every node has a **text label** (lesson `title` plus "7 min" in `--muted`), because adults choose by topic. Lab nodes are rounded squares, so they read as a different kind of thing without an icon legend.

**States.**
- **Done:** filled with the part color and a white check. The label is in `--ink-2`.
- **Current (next):** filled with the part color, 76px instead of 64px, with a 4px `--accent-soft` ring. Above it floats a small card: "Next · Why one PoP is many caches · 9 min · Start". This card is the strongest element on the page.
- **Started but not finished:** the current node with a thin progress arc around it (step 7 of 16).
- **Locked:** `--surface-3` fill, `--muted` label, no edge. Use a *soft* lock: tapping it opens a small sheet: "This lesson builds on 'Cache keys'. Start anyway?" with **Start anyway** and **Go to next lesson**. A senior engineer who already knows DNS must be able to skip ahead without a test. Never use a hard wall.

**Shape and scroll.** On desktop, the path makes a gentle wave: horizontal offsets of 0, 32, 48, 32, 0, −32, −48 px, with labels on the outside of each curve. At 480px and below, the wave becomes a **straight left rail**: nodes at x = 40px, labels using the remaining ~280px. A wave plus labels does not fit at phone width. The **unit banner is sticky** and changes as you scroll into the next part, so you always know where you are. On load, the page scrolls so that the current node sits about 40% down the viewport. A small floating "Jump to current" pill appears when the current node is off screen.

---

## 2. Habit mechanics for a busy engineer

**"Continue" comes first.** Above the path is one hero card: "Continue · Ch 5, Lesson 3 · step 7 of 16 · about 4 min left", with one large primary button. It resumes at the exact step; with nothing in progress it shows the next lesson.

**XP.** Keep it simple and predictable: 10 XP for finishing a lesson, plus 1 XP for each question that is correct on the first try, plus 5 XP for each widget step that the reader actually uses. A lab session is worth 20 XP. XP is never taken away.

**Daily goal.** Measured in lessons, because people plan in lessons: **1 (default), 2 or 3 a day**. A small ring next to the streak in the top bar. When it fills, say "Daily goal done" once, then stay quiet.

**Streak.** A streak counts days with at least one finished lesson. Draw it as a number plus seven day-dots (Mon to Sun), not a flame. Offer a **"weekdays only"** mode, and give **two automatic freezes** a week, used silently. A broken streak reads "New streak: day 1", never "You lost your 23-day streak."

**No hearts, lives or timers.** A wrong answer costs only accuracy. Missed questions return in a short **"Review the ones you missed"** round at the end of the lesson: Duolingo's best quiet mechanic, and better teaching than any penalty.

---

## 3. The answer-feedback bottom sheet

**Flow.** Pick an answer, then press **Check**. Two steps on purpose: no mis-taps on a phone, and a moment to think. Check sits at the bottom and is flat grey until an answer exists.

**The sheet.** After Check, a sheet slides up, as wide as the lesson column (full width on a phone). The question stays visible above it, and the chosen tile changes color too.

- **Correct:** `--good-soft` background, with a check icon and the title **"Correct"** in `--good-ink`.
- **Incorrect:** `--bad-soft` background, with an X icon and the title **"Not quite"** in `--bad-ink`. Right under the title is the line "Answer: *Shield cache*". For a number step, write "You said 420. We accept 360 to 440 Gbps."
- **Explanation:** the `explain` text appears in the sheet in **both** cases, in 16px body text, at most about 60 words. On a phone the sheet is never taller than 60% of the screen; longer text scrolls inside the sheet.
- **Continue:** a full-width button in the matching color (green or red), in the same place as Check, so the thumb does not move.

**Copy for a non-native reader.** Literal words only. No idioms ("Nailed it", "Spot on", "Oops"), no rotating praise (the same word every time is clearer), no exclamation marks.

**Reveal steps** use a neutral `--accent-soft` sheet. After the reveal, two small buttons ask "I had it" / "I missed it". This only affects the review round, never XP.

---

## 4. Tactile buttons, tiles and interactions

**3D press.** Every pressable thing (buttons, tiles, path nodes) has a **4px bottom edge** in a darker shade of its own color. On press it moves down 4px and the edge disappears, like a physical key; release takes 80ms. Disabled elements are flat, so "can I press this?" is clear before reading. Buttons are 52px tall, use sentence case (not Duolingo's all-caps, which is harder to read in a second language), 17px semibold, `--radius-m`.

**Option tiles.** `--surface` fill, a 2px `--line` border, and a 4px `--tile-edge` bottom edge. Minimum height 56px, text 16–17px, wrapping allowed. On the left is a small **key badge** ("1", "2", "3", "4") on desktop; on touch the badge is hidden. A selected tile gets an `--accent` border, `--accent-soft` fill and `--accent-edge`. Multi-select tiles show a square checkbox instead of the key badge, so "pick several" is visible before the reader reads the prompt.

**Order steps** (3–6 items) use Duolingo's **word bank**. Shuffled items sit at the bottom; tapping one moves it into the next numbered slot above, tapping a placed item sends it back. This works the same for touch, mouse and screen readers. Drag-to-reorder with a handle is an extra, never the only way.

**Match steps** (3–5 pairs) use two columns of tiles. Tap one on the left, then one on the right. A correct pair flashes green, then fades to a flat "done" state. A wrong pair flashes red with a short shake and resets. At 375px each column is about 160px wide; long terms wrap inside the tile, and tiles in the same row share a height.

**Keyboard (desktop).** 1–4 picks an option. Enter = Check, then Continue. Space = Reveal. In order steps, 1–6 picks from the bank and Backspace removes the last item. Esc closes sheets. "?" opens a shortcut card. Show a faint "Enter" hint inside the primary button on desktop only.

---

## 5. Celebrations that stay tasteful

**Lesson complete** is one screen, not a sequence of screens:
- Title "Lesson complete", with the lesson title under it.
- Three stat cards, counting up over 600ms: **XP +18**, **Accuracy 88%** (first-try answers), **Time 6:42**.
- If the reader made no mistakes, a small "No mistakes" chip. If the lesson filled the daily goal, the ring fills here.
- One short burst of 12–16 small particles in the part color, lasting 700ms. No confetti rain and no trophy art.
- One button: **Continue**. It returns to the path. The finished node fills, and the "current" ring moves to the next node.

**Chapter complete** is the only bigger moment: the chapter card plus a "You can now" list built from the lesson `goal` fields. For an engineer, that list is the real reward.

---

## 6. Sound

**Ship with no sound.** Readers study in offices and on trains. If sound is ever added: off by default, two short quiet cues (correct, lesson complete), a settings toggle, and never a sound for a wrong answer.

---

## 7. Color tokens

Keep the existing tokens and **add** the edges and ink colors. Each new token needs a light value and a dark value.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--good` | #1F9D55 | #4ED487 | correct icons, matched pairs |
| `--good-strong` (new) | #157A41 | #4ED487 | Continue button fill (white text on #1F9D55 is only 3.5:1) |
| `--good-ink` (new) | #136B39 | #7BE3A6 | sheet title on `--good-soft` |
| `--good-edge` (new) | #0F5E31 | #2FA866 | 3D edge under green buttons |
| `--bad` / `--bad-edge` (new) | #D7373F / #A8262D | #FF6B72 / #C9444B | wrong tile, red Continue |
| `--bad-ink` (new) | #A8262D | #FF9DA2 | sheet title on `--bad-soft` |
| `--accent-edge` (new) | #2A43A8 | #5577E0 | primary buttons, selected tile |
| `--tile-edge` (new) | #CDD2E0 | #0E1120 | idle tiles and nodes |
| progress fill | `--good` | `--good` | lesson progress bar |

Rules: green = correct. Blue (`--accent`) = action. Part colors = where you are in the course. Never use green for a merely primary button. Pair every color with an icon or word.

---

## 8. Motion that makes it feel alive

All motion uses framer-motion, with `--ease` and `--dur` (220ms) unless noted.
- **Step change:** the old step fades out, the new one slides in 24px from the right.
- **Feedback sheet:** a spring from the bottom (about 250ms, no bounce past the edge).
- **Correct tile:** a scale pop of 1 → 1.03 → 1 over 160ms. **Wrong tile:** a horizontal shake of ±6px, 3 cycles, 300ms.
- **Progress bar:** a spring fill with a thin light highlight stripe along its top, Duolingo's "shine".
- **Path return:** the node fills (scale 0.9 → 1), the ring moves to the next node, and the page scrolls smoothly to it.
- **Reduced motion:** every movement becomes a 150ms opacity fade. There is no shake and no particles; the icon and the word carry the meaning.

---

## 9. Ten do / don't rules

1. **Do** label every path node with its title and minutes. **Don't** make adults guess what a circle contains.
2. **Do** make "Continue where you left off" the first thing on the home page, and resume at the exact step.
3. **Do** show the explanation after every answer, right or wrong. **Don't** hide the "why" behind a tap.
4. **Don't** use hearts, lives, timers or XP loss. A mistake costs accuracy only, and the question comes back in the review round.
5. **Do** use soft locks. **Don't** block a senior engineer from skipping ahead.
6. **Do** write literal, short feedback copy. **Don't** use idioms, slang, rotating praise or exclamation marks.
7. **Do** give every pressable element the 4px edge and press-down. **Don't** give the edge to anything that is not pressable.
8. **Do** make every interaction work by tap, by mouse and by keyboard. Drag is an extra, never required.
9. **Do** keep the celebration to one screen with three honest stats. **Don't** use mascots, trophies, confetti rain or a stack of reward screens.
10. **Do** keep streaks kind: weekday mode, automatic freezes, neutral reset copy. **Don't** send guilt, urgency or "you will lose" messages anywhere.
