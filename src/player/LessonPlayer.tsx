/**
 * The lesson player: one step at a time, a fixed action bar (Check / Continue / Try again in one place),
 * a feedback sheet, resume at every step, XP, and a completion screen with a review round.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Chapter, Lesson, Step } from "@/content/types";
import { progress } from "@/state/progress";
import { useReducedMotion } from "@/lib/hooks";
import { go } from "@/lib/router";
import { Button, springs } from "@/ui";
import { Inline, Text } from "./Text";
import { XP, fmtAnswer, gradeMulti, gradeNumber, gradeOrder, hintOf, parseNumber } from "./grade";
import {
  MatchView, MultiView, NumberView, OrderView, QuizView, ReadView, RevealView, SummaryView, WidgetView, type Phase, type ViewCtx,
} from "./steps";
import { Completion } from "./Completion";
import { DrawCheck, IconBolt, IconBulb, IconClose, IconKeyboard, IconX } from "./icons";
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


/* ---------------- Session (so resume keeps XP, accuracy and time honest) ---------------- */
interface Session { firstTry: Record<number, boolean>; widgets: number[]; missed: number[]; elapsed: number }
const freshSession = (): Session => ({ firstTry: {}, widgets: [], missed: [], elapsed: 0 });
const skey = (id: string) => `delivery-academy:player:${id}`;
function loadSession(id: string): Session | null {
  try { const raw = localStorage.getItem(skey(id)); return raw ? { ...freshSession(), ...JSON.parse(raw) } : null; } catch { return null; }
}
function saveSession(id: string, s: Session) { try { localStorage.setItem(skey(id), JSON.stringify(s)); } catch { /* storage blocked */ } }
function clearSession(id: string) { try { localStorage.removeItem(skey(id)); } catch { /* storage blocked */ } }

const initAns = (s: Step | undefined): unknown => (!s ? null : s.kind === "multi" || s.kind === "order" ? [] : s.kind === "number" ? "" : null);

type Tone = "good" | "bad" | "neutral";
interface Verdict { tone: Tone; title: string; lines: ReactNode[]; explain?: string; why?: boolean; retry?: boolean; xp?: number }
interface Primary { label: string; onClick: () => void; disabled?: boolean; tone: "accent" | "good" | "bad" }
interface Result { xp: number; accuracy: number | null; timeMs: number; review: { right: number; total: number } | null }

const SPRING_SMOOTH = springs.smooth;

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
    const r = progress.get().resume;
    const pos = r && r.chapter === chapter.n && r.lesson === lessonNumber && r.step > 0 && r.step < steps.length ? r.step : 0;
    const session = (pos > 0 && loadSession(lesson.id)) || freshSession();
    if (pos === 0) clearSession(lesson.id);
    return { pos, session };
  });
  const session = useRef<Session>(start.session);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const [mode, setMode] = useState<"main" | "review">("main");
  const [queue, setQueue] = useState<number[]>(() => steps.map((_, i) => i));
  const [pos, setPos] = useState(start.pos);
  const [screen, setScreen] = useState<"steps" | "done">("steps");
  const [result, setResult] = useState<Result | null>(null);
  const [missedNow, setMissedNow] = useState<number[]>([]);
  const reviewFirst = useRef<Record<number, boolean>>({});

  // Per-step state
  const [phase, setPhase] = useState<Phase>("answer");
  const [attempt, setAttempt] = useState(0);
  const [ans, setAnsRaw] = useState<unknown>(() => initAns(steps[start.pos]));
  const [ruled, setRuled] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [okFinal, setOkFinal] = useState(false);
  const [self, setSelfRaw] = useState<"had" | "missed" | null>(null);
  const [widgetDone, setWidgetDone] = useState(false);
  const [skipReady, setSkipReady] = useState(false);
  const [numberLine, setNumberLine] = useState<string | undefined>();
  const [showKeys, setShowKeys] = useState(false);

  const idx = queue[pos];
  const step: Step | undefined = steps[idx];
  const isLast = pos === queue.length - 1;
  const seed = `${lesson.id}:${idx}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stepKeys = useRef<((e: KeyboardEvent) => boolean) | null>(null);
  const markRef = useRef(performance.now());

  /* ---------- time, resume and session persistence ---------- */
  const tickTime = () => { const now = performance.now(); session.current.elapsed += now - markRef.current; markRef.current = now; };
  const liveMode = useRef({ mode, screen }); liveMode.current = { mode, screen };
  useEffect(() => {
    if (mode !== "main" || screen !== "steps") return;
    progress.setResume({ chapter: chapter.n, lesson: lessonNumber, step: pos });
    tickTime();
    saveSession(lesson.id, session.current);
  }, [pos, mode, screen]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (screen !== "steps" || step?.kind !== "widget") return;
    const t = setTimeout(() => setSkipReady(true), 20000);
    return () => clearTimeout(t);
  }, [pos, mode, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- keep the checked answer visible above the sheet ---------- */
  useEffect(() => {
    if (!verdict) return;
    const t = setTimeout(() => {
      const root = rootRef.current, bar = barRef.current; if (!root || !bar) return;
      const target = root.querySelector<HTMLElement>(".lp-step .st-bad, .lp-step .st-good, .lp-step .lp-num, .lp-step .lp-slots, .lp-step .lp-match");
      if (!target) return;
      const over = target.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 16;
      if (over > 0) root.scrollBy({ top: over, behavior: reduced ? "auto" : "smooth" });
    }, reduced ? 0 : 280);
    return () => clearTimeout(t);
  }, [verdict, reduced]);

  /* ---------- step lifecycle ---------- */
  function enterStep(i: number) {
    setPhase("answer"); setAttempt(0); setAnsRaw(initAns(steps[i])); setRuled([]); setVerdict(null); setOkFinal(false);
    setSelfRaw(null); setWidgetDone(false); setSkipReady(false); setNumberLine(undefined);
  }
  /** Record the first-try result once per step. Returns the XP it earned. */
  function recordFirst(ok: boolean): number {
    if (mode === "main") {
      const s = session.current;
      if (idx in s.firstTry) return 0;
      s.firstTry[idx] = ok;
      if (!ok && !s.missed.includes(idx)) s.missed.push(idx);
      saveSession(lesson.id, s); bump();
      return ok ? XP.firstTry : 0;
    }
    if (!(idx in reviewFirst.current)) reviewFirst.current[idx] = ok;
    return 0;
  }

  function setAns(v: unknown) {
    if (phase === "done" || !step) return;
    if (phase === "retry") {
      if (step.kind === "quiz") {
        if (v === ans) return;
        if (typeof ans === "number") setRuled((r) => [...r, ans]);
      }
      setPhase("answer"); setVerdict(null);
    }
    setAnsRaw(v);
  }
  function tryAgain() {
    if (step?.kind === "quiz" && typeof ans === "number") { setRuled((r) => [...r, ans]); setAnsRaw(null); }
    setPhase("answer"); setVerdict(null);
  }
  function retry(lines: (string | undefined)[]) {
    recordFirst(false);
    setAttempt(1); setPhase("retry");
    setVerdict({ tone: "bad", title: "Not quite", lines: lines.filter(Boolean) as string[], retry: true });
  }
  function resolve(ok: boolean, lines: ReactNode[], explain?: string) {
    const xp = attempt === 0 ? recordFirst(ok) : 0;
    setPhase("done"); setOkFinal(ok);
    setVerdict({ tone: ok ? "good" : "bad", title: ok ? "Correct" : "Not quite", lines, explain, why: !ok, xp });
  }

  const canCheck = (() => {
    if (!step) return false;
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
    const firstTry = attempt === 0;
    switch (step.kind) {
      case "quiz": {
        const ok = ans === step.answer;
        if (ok) return resolve(true, [], step.explain);
        if (firstTry && step.options.length > 2) return retry([hintOf(step) ?? "Read the question again. You have one more try."]);
        return resolve(false, [<>Answer: <strong><Inline text={step.options[step.answer]} links={false} /></strong></>], step.explain);
      }
      case "multi": {
        const g = gradeMulti(step, ans as number[]);
        if (g.ok) return resolve(true, [], step.explain);
        if (firstTry) {
          const extra = g.extra ? `, and ${g.extra} that ${g.extra === 1 ? "does" : "do"} not apply` : "";
          return retry([`You picked ${g.found} of the ${g.total} correct answers${extra}.`, hintOf(step)]);
        }
        return resolve(false, ["The correct choices are marked in green."], step.explain);
      }
      case "number": {
        const v = parseNumber(String(ans))!;
        const g = gradeNumber(step, v);
        const unit = step.unit ? ` ${step.unit}` : "";
        const range = step.tolerance > 0 ? `We accept ${fmtAnswer(step.answer - step.tolerance)} to ${fmtAnswer(step.answer + step.tolerance)}${unit}.` : "";
        if (g.ok) { setNumberLine(`Answer: ${fmtAnswer(step.answer)}${unit}`); return resolve(true, range ? [range] : [], step.explain); }
        if (firstTry) return retry([g.slip, hintOf(step) ?? (g.slip ? undefined : "Write each number with its unit, then multiply step by step.")]);
        setNumberLine(`Answer: ${fmtAnswer(step.answer)}${unit}`);
        return resolve(false, [`You said ${fmtAnswer(v)}${unit}. ${range}`, g.slip], step.explain);
      }
      case "order": {
        const g = gradeOrder(step, ans as number[]);
        if (g.ok) return resolve(true, [], step.explain);
        if (firstTry) return retry([`${g.inPlace} of ${g.total} ${g.inPlace === 1 ? "is" : "are"} in the right place. Tap an item to take it out.`, hintOf(step)]);
        return resolve(false, ["The correct order is shown above."], step.explain);
      }
    }
  }

  function onMatchDone(mistakes: number) {
    if (!step || step.kind !== "match") return;
    const ok = mistakes === 0;
    const xp = recordFirst(ok);
    setPhase("done"); setOkFinal(ok);
    if (ok) setVerdict({ tone: "good", title: "Correct", lines: [], explain: step.explain, xp });
    else setVerdict({
      tone: "neutral", title: "All matched",
      lines: [`You needed ${mistakes} extra ${mistakes === 1 ? "try" : "tries"}.${mode === "main" ? " This step comes back in your review." : ""}`],
      explain: step.explain,
    });
  }

  function setSelf(v: "had" | "missed") {
    setSelfRaw(v);
    if (mode === "main") {
      const s = session.current;
      s.missed = s.missed.filter((x) => x !== idx);
      if (v === "missed") s.missed.push(idx);
      saveSession(lesson.id, s);
    } else reviewFirst.current[idx] = v === "had";
  }

  function onWidgetComplete() {
    if (!step || step.kind !== "widget" || widgetDone) return;
    setWidgetDone(true);
    progress.markWidget(step.widget);
    if (mode === "main" && !session.current.widgets.includes(idx)) {
      session.current.widgets.push(idx);
      saveSession(lesson.id, session.current); bump();
    }
  }

  function next() {
    if (isLast) return finish();
    const np = pos + 1;
    enterStep(queue[np]); setPos(np);
  }

  function finish() {
    if (mode === "main") {
      tickTime();
      const s = session.current;
      const answered = Object.keys(s.firstTry).length;
      const right = Object.values(s.firstTry).filter(Boolean).length;
      const xp = XP.lesson + XP.firstTry * right + XP.widget * s.widgets.length;
      const accuracy = answered ? right / answered : null;
      progress.completeLesson(lesson.id, xp, accuracy ?? 1);
      const missed = [...new Set(s.missed)].sort((a, b) => a - b);
      progress.setMissed(lesson.id, missed);
      progress.setResume(null);
      clearSession(lesson.id);
      setResult({ xp, accuracy, timeMs: s.elapsed, review: null });
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
    setVerdict(null);
    setScreen("done");
  }

  function startReview() {
    if (!missedNow.length) return;
    reviewFirst.current = {};
    setMode("review"); setQueue(missedNow); setPos(0); enterStep(missedNow[0]); setScreen("steps");
  }

  const close = () => go(backHref);

  /* ---------- primary action (one place for Check, Continue, Try again) ---------- */
  const cont = (tone: Primary["tone"] = "accent"): Primary => ({ label: isLast ? (mode === "review" ? "Finish review" : "Finish") : "Continue", onClick: next, tone });
  let primary: Primary;
  let secondary: ReactNode = null;
  if (screen === "done" || !step) {
    primary = nextHref ? { label: "Next lesson", onClick: () => go(nextHref), tone: "accent" } : { label: "Back to chapter", onClick: close, tone: "accent" };
    if (nextHref) secondary = <button type="button" className="lp-link" onClick={close}>Back to chapter</button>;
  } else {
    switch (step.kind) {
      case "read": case "summary": primary = cont(); break;
      case "reveal": primary = phase === "done" ? cont() : { label: "Reveal", onClick: () => setPhase("done"), tone: "accent" }; break;
      case "widget":
        primary = { ...cont(widgetDone ? "good" : "accent"), disabled: !widgetDone };
        if (!widgetDone) secondary = skipReady
          ? <button type="button" className="lp-link" onClick={next}>Skip for now</button>
          : <span className="lp-bar-note">Do the task above to continue.</span>;
        break;
      case "match":
        primary = phase === "done" ? cont(okFinal ? "good" : "accent") : { label: "Continue", onClick: () => {}, disabled: true, tone: "accent" };
        if (phase !== "done") secondary = <span className="lp-bar-note">Tap a left item, then its partner.</span>;
        break;
      default:
        primary =
          phase === "done" ? cont(okFinal ? "good" : "bad") :
          phase === "retry" ? { label: "Try again", onClick: tryAgain, tone: "bad" } :
          { label: "Check", onClick: check, disabled: !canCheck, tone: "accent" };
    }
  }

  /* ---------- keyboard ---------- */
  const live = useRef({ primary, step, phase, showKeys, screen });
  live.current = { primary, step, phase, showKeys, screen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const L = live.current;
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
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
      if (stepKeys.current?.(e)) e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [backHref]);

  /* ---------- render ---------- */
  const right = Object.values(session.current.firstTry).filter(Boolean).length;
  const xpShown = result ? result.xp : XP.firstTry * right + XP.widget * session.current.widgets.length;
  const total = queue.length;
  const filled = screen === "done" ? total : pos + (phase === "done" ? 1 : 0);
  const ctx: ViewCtx = { phase, ok: okFinal, reduced, seed, keys: (fn) => { stepKeys.current = fn; } };
  const stepKey = `${mode}-${pos}-${screen}`;
  const stepVisual = step && screen === "steps" && "visual" in step ? step.visual : undefined;
  const layout = screen !== "steps" ? "" : step?.kind === "widget" ? "is-wide" : wide && splitsVisual(stepVisual) ? "is-split" : "";

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
            {queue.map((_, i) => (
              <span key={`${mode}-${i}`} className={`lp-seg ${i === pos && screen === "steps" ? "on" : ""}`}>
                <motion.i initial={false} animate={{ scaleX: i < filled ? 1 : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 195, damping: 28 }} />
              </span>
            ))}
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
        <AnimatePresence mode="wait" initial={false}>
          <StepFrame key={stepKey} reduced={reduced} layout={layout} rootRef={rootRef}>
            {screen === "done" && result ? (
              <Completion lessonTitle={lesson.title} xp={result.xp} accuracy={result.accuracy} timeMs={result.timeMs}
                missed={missedNow.length} review={result.review} partColor={partColor} reduced={reduced} onReview={startReview} />
            ) : step ? (
              <>
                {step.kind === "read" && <ReadView step={step} />}
                {step.kind === "quiz" && <QuizView step={step} ans={ans as number | null} setAns={setAns} ruled={ruled} ctx={ctx} />}
                {step.kind === "multi" && <MultiView step={step} ans={ans as number[]} setAns={setAns} ctx={ctx} />}
                {step.kind === "number" && <NumberView step={step} ans={ans as string} setAns={setAns} ctx={ctx} revealLine={numberLine} />}
                {step.kind === "order" && <OrderView step={step} ans={ans as number[]} setAns={setAns} ctx={ctx} />}
                {step.kind === "match" && <MatchView step={step} ctx={ctx} onDone={onMatchDone} />}
                {step.kind === "reveal" && <RevealView step={step} ctx={ctx} self={self} setSelf={setSelf} />}
                {step.kind === "widget" && <WidgetView step={step} done={widgetDone} xp={mode === "main" && session.current.widgets.includes(idx) ? XP.widget : 0} onComplete={onWidgetComplete} />}
                {step.kind === "summary" && <SummaryView step={step} reduced={reduced} />}
              </>
            ) : null}
          </StepFrame>
        </AnimatePresence>
      </main>

      <div ref={barRef} className={`lp-bar ${verdict ? `has-fb tone-${verdict.tone}` : ""}`}>
        <div className="lp-bar-inner">
          <AnimatePresence initial={false}>
            {verdict && (
              <motion.div key={`${stepKey}-${verdict.title}-${verdict.retry ? "r" : "f"}`} className="lp-fb"
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={reduced ? { duration: 0.15 } : SPRING_SHEET}>
                <div className="lp-fb-inner" role="status" aria-live="polite">
                  <div className="lp-fb-head">
                    <span className={`lp-fb-icon tone-${verdict.tone}`} aria-hidden="true">
                      {verdict.tone === "good" ? <DrawCheck size={18} reduced={reduced} /> : verdict.tone === "bad" ? <IconX size={16} /> : <IconBulb size={17} />}
                    </span>
                    <span className="lp-fb-title">{verdict.title}</span>
                    {!!verdict.xp && <span className="lp-fb-xp tnum"><IconBolt size={13} />+{verdict.xp} XP</span>}
                  </div>
                  {verdict.lines.map((l, i) => <p key={i} className={`lp-fb-line ${i === 0 && !verdict.retry ? "strong" : ""}`}>{l}</p>)}
                  {verdict.explain && (
                    <div className="lp-fb-explain">
                      {verdict.why && <div className="lp-fb-why">Here is why</div>}
                      <Text text={verdict.explain} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="lp-bar-row">
            <div className="lp-bar-side">{secondary}</div>
            <Button variant={primary.tone === "good" ? "good" : primary.tone === "bad" ? "danger" : "primary"} size="l" className="lp-cta" disabled={primary.disabled} onClick={primary.onClick}>
              <span>{primary.label}</span>
              {!primary.disabled && <kbd className="lp-kbd" aria-hidden="true">Enter</kbd>}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>{showKeys && <Shortcuts key="keys" reduced={reduced} onClose={() => setShowKeys(false)} />}</AnimatePresence>
    </div>
    </WideCtx.Provider>
  );
}

/** Wraps one step: spring transition, scroll to top, focus for screen readers. */
function StepFrame({ children, reduced, layout, rootRef }: { children: ReactNode; reduced: boolean; layout: string; rootRef: React.RefObject<HTMLDivElement> }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0;
    ref.current?.focus({ preventScroll: true });
  }, [rootRef]);
  return (
    <motion.section ref={ref} tabIndex={-1} className={`lp-step ${layout}`} aria-live="off"
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0, transition: reduced ? { duration: 0.15 } : { ...SPRING_SMOOTH, opacity: { duration: 0.2 } } }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -12, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
    >
      {children}
    </motion.section>
  );
}

const KEYS: [string[], string][] = [
  [["Enter"], "Check, then Continue"],
  [["1", "2", "3", "4"], "Pick an option"],
  [["A", "B", "C"], "Pick on the right side (match)"],
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
