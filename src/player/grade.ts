/** Answer checking for the lesson player. Pure functions, no React. */
import type { MultiStep, NumberStep, OrderStep, QuizStep, Step } from "@/content/types";

/** XP rules: keep them simple and visible. */
export const XP = { lesson: 10, firstTry: 2, widget: 5 } as const;

export type Interactive = QuizStep | MultiStep | NumberStep | OrderStep | Extract<Step, { kind: "match" }>;
export const isInteractive = (s: Step): s is Interactive =>
  s.kind === "quiz" || s.kind === "multi" || s.kind === "number" || s.kind === "order" || s.kind === "match";

/** Optional author hint on any step (only NumberStep declares one today). */
export const hintOf = (s: Step): string | undefined => {
  const h = (s as { hint?: unknown }).hint;
  return typeof h === "string" && h.trim() ? h : undefined;
};

export const fmtAnswer = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });

/** Parse what the reader typed. Accepts "1,200", "1 200", "2.5", "1e3" and a trailing unit. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[,\s_]/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.test(t)) return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

export interface NumberResult { ok: boolean; value: number; slip?: string }

/** Check a number and name the classic slips: bits vs bytes (x8) and a unit step (x1000). */
export function gradeNumber(step: NumberStep, value: number): NumberResult {
  const a = step.answer, tol = Math.abs(step.tolerance);
  const near = (x: number) => Math.abs(x - a) <= Math.max(tol, Math.abs(a) * 1e-9);
  if (near(value)) return { ok: true, value };
  const unit = step.unit ? ` The answer is in ${step.unit}.` : "";
  let slip: string | undefined;
  if (value !== 0) {
    if (near(value * 8)) slip = "Your answer is 8 times too small. This is the bits and bytes mix-up: 1 byte = 8 bits.";
    else if (near(value / 8)) slip = "Your answer is 8 times too large. This is the bits and bytes mix-up: 1 byte = 8 bits.";
    else if (near(value * 8000) || near(value / 8000)) slip = `Your answer is off by 8,000: bits and bytes, plus one unit step (x1,000).${unit}`;
    else if (near(value * 1000)) slip = `Your answer is 1,000 times too small. Check the unit: one step (kilo, mega, giga, tera) is x1,000.${unit}`;
    else if (near(value / 1000)) slip = `Your answer is 1,000 times too large. Check the unit: one step (kilo, mega, giga, tera) is x1,000.${unit}`;
    else if (near(value * 1e6) || near(value / 1e6)) slip = `Your answer is off by 1,000,000: two unit steps.${unit}`;
    else if (Math.abs(value - a) <= 3 * Math.max(tol, Math.abs(a) * 0.01)) slip = "Close, but just outside the accepted range. Check your rounding and each multiplication.";
  }
  return { ok: false, value, slip };
}

export function gradeMulti(step: MultiStep, picked: number[]) {
  const want = new Set(step.answers);
  const found = picked.filter((i) => want.has(i)).length;
  const extra = picked.filter((i) => !want.has(i)).length;
  return { ok: found === want.size && extra === 0, found, extra, total: want.size };
}

export function gradeOrder(step: OrderStep, placed: number[]) {
  const inPlace = placed.filter((v, i) => v === i).length;
  return { ok: inPlace === step.items.length, inPlace, total: step.items.length };
}

/* ---------------- Stable shuffles ---------------- */

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Deterministic shuffle of 0..n-1 that is never the identity (for n > 1). */
export function shuffledIndexes(n: number, seed: string): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  let s = hash(seed) || 1;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let tries = 0; tries < 8; tries++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.some((v, i) => v !== i)) return idx;
  }
  return [...idx.slice(1), idx[0]];
}
