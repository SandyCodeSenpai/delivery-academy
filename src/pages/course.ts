/**
 * Course helpers for pages. Defensive: content files are being written while the site runs,
 * so every field may be missing. `?demo` in the URL fills empty chapters with placeholder lessons (QA only).
 */
import { CHAPTERS, PARTS, GLOSSARY } from "@/content";
import type { Chapter, Lesson, PartId, PartMeta, Step, GlossaryEntry } from "@/content/types";
import { WIDGET_LIST, type WidgetMeta } from "@/widgets/registry";
import type { ProgressState } from "@/state/progress";

const DEMO = typeof location !== "undefined" && /[?&]demo\b/.test(location.search);
const DEMO_TITLES = ["The big picture", "Follow one request", "Where the time goes", "The numbers that matter", "A failure, step by step", "What a staff engineer asks"];

function demoLessons(c: Chapter): Lesson[] {
  const k = c.n === 0 ? 2 : 4 + (c.n % 3);
  return Array.from({ length: k }, (_, i) => ({
    id: `demo-ch${c.n}-l${i + 1}`, title: DEMO_TITLES[i % DEMO_TITLES.length], goal: "Explain this idea in one sentence in a design review.",
    minutes: 6 + ((c.n + i) % 5), steps: [{ kind: "read", title: "Placeholder", body: "Placeholder step for layout checks." } as Step],
  }));
}

function safeChapter(c: Chapter | undefined, i: number): Chapter {
  const base: Chapter = { n: i, title: `Chapter ${i}`, short: `Chapter ${i}`, part: 0, hook: "", lessons: [], sources: [] };
  if (!c || typeof c !== "object") return base;
  const ch: Chapter = {
    ...base, ...c,
    lessons: Array.isArray(c.lessons) ? c.lessons.filter((l) => l && typeof l === "object").map((l, j) => ({ ...l, id: l.id || `ch${c.n}-l${j + 1}`, title: l.title || `Lesson ${j + 1}`, goal: l.goal || "", minutes: Number(l.minutes) || 8, steps: Array.isArray(l.steps) ? l.steps : [] })) : [],
    sources: Array.isArray(c.sources) ? c.sources.filter((s) => typeof s === "string") : [],
  };
  if (DEMO && ch.lessons.length === 0) ch.lessons = demoLessons(ch);
  return ch;
}

export const COURSE: Chapter[] = (Array.isArray(CHAPTERS) ? CHAPTERS : []).map(safeChapter).sort((a, b) => a.n - b.n);
export const PART_LIST: PartMeta[] = Array.isArray(PARTS) ? PARTS : [];
export const GLOSS: GlossaryEntry[] = (Array.isArray(GLOSSARY) ? GLOSSARY : []).filter((g) => g && g.term);

export const chapterByN = (n: number) => COURSE.find((c) => c.n === n);
export const partMeta = (id: PartId | number) => PART_LIST.find((p) => p.id === id);
export const partColor = (id: PartId | number) => `var(--p${Math.max(0, Math.min(6, Number(id) || 0))})`;
export const labsFor = (n: number): WidgetMeta[] => WIDGET_LIST.filter((w) => w.chapter === n);
export const minutesOf = (c: Chapter) => c.lessons.reduce((a, l) => a + (l.minutes || 0), 0);

export interface FlatLesson { ch: Chapter; idx: number /* 1-based, as in the route chN-L */; lesson: Lesson }
export const ALL_LESSONS: FlatLesson[] = COURSE.flatMap((ch) => ch.lessons.map((lesson, i) => ({ ch, idx: i + 1, lesson })));
export const lessonHref = (n: number, idx: number) => `#ch${n}-${idx}`;

export const isDone = (p: ProgressState, l: Lesson) => !!p.done?.[l.id];
/** Recommended next lesson: first not-done lesson in course order. */
export function nextLesson(p: ProgressState): FlatLesson | undefined {
  return ALL_LESSONS.find((f) => !isDone(p, f.lesson));
}
/** Where "Continue" goes. `resume.lesson` is the 1-based lesson number used in the route (chN-L). */
export function continueTarget(p: ProgressState): { f: FlatLesson; step?: number; resumed: boolean } | undefined {
  const r = p.resume;
  if (r) {
    const f = ALL_LESSONS.find((x) => x.ch.n === r.chapter && x.idx === r.lesson);
    if (f && !isDone(p, f.lesson)) return { f, step: r.step, resumed: true };
  }
  const f = nextLesson(p);
  return f ? { f, resumed: false } : undefined;
}

export const chapterDone = (p: ProgressState, c: Chapter) => c.lessons.filter((l) => isDone(p, l)).length;

/** Strip lite markdown to plain text. */
export function plain(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1").replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*-\s+/gm, "").replace(/\s+/g, " ").trim();
}

/** All readable text of a step, for search. */
export function stepText(s: Step): string {
  const parts: unknown[] = [];
  const any = s as unknown as Record<string, unknown>;
  for (const k of ["title", "body", "prompt", "explain", "answer", "task", "hint"]) parts.push(any[k]);
  if (Array.isArray(any.options)) parts.push(...(any.options as unknown[]));
  if (Array.isArray(any.points)) parts.push(...(any.points as unknown[]));
  if (Array.isArray(any.items)) parts.push(...(any.items as unknown[]));
  if (Array.isArray(any.pairs)) for (const p of any.pairs as unknown[]) if (Array.isArray(p)) parts.push(...p);
  const c = any.callout as { text?: string } | undefined; if (c?.text) parts.push(c.text);
  return parts.filter((x) => typeof x === "string").map(plain).join(" ");
}

export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`);
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
