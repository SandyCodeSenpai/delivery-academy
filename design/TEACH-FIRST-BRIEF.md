# Teach-first rework (one agent per chapter)

## The problem
The learner's words: "It feels like it's asking me questions more than me learning it. Because I don't know anything, how would I do it?"

The numbers, before the rework:
- 145 of 154 lessons open with a question.
- 326 questions come before any teaching.
- There is about 1 scored question per read step.
- Some stretches have up to 9 questions in a row.

The reader is a beginner in this field. They are a strong engineer, but CDN and media delivery are new to them, and English is not their first language. Questions about things the lesson has not yet taught feel like an exam. That is the opposite of learning.

## Your job
Rework `app/src/content/chNN.ts` so that **every lesson teaches first, then checks**.
- Keep ALL the book's content, facts, numbers, callouts, visuals and widgets.
- Keep lesson ids and the lesson count, so learners' progress still matches.
- You will mostly **reorder** steps, **add teaching**, **remove or demote** questions, and **add `teach` text**.

Read first:
- `app/CONTRIBUTING.md`
- `app/src/content/types.ts`, including the new fields `guess` and `teach`
- your current `chNN.ts`
- the source chapter `chapters/NN-*.md`, for teaching material you can add

## Rules (the validator enforces 1–5)
1. **Step 1 of every lesson is a `read` step.** It is a short, friendly opener: the situation, why this matters, and what you will be able to do by the end. No question before it.
2. **At most ONE `guess: true` question per lesson.**
   - It may come right after the opener, to spark curiosity.
   - It must be answerable from everyday intuition, not from jargon.
   - It is unscored. Phrase it as a guess, for example "What would you expect...?"
   - Its `explain` must TEACH the answer in plain words.
   - Any other early "predict" question either moves AFTER its teaching or is deleted.
3. **No scored question before the lesson has taught what it asks.**
   - Every scored question (quiz, multi, number, order, match without `guess`) must be answerable from steps EARLIER in the same lesson, or from earlier lessons.
   - Check this yourself, question by question.
   - If the needed idea was not taught, add a read step that teaches it, or move the question later.
4. **Pacing outside the Checkpoint:**
   - Never more than 2 scored questions in a row.
   - About 1 scored question per 2 read steps at most. The validator allows `ceil(reads/2)+1` per lesson.
   - Prefer fewer, better questions. Delete weak or duplicate ones.
   - `reveal` steps and widget steps are not scored. Use them for "think about it" moments.
5. **Every scored question has `teach`.**
   - 1–3 short sentences that remind the reader of the idea needed, WITHOUT giving away the answer.
   - The learner sees it when they press "I'm not sure, teach me".
   - Example, for "Edge hit ratio goes from 95% to 98%; how much does origin load drop?": teach = "Origin load is the miss share: 100% minus the hit ratio. Compare the miss share before and after."
6. **Worked example before every calculation.** Before a `number` question, a read step must show the same kind of calculation worked out with different numbers. Show the formula, plug in the numbers, show the result. Then the question asks the reader to do it with new numbers.
7. **Teaching quality in read steps:**
   - One idea per step, 90 words or fewer, simple English.
   - Define every new term the first time it appears, and **bold** it.
   - Use concrete examples and analogies, for example "a shield is like a regional warehouse in front of the factory".
   - Build diagrams up across steps with `focus`.
   - It is fine for a lesson to grow to 22 steps, because the extra steps are teaching. Teaching is the point.
8. **Checkpoint lessons:**
   - Keep the book's review questions.
   - Open with a read step: "Here is what this chapter covered…", 3–6 key ideas in short form.
   - Every question gets `teach`.
   - Runs of questions are allowed here.

## Check your work
- Run `cd app && bunx tsc --noEmit 2>&1 | grep src/content/chNN`. It must print nothing.
- Run `cd app && V=1 bun tools/validate.ts 2>&1 | grep "chNN-"`. It must print NO errors and NO warnings for your chapter. Ignore other chapters; agents are editing them in parallel.
- Then read your chapter's lessons start to finish as a beginner. For each scored question, ask: "Could I answer this using only what came before?" Fix every "no".
- Optional: screenshot `#chN-1` with `tools/shot.sh 'chN-1' /tmp/da-scratch/x.png`. The route has no leading `#`.

## Reply with
- Lessons, total steps, read steps vs scored questions (before → after).
- How many questions you moved, deleted, turned into a guess, or gave new teaching before them.
- Anything you are unsure about.
