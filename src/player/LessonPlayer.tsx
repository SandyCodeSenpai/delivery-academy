/**
 * The lesson player: one step at a time, a fixed action bar (Back + Check / Continue / Try again in one place),
 * a feedback sheet, resume at every step, XP, and a completion screen with a review round.
 *
 * Teach-first additions:
 * - Guess steps (`guess: true`): unscored, neutral feedback, no retry, never in review.
 * - "I'm not sure, teach me" (T) on every scored question: an inline card with `teach` (or `hint`).
 *   An assisted answer earns no first-try XP and counts as not first try, but a right one is not "missed".
 * - Back (left chevron, the Left arrow key, or a visited progress segment): earlier steps show their final
 *   answered state, read-only. Continue walks forward again; the furthest step keeps its in-progress state.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { Chapter, Lesson, Step } from "@/content/types";
import type { Resume } from "@/state/progress";
import { progress } from "@/state/progress";
import { useReducedMotion } from "@/lib/hooks";
import { go } from "@/lib/router";
import { Button, springs } from "@/ui";
import { Inline, Text } from "./Text";
import { XP, fmtAnswer, gradeMulti, gradeNumber, gradeOrder, hintOf, isInteractive, parseNumber, type Interactive } from "./grade";
import {
  MatchView, MultiView, NumberView, OrderView, QuizView, ReadView, RevealView, SummaryView, WidgetView, type Phase, type ViewCtx,
} from "./steps";
import { Completion } from "./Completion";
import { Teach } from "./Teach";
import { DrawCheck, IconBolt, IconBulb, IconChevronLeft, IconClose, IconKeyboard, IconX } from "./icons";
import { WIDE_QUERY, WideCtx, splitsVisual } from "./layoutCtx";
import "./player.css";

export interface LessonPlayerProps {
  chapter: Chapter;
  lesson: Lesson;
  /** 1-based lesson number, as in the route #chN-L */
  lessonNumber: number;
  /** route name (no "#") of the next lesson, if any */
  nextHref?: string;
  /** route name (no "#") to return to, usually "chN" */
  backHref: string;
}

/* ---------------- Step kinds ---------------- */
const isGuess = (s: Step | undefined): s is Interactive => !!s && isInteractive(s) && !!s.guess;
const isScored = (s: Step | undefined): s is Interactive => !!s && isInteractive(s) && !s.guess;
const teachOf = (s: Step): string | undefined => {
  const t = isInteractive(s) ? s.teach : undefined;
  return typeof t === "string" && t.trim() ? t : undefined;
};
const initAns = (s: Step | undefined): unknown => (!s ? null : s.kind === "multi" || s.kind === "order" ? [] : s.kind === "number" ? "" : null);
/** A short signature, so a saved answer is never restored onto a step that content authors have since changed. */
const sigOf = (s: Step): string => {
  const o = s as { prompt?: string; title?: string; body?: string; task?: string };
  return `${s.kind}:${(o.prompt ?? o.title ?? o.body ?? o.task ?? "").slice(0, 48)}`;
};

/* ---------------- Per-step state (also the snapshot that Back restores) ---------------- */
type VTone = "good" | "bad" | "neutral" | "guess";
interface Verdict { tone: VTone; title: string; lines: string[]; answer?: string; explain?: string; why?: boolean; retry?: boolean; xp?: number }
interface StepState {
  sig: string;
  phase: Phase;
  attempt: number;
  ans: unknown;
  ruled: number[];
  ok: boolean;
  verdict: Verdict | null;
  self: "had" | "missed" | null;
  widgetDone: boolean;
  numberLine?: string;
  /** the reader opened "teach me" on this step */
  taught: boolean;
  /** wrong pairs so far on a match step (kept if the reader leaves and comes back) */
  matchMiss: number;
}
const freshState = (s: Step): StepState => ({
  sig: sigOf(s), phase: "answer", attempt: 0, ans: initAns(s), ruled: [], ok: false, verdict: null,
  self: null, widgetDone: false, taught: false, matchMiss: 0,
});
const isIdx = (v: unknown, n: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
function validState(x: StepState | undefined, s: Step): x is StepState {
  if (!x || x.sig !== sigOf(s)) return false;
  switch (s.kind) {
    case "quiz": return x.ans === null || isIdx(x.ans, s.options.length);
    case "multi": return Array.isArray(x.ans) && x.ans.every((v) => isIdx(v, s.options.length));
    case "order": return Array.isArray(x.ans) && x.ans.every((v) => isIdx(v, s.items.length));
    case "number": return typeof x.ans === "string";
    default: return true;
  }
}
/** A step the reader passed in an earlier visit, but whose answer we did not keep: show the answer, read-only. */
function pastState(s: Step, widgetDone: boolean): StepState {
  const st = freshState(s);
  if (!isInteractive(s) && s.kind !== "reveal") return { ...st, widgetDone };
  const v: Verdict | null = isInteractive(s) ? { tone: s.guess ? "guess" : "neutral", title: "The answer", lines: [], explain: s.explain } : null;
  const base = { ...st, phase: "done" as Phase, ok: true, verdict: v };
  switch (s.kind) {
    case "quiz": return { ...base, ans: s.answer };
    case "multi": return { ...base, ans: [...s.answers] };
    case "order": return { ...base, ans: s.items.map((_, i) => i) };
    case "number": return { ...base, ans: String(s.answer), numberLine: `Answer: ${fmtAnswer(s.answer)}${s.unit ? ` ${s.unit}` : ""}` };
    default: return base;
  }
}

/* ---------------- Session (so resume keeps XP, accuracy, time and earlier answers honest) ---------------- */
interface Session {
  firstTry: Record<number, boolean>; widgets: number[]; missed: number[]; elapsed: number;
  /** steps where the reader asked to be taught */
  taught: number[];
  /** final state of each step the reader has passed, for Back after a reload */
  snaps: Record<number, StepState>;
}
const freshSession = (): Session => ({ firstTry: {}, widgets: [], missed: [], elapsed: 0, taught: [], snaps: {} });
const skey = (id: string) => `delivery-academy:player:${id}`;
function loadSession(id: string): Session | null {
  try { const raw = localStorage.getItem(skey(id)); return raw ? { ...freshSession(), ...JSON.parse(raw) } : null; } catch { return null; }
}
function saveSession(id: string, s: Session) { try { localStorage.setItem(skey(id), JSON.stringify(s)); } catch { /* storage blocked */ } }
function clearSession(id: string) { try { localStorage.removeItem(skey(id)); } catch { /* storage blocked */ } }

/**
 * The saved resume point. `progress` caches its state when the app boots, so a resume written later
 * (another tab, or a test that edits storage) would be missed and then overwritten with step 0.
 * Read the stored copy first, and fall back to memory when storage is blocked.
 */
function readResume(): Resume | null {
  try {
    const raw = localStorage.getItem("delivery-academy:v1");
    if (raw) {
      const r = (JSON.parse(raw) as { resume?: Resume | null }).resume;
      if (r === null || (r && typeof r.step === "number")) return r ?? null;
    }
  } catch { /* storage blocked */ }
  return progress.get().resume;
}

interface Primary { label: string; onClick: () => void; disabled?: boolean; tone: "accent" | "good" | "bad" }
interface Result { xp: number; accuracy: number | null; timeMs: number; taught: number; review: { right: number; total: number } | null }

function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mm = matchMedia(q); const f = () => setM(mm.matches); f();
    mm.addEventListener("change", f); return () => mm.removeEventListener("change", f);
  }, [q]);
  return m;
}
const SPRING_SHEET = { type: "spring", stiffness: 260, damping: 32 } as const; // sheet height: no overshoot

export default function LessonPlayer({ chapter, lesson, lessonNumber, nextHref, backHref }: LessonPlayerProps) {
  const steps = lesson.steps;
  const reduced = useReducedMotion();
  const wide = useMedia(WIDE_QUERY);
  const partColor = `var(--p${chapter.part})`;

  const [start] = useState(() => {
    const r = readResume();
    const pos = r && r.chapter === chapter.n && r.lesson === lessonNumber && r.step > 0 && r.step < steps.length ? r.step : 0;
    const session = (pos > 0 && loadSession(lesson.id)) || freshSession();
    if (pos === 0) clearSession(lesson.id);
    // If the reader had already answered the step they left on, show that answer instead of asking again.
    const saved = session.snaps[pos];
    const st = validState(saved, steps[pos]) && saved.phase === "done" ? saved : freshState(steps[pos]);
    return { pos, session, st };
  });
  const session = useRef<Session>(start.session);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const [mode, setMode] = useState<"main" | "review">("main");
  const [queue, setQueue] = useState<number[]>(() => steps.map((_, i) => i));
  const [pos, setPos] = useState(start.pos);
  /** the furthest queue position reached; positions before it are "history" */
  const [furthest, setFurthest] = useState(start.pos);
  const [dir, setDir] = useState<1 | -1>(1);
  const [screen, setScreen] = useState<"steps" | "done">("steps");
  const [result, setResult] = useState<Result | null>(null);
  const [missedNow, setMissedNow] = useState<number[]>([]);
  const reviewFirst = useRef<Record<number, boolean>>({});
  const reviewSnaps = useRef<Record<number, StepState>>({});
  /** in-progress state of the furthest step while the reader looks back */
  const liveRef = useRef<{ idx: number; st: StepState } | null>(null);

  const [st, setSt] = useState<StepState>(start.st);
  const patch = (p: Partial<StepState>) => setSt((s) => ({ ...s, ...p }));
  const [skipReady, setSkipReady] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const { phase, ans, verdict } = st;

  const idx = queue[pos];
  const step: Step | undefined = steps[idx];
  const history = screen === "steps" && pos < furthest;
  const guess = isGuess(step);
  const isLast = pos === queue.length - 1;
  const seed = `${lesson.id}:${idx}`;
  const snapStore = () => (mode === "main" ? session.current.snaps : reviewSnaps.current);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stepKeys = useRef<((e: KeyboardEvent) => boolean) | null>(null);
  const markRef = useRef(performance.now());
  const justAnswered = useRef(false);

  /* ---------- time, resume and session persistence ---------- */
  const tickTime = () => { const now = performance.now(); session.current.elapsed += now - markRef.current; markRef.current = now; };
  const liveMode = useRef({ mode, screen }); liveMode.current = { mode, screen };
  useEffect(() => {
    if (mode !== "main" || screen !== "steps") return;
    progress.setResume({ chapter: chapter.n, lesson: lessonNumber, step: furthest });
    tickTime();
    saveSession(lesson.id, session.current);
  }, [pos, furthest, mode, screen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const persist = () => { if (liveMode.current.mode === "main" && liveMode.current.screen === "steps") { tickTime(); saveSession(lesson.id, session.current); } };
    addEventListener("pagehide", persist);
    return () => { removeEventListener("pagehide", persist); persist(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- bar height -> content padding ---------- */
  useLayoutEffect(() => {
    const bar = barRef.current, root = rootRef.current;
    if (!bar || !root) return;
    const set = () => root.style.setProperty("--lp-bar-h", `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set); ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  /* ---------- top bar hairline after scroll ---------- */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const f = () => setScrolled(el.scrollTop > 8);
    el.addEventListener("scroll", f, { passive: true });
    return () => el.removeEventListener("scroll", f);
  }, []);

  /* ---------- widget skip timer ---------- */
  useEffect(() => {
    if (screen !== "steps" || step?.kind !== "widget" || history) return;
    const t = setTimeout(() => setSkipReady(true), 20000);
    return () => clearTimeout(t);
  }, [pos, mode, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- keep the checked answer visible above the sheet (only right after answering) ---------- */
  useEffect(() => {
    if (!verdict || !justAnswered.current) return;
    justAnswered.current = false;
    const t = setTimeout(() => {
      const root = rootRef.current, bar = barRef.current; if (!root || !bar) return;
      const target = root.querySelector<HTMLElement>(".lp-step .st-bad, .lp-step .st-good, .lp-step .st-ans, .lp-step .lp-num, .lp-step .lp-slots, .lp-step .lp-match");
      if (!target) return;
      const over = target.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 16;
      if (over > 0) root.scrollBy({ top: over, behavior: reduced ? "auto" : "smooth" });
    }, reduced ? 0 : 280);
    return () => clearTimeout(t);
  }, [verdict, reduced]);

  /* ---------- moving between steps ---------- */
  /** State to show at queue position p: live work at the furthest step, the final answer before it. */
  function stateAt(p: number): StepState {
    const i = queue[p], s = steps[i];
    if (p === furthest) { const l = liveRef.current; return l && l.idx === i && l.st.sig === sigOf(s) ? l.st : freshState(s); }
    const saved = snapStore()[i];
    if (validState(saved, s)) return isInteractive(s) || s.kind === "reveal" ? { ...saved, phase: "done" } : saved;
    return pastState(s, mode === "main" && session.current.widgets.includes(i));
  }
  /** Jump to an earlier step, or forward again up to the furthest one. */
  function goTo(p: number) {
    if (screen !== "steps" || p === pos || p < 0 || p > furthest || !step) return;
    if (pos === furthest) liveRef.current = { idx, st };
    if (pos < furthest || phase === "done") snapStore()[idx] = st;
    setDir(p < pos ? -1 : 1);
    setSt(stateAt(p)); setSkipReady(false); setPos(p);
  }
  const back = () => goTo(pos - 1);

  /** Record the first-try result once per step. Returns the XP it earned. Guesses never come here. */
  function recordFirst(ok: boolean): number {
    if (mode === "main") {
      const s = session.current;
      if (idx in s.firstTry) return 0;
      const clean = ok && !st.taught; // an assisted answer is not a first-try answer
      s.firstTry[idx] = clean;
      if (!ok && !s.missed.includes(idx)) s.missed.push(idx); // a right answer after teaching is not "missed"
      saveSession(lesson.id, s); bump();
      return clean ? XP.firstTry : 0;
    }
    if (!(idx in reviewFirst.current)) reviewFirst.current[idx] = ok;
    return 0;
  }

  function openTeach() {
    if (!isScored(step) || history || st.taught || phase === "done") return;
    patch({ taught: true });
    if (mode === "main" && !session.current.taught.includes(idx)) { session.current.taught.push(idx); saveSession(lesson.id, session.current); }
  }

  function setAns(v: unknown) {
    if (phase === "done" || !step || history) return;
    if (phase === "retry") {
      if (step.kind === "quiz") {
        if (v === ans) return;
        patch({ ruled: typeof ans === "number" ? [...st.ruled, ans] : st.ruled, phase: "answer", verdict: null, ans: v });
        return;
      }
      patch({ phase: "answer", verdict: null, ans: v });
      return;
    }
    patch({ ans: v });
  }
  function tryAgain() {
    if (step?.kind === "quiz" && typeof ans === "number") patch({ ruled: [...st.ruled, ans], ans: null, phase: "answer", verdict: null });
    else patch({ phase: "answer", verdict: null });
  }
  function retry(lines: (string | undefined)[]) {
    recordFirst(false);
    justAnswered.current = true;
    patch({ attempt: 1, phase: "retry", verdict: { tone: "bad", title: "Not quite", lines: lines.filter(Boolean) as string[], retry: true } });
  }
  function resolve(ok: boolean, lines: (string | undefined)[], explain?: string, extra: Partial<StepState> & { answer?: string } = {}) {
    const xp = st.attempt === 0 ? recordFirst(ok) : 0;
    const { answer, ...rest } = extra;
    justAnswered.current = true;
    patch({ ...rest, phase: "done", ok, verdict: { tone: ok ? "good" : "bad", title: ok ? "Correct" : "Not quite", lines: lines.filter(Boolean) as string[], answer, explain, why: !ok, xp } });
  }
  /** A guess: no score, no retry, neutral sheet, and the explanation always shown as teaching. */
  function settleGuess(ok: boolean, lines: string[], explain: string, extra: Partial<StepState> & { answer?: string } = {}) {
    const { answer, ...rest } = extra;
    justAnswered.current = true;
    patch({ ...rest, phase: "done", ok, verdict: { tone: "guess", title: ok ? "Good guess" : "Here's what actually happens", lines, answer: ok ? undefined : answer, explain } });
  }

  const canCheck = (() => {
    if (!step || history) return false;
    switch (step.kind) {
      case "quiz": return ans !== null;
      case "multi": return (ans as number[]).length > 0;
      case "number": return parseNumber(String(ans ?? "")) !== null;
      case "order": return (ans as number[]).length === step.items.length;
      default: return false;
    }
  })();

  function check() {
    if (!step || !canCheck) return;
    const firstTry = st.attempt === 0;
    // If the teaching card already showed the hint, do not repeat it after a miss.
    const hint = st.taught && !teachOf(step) ? undefined : hintOf(step);
    switch (step.kind) {
      case "quiz": {
        const ok = ans === step.answer;
        if (step.guess) return settleGuess(ok, [], step.explain, { answer: step.options[step.answer] });
        if (ok) return resolve(true, [], step.explain);
        if (firstTry && step.options.length > 2) return retry([hint ?? "Read the question again. You have one more try."]);
        return resolve(false, [], step.explain, { answer: step.options[step.answer] });
      }
      case "multi": {
        const g = gradeMulti(step, ans as number[]);
        if (step.guess) return settleGuess(g.ok, g.ok ? [] : ["The right choices are marked with a check."], step.explain);
        if (g.ok) return resolve(true, [], step.explain);
        if (firstTry) {
          const extra = g.extra ? `, and ${g.extra} that ${g.extra === 1 ? "does" : "do"} not apply` : "";
          return retry([`You picked ${g.found} of the ${g.total} correct answers${extra}.`, hint]);
        }
        return resolve(false, ["The correct choices are marked in green."], step.explain);
      }
      case "number": {
        const v = parseNumber(String(ans))!;
        const g = gradeNumber(step, v);
        const unit = step.unit ? ` ${step.unit}` : "";
        const numberLine = `Answer: ${fmtAnswer(step.answer)}${unit}`;
        if (step.guess) return settleGuess(g.ok, g.ok ? [] : [`You guessed ${fmtAnswer(v)}${unit}.`], step.explain, { numberLine });
        const range = step.tolerance > 0 ? `We accept ${fmtAnswer(step.answer - step.tolerance)} to ${fmtAnswer(step.answer + step.tolerance)}${unit}.` : "";
        if (g.ok) return resolve(true, [range], step.explain, { numberLine });
        if (firstTry) return retry([g.slip, hint ?? (g.slip ? undefined : "Write each number with its unit, then multiply step by step.")]);
        return resolve(false, [`You said ${fmtAnswer(v)}${unit}. ${range}`, g.slip], step.explain, { numberLine });
      }
      case "order": {
        const g = gradeOrder(step, ans as number[]);
        if (step.guess) return settleGuess(g.ok, g.ok ? [] : ["The order above is the real one."], step.explain);
        if (g.ok) return resolve(true, [], step.explain);
        if (firstTry) return retry([`${g.inPlace} of ${g.total} ${g.inPlace === 1 ? "is" : "are"} in the right place. Tap an item to take it out.`, hint]);
        return resolve(false, ["The correct order is shown above."], step.explain);
      }
    }
  }

  function onMatchDone(mistakes: number) {
    if (!step || step.kind !== "match" || history) return;
    const ok = mistakes === 0;
    if (step.guess) return settleGuess(ok, [], step.explain, { matchMiss: mistakes });
    const xp = recordFirst(ok);
    justAnswered.current = true;
    if (ok) patch({ phase: "done", ok, matchMiss: mistakes, verdict: { tone: "good", title: "Correct", lines: [], explain: step.explain, xp } });
    else patch({
      phase: "done", ok, matchMiss: mistakes,
      verdict: {
        tone: "neutral", title: "All matched",
        lines: [`You needed ${mistakes} extra ${mistakes === 1 ? "try" : "tries"}.${mode === "main" ? " This step comes back in your review." : ""}`],
        explain: step.explain,
      },
    });
  }

  function setSelf(v: "had" | "missed") {
    patch({ self: v });
    if (mode === "main") {
      const s = session.current;
      s.missed = s.missed.filter((x) => x !== idx);
      if (v === "missed") s.missed.push(idx);
      saveSession(lesson.id, s);
    } else reviewFirst.current[idx] = v === "had";
  }

  function onWidgetComplete() {
    if (!step || step.kind !== "widget" || st.widgetDone) return;
    patch({ widgetDone: true });
    progress.markWidget(step.widget);
    if (mode === "main" && !session.current.widgets.includes(idx)) {
      session.current.widgets.push(idx);
      saveSession(lesson.id, session.current); bump();
    }
  }

  function next() {
    if (pos < furthest) return goTo(pos + 1);
    snapStore()[idx] = st;
    liveRef.current = null;
    if (isLast) return finish();
    const np = pos + 1;
    setDir(1); setFurthest(np); setSt(freshState(steps[queue[np]])); setSkipReady(false); setPos(np);
  }

  function finish() {
    if (mode === "main") {
      tickTime();
      const s = session.current;
      const answered = Object.keys(s.firstTry).length; // guesses are never recorded, so accuracy excludes them
      const right = Object.values(s.firstTry).filter(Boolean).length;
      const xp = XP.lesson + XP.firstTry * right + XP.widget * s.widgets.length;
      const accuracy = answered ? right / answered : null;
      progress.completeLesson(lesson.id, xp, accuracy ?? 1);
      const missed = [...new Set(s.missed)].sort((a, b) => a - b);
      progress.setMissed(lesson.id, missed);
      progress.setResume(null);
      clearSession(lesson.id);
      setResult({ xp, accuracy, timeMs: s.elapsed, taught: s.taught.length, review: null });
      setMissedNow(missed);
    } else {
      const still = queue.filter((i) => {
        const r = reviewFirst.current[i];
        return steps[i].kind === "reveal" ? r === false : r !== true;
      });
      progress.setMissed(lesson.id, still);
      setMissedNow(still);
      setResult((r) => r && { ...r, review: { right: queue.length - still.length, total: queue.length } });
    }
    patch({ verdict: null });
    setScreen("done");
  }

  function startReview() {
    if (!missedNow.length) return;
    reviewFirst.current = {}; reviewSnaps.current = {}; liveRef.current = null;
    setMode("review"); setQueue(missedNow); setPos(0); setFurthest(0); setDir(1);
    setSt(freshState(steps[missedNow[0]])); setSkipReady(false); setScreen("steps");
  }

  const close = () => go(backHref);

  /* ---------- primary action (one place for Check, Continue, Try again) ---------- */
  const cont = (tone: Primary["tone"] = "accent"): Primary => ({ label: isLast ? (mode === "review" ? "Finish review" : "Finish") : "Continue", onClick: next, tone });
  let primary: Primary;
  let secondary: ReactNode = null;
  if (screen === "done" || !step) {
    primary = nextHref ? { label: "Next lesson", onClick: () => go(nextHref), tone: "accent" } : { label: "Back to chapter", onClick: close, tone: "accent" };
    if (nextHref) secondary = <button type="button" className="lp-link" onClick={close}>Back to chapter</button>;
  } else if (history) {
    primary = { label: "Continue", onClick: next, tone: "accent" };
    if (furthest - pos >= 2) secondary = <button type="button" className="lp-link" onClick={() => goTo(furthest)}>Return to step {furthest + 1}</button>;
  } else {
    switch (step.kind) {
      case "read": case "summary": primary = cont(); break;
      case "reveal": primary = phase === "done" ? cont() : { label: "Reveal", onClick: () => patch({ phase: "done" }), tone: "accent" }; break;
      case "widget":
        primary = { ...cont(st.widgetDone ? "good" : "accent"), disabled: !st.widgetDone };
        if (!st.widgetDone) secondary = skipReady
          ? <button type="button" className="lp-link" onClick={next}>Skip for now</button>
          : <span className="lp-bar-note">Do the task above to continue.</span>;
        break;
      case "match":
        primary = phase === "done" ? cont(st.ok && !guess ? "good" : "accent") : { label: "Continue", onClick: () => {}, disabled: true, tone: "accent" };
        if (phase !== "done") secondary = <span className="lp-bar-note">Tap a left item, then its partner.</span>;
        break;
      default:
        primary =
          phase === "done" ? cont(guess ? "accent" : st.ok ? "good" : "bad") :
          phase === "retry" ? { label: "Try again", onClick: tryAgain, tone: "bad" } :
          { label: "Check", onClick: check, disabled: !canCheck, tone: "accent" };
    }
  }

  /* ---------- keyboard ---------- */
  const canBack = screen === "steps" && pos > 0;
  const canTeach = screen === "steps" && isScored(step) && !history && phase !== "done" && !st.taught;
  const live = useRef({ primary, step, phase, showKeys, screen, canBack, canTeach, back, openTeach });
  live.current = { primary, step, phase, showKeys, screen, canBack, canTeach, back, openTeach };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const L = live.current;
      const t = e.target as HTMLElement | null;
      const inField = !!t && ((t.tagName === "INPUT" && !(t as HTMLInputElement).readOnly) || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") { e.preventDefault(); if (L.showKeys) setShowKeys(false); else go(backHref); return; }
      if (t?.closest(".lp-widget")) return; // simulations own their keys
      if (e.key === "?" && !inField) { e.preventDefault(); setShowKeys((v) => !v); return; }
      if (L.showKeys) return;
      if (e.key === "Enter") {
        if (e.repeat) return;
        if (t && t !== document.body && !inField) {
          if (t.closest("[data-own-enter], .tx-term, a, .lp-top, .lp-bar")) return; // let the focused control act
          if (t.tagName === "BUTTON" && !t.hasAttribute("data-tile")) return;
          if (t.hasAttribute("data-tile") && L.primary.disabled) return; // Enter selects the focused tile
        }
        if (!L.primary.disabled) { e.preventDefault(); L.primary.onClick(); }
        return;
      }
      if (e.key === " " && L.step?.kind === "reveal" && L.phase === "answer" && !inField && t?.tagName !== "BUTTON") {
        e.preventDefault(); L.primary.onClick(); return;
      }
      if (inField || L.screen !== "steps") return;
      if (e.key === "ArrowLeft" && !e.shiftKey) { if (L.canBack) { e.preventDefault(); L.back(); } return; }
      if ((e.key === "t" || e.key === "T") && L.canTeach) { e.preventDefault(); L.openTeach(); return; }
      if (stepKeys.current?.(e)) e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [backHref]);

  /* ---------- render ---------- */
  const right = Object.values(session.current.firstTry).filter(Boolean).length;
  const xpShown = result ? result.xp : XP.firstTry * right + XP.widget * session.current.widgets.length;
  const total = queue.length;
  const liveDone = pos === furthest ? phase === "done" : liveRef.current?.st.phase === "done";
  const filled = screen === "done" ? total : furthest + (liveDone ? 1 : 0);
  const assist = step && isScored(step) && screen === "steps" ? (
    <Teach open={st.taught} canOpen={!history && phase !== "done"} onOpen={openTeach}
      text={teachOf(step) ?? hintOf(step)} onBack={pos > 0 ? back : undefined} reduced={reduced} />
  ) : undefined;
  const ctx: ViewCtx = { phase, ok: st.ok, reduced, seed, keys: (fn) => { stepKeys.current = fn; }, guess, assist, past: history };
  const stepKey = `${mode}-${pos}-${screen}`;
  const stepVisual = step && screen === "steps" && "visual" in step ? step.visual : undefined;
  const layout = screen !== "steps" ? "" : step?.kind === "widget" ? "is-wide" : wide && splitsVisual(stepVisual) ? "is-split" : "";
  const shown = verdict && history ? { ...verdict, xp: 0 } : verdict;
  const opener = screen === "steps" && mode === "main" && pos === 0 && lesson.goal?.trim();

  return (
    <WideCtx.Provider value={wide}>
    <div className={`lp ${layout}`} ref={rootRef} style={{ ["--part" as string]: partColor }}>
      <header className={`lp-top ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-top-inner">
          <button type="button" className="lp-icon-btn" onClick={close} aria-label="Close lesson (your place is saved)" title="Close (Esc)">
            <IconClose size={22} />
          </button>
          <div className="lp-progress" role="progressbar" aria-label={mode === "review" ? "Review progress" : "Lesson progress"}
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(filled, total)}>
            {queue.map((_, i) => {
              const reach = screen === "steps" && i <= furthest && i !== pos;
              return (
                <button key={`${mode}-${i}`} type="button" tabIndex={-1} className={`lp-seg-hit ${reach ? "reach" : ""}`} disabled={!reach}
                  onClick={() => goTo(i)} title={reach ? `Go to step ${i + 1}` : undefined} aria-hidden="true">
                  <span className={`lp-seg ${i === pos && screen === "steps" ? (history ? "on here" : "on") : ""}`}>
                    <motion.i initial={false} animate={{ scaleX: i < filled ? 1 : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 195, damping: 28 }} />
                  </span>
                </button>
              );
            })}
          </div>
          <span className="lp-count tnum" aria-hidden="true">
            {mode === "review" && <span className="lp-review-tag">Review</span>}
            {screen === "done" ? total : pos + 1} of {total}
          </span>
          <div className="lp-xp tnum" aria-label={`${xpShown} XP this lesson`}>
            <motion.span key={xpShown} className="lp-xp-in" initial={reduced || xpShown === 0 ? false : { scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 250, damping: 14 }}>
              <IconBolt size={15} />{xpShown}
            </motion.span>
          </div>
          <button type="button" className="lp-icon-btn lp-keys-btn" onClick={() => setShowKeys(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <IconKeyboard size={19} />
          </button>
        </div>
      </header>

      <main className="lp-main">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <StepFrame key={stepKey} reduced={reduced} layout={layout} rootRef={rootRef} dir={dir}>
            {screen === "done" && result ? (
              <Completion lessonTitle={lesson.title} xp={result.xp} accuracy={result.accuracy} timeMs={result.timeMs} taught={result.taught}
                missed={missedNow.length} review={result.review} partColor={partColor} reduced={reduced} onReview={startReview} />
            ) : step ? (
              <>
                {opener && (
                  <div className="lp-goal" role="note" aria-label="In this lesson">
                    <div className="lp-goal-label">In this lesson</div>{" "}
                    <p className="lp-goal-text"><Inline text={opener} /></p>
                  </div>
                )}
                {step.kind === "read" && <ReadView step={step} />}
                {step.kind === "quiz" && <QuizView step={step} ans={ans as number | null} setAns={setAns} ruled={st.ruled} ctx={ctx} />}
                {step.kind === "multi" && <MultiView step={step} ans={ans as number[]} setAns={setAns} ctx={ctx} />}
                {step.kind === "number" && <NumberView step={step} ans={ans as string} setAns={setAns} ctx={ctx} revealLine={st.numberLine} />}
                {step.kind === "order" && <OrderView step={step} ans={ans as number[]} setAns={setAns} ctx={ctx} />}
                {step.kind === "match" && <MatchView step={step} ctx={ctx} onDone={onMatchDone} onMiss={(n) => patch({ matchMiss: n })} startMistakes={st.matchMiss} />}
                {step.kind === "reveal" && <RevealView step={step} ctx={ctx} self={st.self} setSelf={setSelf} />}
                {step.kind === "widget" && <WidgetView step={step} done={st.widgetDone} xp={mode === "main" && session.current.widgets.includes(idx) ? XP.widget : 0} onComplete={onWidgetComplete} />}
                {step.kind === "summary" && <SummaryView step={step} reduced={reduced} />}
              </>
            ) : null}
          </StepFrame>
        </AnimatePresence>
      </main>

      <div ref={barRef} className={`lp-bar ${shown ? `has-fb tone-${shown.tone}` : ""}`}>
        <div className="lp-bar-inner">
          <AnimatePresence initial={false}>
            {shown && (
              <motion.div key={`${stepKey}-${shown.title}-${shown.retry ? "r" : "f"}`} className="lp-fb"
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={reduced ? { duration: 0.15 } : SPRING_SHEET}>
                <div className="lp-fb-inner" role="status" aria-live="polite">
                  <div className="lp-fb-head">
                    <span className={`lp-fb-icon tone-${shown.tone}`} aria-hidden="true">
                      {shown.tone === "good" ? <DrawCheck size={18} reduced={reduced} /> : shown.tone === "bad" ? <IconX size={16} /> : <IconBulb size={17} />}
                    </span>
                    <span className="lp-fb-title">{shown.title}</span>
                    {!!shown.xp && <span className="lp-fb-xp tnum"><IconBolt size={13} />+{shown.xp} XP</span>}
                  </div>
                  {shown.answer !== undefined && (
                    <p className="lp-fb-line strong">Answer: <strong><Inline text={shown.answer} links={false} /></strong></p>
                  )}
                  {shown.lines.map((l, i) => <p key={i} className={`lp-fb-line ${i === 0 && !shown.retry && shown.answer === undefined ? "strong" : ""}`}>{l}</p>)}
                  {shown.explain && (shown.tone === "guess" ? (
                    <div className="lp-fb-teach">
                      <div className="lp-fb-teach-label">How it works</div>
                      <Text text={shown.explain} />
                    </div>
                  ) : (
                    <div className="lp-fb-explain">
                      {shown.why && <div className="lp-fb-why">Here is why</div>}
                      <Text text={shown.explain} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="lp-bar-row">
            <div className="lp-bar-side">{secondary}</div>
            <div className="lp-bar-actions">
              {screen === "steps" && (
                <button type="button" className="lp-back" onClick={back} disabled={!canBack}
                  aria-label="Previous step" title="Previous step (Left arrow)">
                  <IconChevronLeft size={22} />
                </button>
              )}
              <Button variant={primary.tone === "good" ? "good" : primary.tone === "bad" ? "danger" : "primary"} size="l" className="lp-cta" disabled={primary.disabled} onClick={primary.onClick}>
                <span>{primary.label}</span>
                {!primary.disabled && <kbd className="lp-kbd" aria-hidden="true">Enter</kbd>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>{showKeys && <Shortcuts key="keys" reduced={reduced} onClose={() => setShowKeys(false)} />}</AnimatePresence>
    </div>
    </WideCtx.Provider>
  );
}

/** Wraps one step: spring transition (from the right going forward, from the left going back), scroll to top, focus. */
const STEP_VARIANTS: Variants = {
  enter: (d: number) => ({ opacity: 0, x: 24 * d }),
  center: { opacity: 1, x: 0, transition: { ...springs.smooth, opacity: { duration: 0.2 } } },
  exit: (d: number) => ({ opacity: 0, x: -12 * d, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }),
};
const STEP_FADE: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
function StepFrame({ children, reduced, layout, rootRef, dir }: { children: ReactNode; reduced: boolean; layout: string; rootRef: React.RefObject<HTMLDivElement>; dir: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0;
    ref.current?.focus({ preventScroll: true });
  }, [rootRef]);
  return (
    <motion.section ref={ref} tabIndex={-1} className={`lp-step ${layout}`} aria-live="off"
      custom={dir} variants={reduced ? STEP_FADE : STEP_VARIANTS} initial="enter" animate="center" exit="exit">
      {children}
    </motion.section>
  );
}

const KEYS: [string[], string][] = [
  [["Enter"], "Check, then Continue"],
  [["1", "2", "3", "4"], "Pick an option"],
  [["A", "B", "C"], "Pick on the right side (match)"],
  [["T"], "I'm not sure, teach me"],
  [["←"], "Go back a step"],
  [["Backspace"], "Remove the last item (order)"],
  [["Space"], "Reveal (think-first steps)"],
  [["Esc"], "Close the lesson"],
  [["?"], "Show or hide this list"],
];

function Shortcuts({ onClose, reduced }: { onClose: () => void; reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }); }, []);
  return (
    <div className="lp-modal-root" onClick={onClose}>
      <motion.div className="lp-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
      <motion.div ref={box} role="dialog" aria-modal="true" aria-labelledby="lp-keys-title" className="lp-modal" onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 34 }}>
        <div className="lp-modal-head">
          <h2 id="lp-keys-title">Keyboard shortcuts</h2>
          <button type="button" data-own-enter="" className="lp-icon-btn" onClick={onClose} aria-label="Close shortcuts"><IconClose size={18} /></button>
        </div>
        <dl className="lp-keys">
          {KEYS.map(([keys, what]) => (
            <div key={what} className="lp-keys-row">
              <dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  );
}
