# Content agent brief (one agent per chapter)

You are turning one chapter of the book *CDN & Media Delivery: From Zero to Staff* (`../chapters/NN-*.md`) into Brilliant.org-style interactive lessons for the "Delivery Academy" website (`../app`).

**Read first:**
- `app/CONTRIBUTING.md`
- `app/src/content/types.ts` (the schema; follow it exactly)
- `app/src/content/glossary.ts` (for `[[term]]` links)
- your source chapter

If `app/design/DESIGN.md` or `app/src/player/` exist, skim them to see how steps are rendered.

**Write** `app/src/content/chNN.ts`, replacing the placeholder. Keep `n`, `title`, `short`, `part` and `hook`.

## Content rules

### 1. Coverage
Every section, concept, number, worked example, table and callout of the chapter appears somewhere. The user explicitly wants "all the explanations from the book" here. Keep facts and numbers exact, keep "assumed" labels, and never invent facts.

### 2. Brilliant pattern
- Open each lesson with a concrete scenario or a predict-first question that comes before the explanation.
- Then go: intuition, then name the term, then mechanism, then trade-off, then what it means at Crunchyroll, then a summary step.
- Put an interactive step (quiz, multi, number, order, match, reveal, widget) at least every 2–3 steps. At least 35% of all steps must be interactive.
- Every question has plausible distractors and an explanation.
- Number steps use the book's back-of-envelope math, with tolerances.

### 3. Read steps
- Body of 90 words or fewer, one idea per step.
- Simple English (the reader is not a native speaker), short sentences.
- **Bold** each key term the first time it appears.
- Link glossary terms with `[[term]]` or `[[shown text|term]]`, using exact terms from `glossary.ts`.

### 4. Callouts
Convert the book's Staff lens, Common mistake, In industry and At Crunchyroll boxes into `callout` objects on read steps (types: staff, mistake, industry, crunchyroll). Keep all the important ones. They carry the staff-level insight.

### 5. Visuals
- Convert every mermaid diagram into a `flow` (FlowSpec) or `sequence` visual.
- **Build up instead of merging:** repeat the same spec across 2–4 consecutive steps. Change `focus` to highlight the part being explained, and use `flow` to animate the path.
- Grid: col 0–5, row 0–7. At most 10 nodes. Labels of 18 characters or fewer. Give each node a sensible `kind`.
- Tables become `table` visuals (5 columns or fewer). Config and code become `code`. Key numbers become `stats`. Contrasts become `compare`.

### 6. Final lesson = "Checkpoint"
Convert the chapter's "Check your understanding" questions and key takeaways into quiz, number and reveal steps, with the book's answers as explanations. Chapter 0 has no checkpoint.

### 7. Sources
Copy the chapter's Sources list as plain strings.

### 8. Technical
- Lesson ids are `chNN-lK`.
- Use double-quoted strings, with `\n` for multi-line code.
- It must typecheck: `cd app && bunx tsc --noEmit 2>&1 | grep src/content/chNN` prints nothing.
- Then validate with a quick script (for example `bun` running a small TS file under your scratchpad that imports the chapter). It should check that:
  - answer indices are in range
  - number tolerances are greater than 0
  - order and match steps have 3 or more items
  - lesson ids are not duplicated
  - every flow edge references existing nodes
  - every focus and flow key exists
  - widget ids are valid
- The script also reports counts of lessons and steps, and the interactive ratio.
- If the player is ready (`app/src/pages/LessonPage.tsx` exists), screenshot `#chN-1` with `tools/shot.sh` and fix any content that renders badly.

### 9. Reply
Reply with: number of lessons, total steps, interactive %, widgets used, and anything you could not convert.
