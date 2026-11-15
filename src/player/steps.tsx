/** Step renderers. The player owns answer state, phases and the bottom bar; these views are controlled. */
import { Component, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type {
  MatchStep, MultiStep, NumberStep, OrderStep, QuizStep, ReadStep, RevealStep, SummaryStep, Visual as VisualT, WidgetStep,
} from "@/content/types";
import { Visual } from "@/diagram";
import { Callout } from "@/ui";
import { WIDGETS } from "@/widgets/registry";
import { Inline, Text } from "./Text";
import { shuffledIndexes } from "./grade";
import { IconBolt, IconCheck, IconExpand, IconFlask, IconSpark, IconX } from "./icons";
import { WideCtx, splitsVisual } from "./layoutCtx";

export type Phase = "answer" | "retry" | "done";
export interface ViewCtx {
  phase: Phase;
  /** true when the final verdict is "correct" */
  ok: boolean;
  reduced: boolean;
  seed: string;
  /** Register a key handler for this step (digits, letters, Backspace). Return true if handled. */
  keys: (fn: ((e: KeyboardEvent) => boolean) | null) => void;
  /** Unscored warm-up ("Take a guess"): neutral result colors, no red. */
  guess: boolean;
  /** Rendered right under the prompt: the "I'm not sure, teach me" link and its card. */
  assist?: ReactNode;
  /** The reader went Back to this step: it shows the final answer, read-only. */
  past?: boolean;
}

/* ---------------- Shared pieces ---------------- */

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Visual above the text (capped at 52vh, scroll inside, Expand), or a sticky left column on wide screens. */
function StepLayout({ visual, children }: { visual?: VisualT; children: ReactNode }) {
  const wide = useContext(WideCtx);
  if (visual && wide && splitsVisual(visual)) {
    return (
      <div className="lp-split">
        <div className="lp-split-visual"><VisualFrame visual={visual} mode="split" /></div>
        <div className="lp-split-text">{children}</div>
      </div>
    );
  }
  return <>{visual && <VisualFrame visual={visual} mode="stacked" />}{children}</>;
}

function VisualFrame({ visual, mode }: { visual: VisualT; mode: "split" | "stacked" }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = frame.current, i = inner.current;
    if (!f || !i) return;
    const check = () => setOver(i.offsetHeight > f.clientHeight + 4);
    check();
    const ro = new ResizeObserver(check); ro.observe(f); ro.observe(i);
    return () => ro.disconnect();
  }, []);
  const fail = <div className="lp-visual-fail">This diagram could not be drawn.</div>;
  return (
    <figure className={`lp-visual ${mode} ${over ? "over" : ""}`}>
      <div ref={frame} className="lp-visual-frame" tabIndex={over ? 0 : undefined} aria-label={over ? "Diagram, scroll to see all of it" : undefined}>
        <div ref={inner}><Boundary fallback={fail}><Visual visual={visual} /></Boundary></div>
      </div>
      {over && (
        <button type="button" data-own-enter="" className="lp-visual-expand" onClick={() => setOpen(true)}>
          <IconExpand size={15} />Expand
        </button>
      )}
      {open && <VisualModal visual={visual} onClose={() => setOpen(false)} />}
    </figure>
  );
}

function VisualModal({ visual, onClose }: { visual: VisualT; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const cb = useRef(onClose); cb.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); cb.current(); } };
    window.addEventListener("keydown", f, true);
    return () => { window.removeEventListener("keydown", f, true); prev?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(
    <div className="lp-vmodal-root" onClick={onClose}>
      <div className="lp-scrim" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Diagram" className="lp-vmodal" onClick={(e) => e.stopPropagation()}>
        <button type="button" data-own-enter="" className="lp-icon-btn lp-vmodal-close" onClick={onClose} aria-label="Close diagram"><IconX size={18} /></button>
        <Boundary fallback={<div className="lp-visual-fail">This diagram could not be drawn.</div>}><Visual visual={visual} /></Boundary>
      </div>
    </div>,
    document.body,
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => <div className="lp-eyebrow">{children}</div>;

/** Eyebrow, prompt and the teach-me slot. A guess gets a calm accent label and a "no score" note instead. */
function PromptHead({ label, prompt, ctx }: { label: string; prompt: string; ctx: ViewCtx }) {
  return (
    <>
      {ctx.past && <p className="lp-past">You are looking back. Your answer is saved.</p>}
      {ctx.guess ? (
        <div className="lp-guess">
          <div className="lp-guess-row">
            <span className="lp-guess-pill"><IconSpark size={14} />Take a guess</span>
            {label !== "Question" && <span className="lp-guess-kind">{label}</span>}
          </div>
          <p className="lp-guess-note">We haven't covered this yet. No score.</p>
        </div>
      ) : <Eyebrow>{label}</Eyebrow>}
      <h2 className="lp-prompt"><Inline text={prompt} /></h2>
      {ctx.assist}
    </>
  );
}

/** idle..done: scored states. ans / picked / nope: the neutral states a guess uses instead of good / bad. */
type TileState = "idle" | "sel" | "good" | "bad" | "missed" | "dim" | "ruled" | "done" | "ans" | "picked" | "nope";

function Tile(p: {
  state: TileState; onClick?: () => void; disabled?: boolean; badge?: ReactNode; text: string; reduced: boolean;
  role?: string; checked?: boolean; check?: "box" | "key"; tag?: string; className?: string; layoutId?: string;
}) {
  const anim =
    p.reduced ? {} :
    p.state === "bad" || p.state === "nope" ? { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.32 } } :
    p.state === "good" ? { scale: [1, 1.03, 1], transition: { duration: 0.18 } } : {};
  return (
    <motion.div className="lp-tile-wrap" animate={anim} layoutId={p.layoutId} transition={p.layoutId ? { layout: { type: "spring", stiffness: 195, damping: 28 } } : undefined}>
      <button
        type="button" data-tile="" role={p.role} aria-checked={p.role ? !!p.checked : undefined}
        className={`lp-tile st-${p.state} ${p.className ?? ""}`} onClick={p.onClick} disabled={p.disabled}
      >
        {p.badge !== undefined && <span className={`lp-tile-badge ${p.check === "box" ? "box" : "key"}`} aria-hidden="true">{p.badge}</span>}
        <span className="lp-tile-text"><Inline text={p.text} links={false} /></span>
        {p.tag && <span className="lp-tile-tag">{p.tag}</span>}
        {(p.state === "good" || p.state === "done") && <span className="lp-tile-mark good" aria-hidden="true"><IconCheck size={p.state === "done" ? 14 : 18} /></span>}
        {p.state === "ans" && <span className="lp-tile-mark ans" aria-hidden="true"><IconCheck size={16} /></span>}
        {(p.state === "bad" || p.state === "ruled") && <span className="lp-tile-mark bad" aria-hidden="true"><IconX size={p.state === "ruled" ? 14 : 18} /></span>}
      </button>
    </motion.div>
  );
}

const digitOf = (e: KeyboardEvent) => (/^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1);

/* ---------------- read ---------------- */

export function ReadView({ step }: { step: ReadStep }) {
  return (
    <StepLayout visual={step.visual}>
      {step.title && <h2 className="lp-title"><Inline text={step.title} /></h2>}
      <Text text={step.body} className="lp-body" />
      {step.callout && <div className="lp-callout"><Callout type={step.callout.type}><Text text={step.callout.text} /></Callout></div>}
    </StepLayout>
  );
}

/* ---------------- quiz ---------------- */

export function QuizView({ step, ans, setAns, ruled, ctx }: { step: QuizStep; ans: number | null; setAns: (v: number) => void; ruled: number[]; ctx: ViewCtx }) {
  const locked = ctx.phase === "done";
  useEffect(() => {
    ctx.keys((e) => { const i = digitOf(e); if (i >= 0 && i < step.options.length && !locked && !ruled.includes(i)) { setAns(i); return true; } return false; });
    return () => ctx.keys(null);
  });
  return (
    <StepLayout visual={step.visual}>
      <PromptHead label="Question" prompt={step.prompt} ctx={ctx} />
      <div className="lp-options" role="radiogroup" aria-label="Options">
        {step.options.map((o, i) => {
          let st: TileState = "idle";
          if (locked && ctx.guess) st = i === step.answer ? "ans" : i === ans ? "picked" : "dim";
          else if (locked) st = i === step.answer ? "good" : i === ans ? "bad" : "dim";
          else if (ctx.phase === "retry" && i === ans) st = "bad";
          else if (ruled.includes(i)) st = "ruled";
          else if (i === ans) st = "sel";
          return (
            <Tile key={i} state={st} text={o} reduced={ctx.reduced} role="radio" checked={i === ans} badge={i + 1}
              disabled={locked || st === "ruled"} onClick={() => setAns(i)}
              tag={st === "ruled" ? "Not this one" : st === "picked" || (st === "ans" && i === ans) ? "Your guess" : undefined} />
          );
        })}
      </div>
    </StepLayout>
  );
}

/* ---------------- multi ---------------- */

export function MultiView({ step, ans, setAns, ctx }: { step: MultiStep; ans: number[]; setAns: (v: number[]) => void; ctx: ViewCtx }) {
  const locked = ctx.phase === "done";
  const toggle = (i: number) => setAns(ans.includes(i) ? ans.filter((x) => x !== i) : [...ans, i].sort((a, b) => a - b));
  useEffect(() => {
    ctx.keys((e) => { const i = digitOf(e); if (i >= 0 && i < step.options.length && !locked) { toggle(i); return true; } return false; });
    return () => ctx.keys(null);
  });
  return (
    <StepLayout visual={step.visual}>
      <PromptHead label="Select all that apply" prompt={step.prompt} ctx={ctx} />
      <div className="lp-options" role="group" aria-label="Options, select all that apply">
        {step.options.map((o, i) => {
          const picked = ans.includes(i), right = step.answers.includes(i);
          let st: TileState = picked ? "sel" : "idle";
          if (locked && ctx.guess) st = right ? "ans" : picked ? "picked" : "dim";
          else if (locked) st = right ? (picked ? "good" : "missed") : picked ? "bad" : "dim";
          return (
            <Tile key={i} state={st} text={o} reduced={ctx.reduced} role="checkbox" checked={picked} check="box"
              badge={<span className="lp-box">{picked && <IconCheck size={14} />}</span>}
              disabled={locked} onClick={() => toggle(i)}
              tag={st === "missed" ? "Also correct" : ctx.guess && locked && picked ? "Your guess" : undefined} />
          );
        })}
      </div>
    </StepLayout>
  );
}

/* ---------------- number ---------------- */

export function NumberView({ step, ans, setAns, ctx, revealLine }: { step: NumberStep; ans: string; setAns: (v: string) => void; ctx: ViewCtx; revealLine?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const locked = ctx.phase === "done";
  useEffect(() => {
    if (!locked && typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches) ref.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ctx.phase === "answer" && ans) ref.current?.select();
    if (ctx.phase === "done") ref.current?.blur();
  }, [ctx.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = locked ? (ctx.guess ? "guess" : ctx.ok ? "good" : "bad") : ctx.phase === "retry" ? "bad" : ans ? "sel" : "idle";
  return (
    <StepLayout visual={step.visual}>
      <PromptHead label="Estimate" prompt={step.prompt} ctx={ctx} />
      <label className={`lp-num st-${tone}`}>
        <span className="sr-only">Your answer{step.unit ? ` in ${step.unit}` : ""}</span>
        <input
          ref={ref} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} enterKeyHint="done"
          placeholder="Your answer" value={ans} readOnly={locked} onChange={(e) => setAns(e.target.value)} aria-invalid={tone === "bad"}
        />
        {step.unit && <span className="lp-num-unit">{step.unit}</span>}
      </label>
      {locked && revealLine && <div className={`lp-num-answer ${ctx.guess ? "guess" : ctx.ok ? "good" : ""}`}>{revealLine}</div>}
    </StepLayout>
  );
}

/* ---------------- order (word bank) ---------------- */

export function OrderView({ step, ans, setAns, ctx }: { step: OrderStep; ans: number[]; setAns: (v: number[]) => void; ctx: ViewCtx }) {
  const bank = useMemo(() => shuffledIndexes(step.items.length, ctx.seed), [step.items.length, ctx.seed]);
  const locked = ctx.phase === "done";
  const showCorrect = locked && (!ctx.ok || ctx.guess);
  const toggle = (item: number) => { if (locked) return; setAns(ans.includes(item) ? ans.filter((x) => x !== item) : [...ans, item]); };
  useEffect(() => {
    ctx.keys((e) => {
      if (locked) return false;
      const i = digitOf(e);
      if (i >= 0 && i < bank.length) { toggle(bank[i]); return true; }
      if (e.key === "Backspace" && ans.length) { setAns(ans.slice(0, -1)); return true; }
      return false;
    });
    return () => ctx.keys(null);
  });
  const slots = step.items.map((_, k) => (showCorrect ? k : ans[k]));
  return (
    <>
      <PromptHead label="Put in order" prompt={step.prompt} ctx={ctx} />
      {showCorrect && <div className={`lp-subnote ${ctx.guess ? "guess" : ""}`}>{ctx.guess ? "How it actually goes:" : "The correct order:"}</div>}
      <ol className="lp-slots" aria-label="Your order">
        {slots.map((item, k) => {
          const filled = item !== undefined;
          const st: TileState = !filled ? "idle" : locked ? (ctx.guess ? "ans" : "good") : "sel";
          return (
            <li key={k} className={`lp-slot ${filled ? "filled" : "empty"}`}>
              <span className="lp-slot-n" aria-hidden="true">{k + 1}</span>
              {filled ? (
                <Tile state={st} text={step.items[item]} reduced={ctx.reduced} disabled={locked} onClick={() => toggle(item)} className="lp-slot-tile" />
              ) : (
                <span className="lp-slot-empty">{k === ans.length ? "Tap an item below" : ""}</span>
              )}
            </li>
          );
        })}
      </ol>
      {!locked && (
        <div className="lp-bank" aria-label="Items to place">
          {bank.map((item, pos) => {
            const used = ans.includes(item);
            return (
              <button key={item} type="button" data-tile="" className={`lp-chip ${used ? "used" : ""}`} onClick={() => toggle(item)}
                aria-label={used ? `${step.items[item]} (placed, tap to remove)` : step.items[item]}>
                <span className="lp-chip-key" aria-hidden="true">{pos + 1}</span>
                <span className="lp-chip-text"><Inline text={step.items[item]} links={false} /></span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------- match ---------------- */

const LETTERS = "abcdefgh";

export function MatchView({ step, ctx, onDone, onMiss, startMistakes = 0 }: {
  step: MatchStep; ctx: ViewCtx; onDone: (mistakes: number) => void;
  /** Called on every wrong pair, so the player can keep the count if the reader leaves and comes back. */
  onMiss?: (mistakes: number) => void; startMistakes?: number;
}) {
  const n = step.pairs.length;
  const right = useMemo(() => shuffledIndexes(n, ctx.seed + ":r"), [n, ctx.seed]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ l: number; r: number; ok: boolean } | null>(null);
  const mistakes = useRef(startMistakes);
  const locked = ctx.phase === "done";
  const allDone = locked || matched.length === n;

  useEffect(() => {
    if (selL === null || selR === null) return;
    const ok = selL === selR;
    setFlash({ l: selL, r: selR, ok });
    if (!ok) { mistakes.current++; onMiss?.(mistakes.current); }
    const t = setTimeout(() => {
      setFlash(null); setSelL(null); setSelR(null);
      if (ok) { const next = [...matched, selL]; setMatched(next); if (next.length === n) onDone(mistakes.current); }
    }, ok ? 260 : 520);
    return () => clearTimeout(t);
  }, [selL, selR]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickL = (i: number) => { if (allDone || flash || matched.includes(i)) return; setSelL(selL === i ? null : i); };
  const pickR = (i: number) => { if (allDone || flash || matched.includes(i)) return; setSelR(selR === i ? null : i); };

  useEffect(() => {
    ctx.keys((e) => {
      const d = digitOf(e);
      if (d >= 0 && d < n) { pickL(d); return true; }
      const li = LETTERS.indexOf(e.key.toLowerCase());
      if (e.key.length === 1 && li >= 0 && li < n) { pickR(right[li]); return true; }
      return false;
    });
    return () => ctx.keys(null);
  });

  const stateOf = (pair: number, side: "l" | "r"): TileState => {
    if (allDone || matched.includes(pair)) return "done";
    if (flash && (side === "l" ? flash.l : flash.r) === pair) return flash.ok ? "good" : ctx.guess ? "nope" : "bad";
    if ((side === "l" ? selL : selR) === pair) return "sel";
    return "idle";
  };
  return (
    <>
      <PromptHead label="Match the pairs" prompt={step.prompt} ctx={ctx} />
      <div className="lp-match" role="group" aria-label="Tap one item on the left, then its partner on the right">
        {step.pairs.map((_, row) => {
          // Once every pair is found, the right column slides into line with its partners.
          const r = allDone ? row : right[row];
          return (
            <div className="lp-match-row" key={row}>
              <Tile state={stateOf(row, "l")} text={step.pairs[row][0]} reduced={ctx.reduced} badge={allDone ? undefined : row + 1}
                onClick={() => pickL(row)} disabled={allDone || matched.includes(row)} className="lp-match-tile" />
              <Tile state={stateOf(r, "r")} text={step.pairs[r][1]} reduced={ctx.reduced} badge={allDone ? undefined : LETTERS[row].toUpperCase()}
                layoutId={ctx.reduced ? undefined : `${ctx.seed}-r${r}`}
                onClick={() => pickR(r)} disabled={allDone || matched.includes(r)} className="lp-match-tile" />
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- reveal ---------------- */

export function RevealView({ step, ctx, self, setSelf }: { step: RevealStep; ctx: ViewCtx; self: "had" | "missed" | null; setSelf: (v: "had" | "missed") => void }) {
  const shown = ctx.phase === "done";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (shown) ref.current?.scrollIntoView({ block: "nearest", behavior: ctx.reduced ? "auto" : "smooth" }); }, [shown, ctx.reduced]);
  return (
    <StepLayout visual={step.visual}>
      {ctx.past && <p className="lp-past">You are looking back. Your answer is saved.</p>}
      <Eyebrow>Think first</Eyebrow>
      <h2 className="lp-prompt"><Inline text={step.prompt} /></h2>
      {!shown && <p className="lp-think">Form your answer in your head, or say it out loud. Then press Reveal.</p>}
      {shown && (
        <motion.div ref={ref} className="lp-reveal" initial={ctx.reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
          <div className="lp-reveal-label">Answer</div>
          <Text text={step.answer} className="lp-reveal-body" />
          <div className="lp-self" role="group" aria-label="Did you have it?">
            <span className="lp-self-q">Did you have it?</span>
            <button type="button" data-own-enter="" className={`lp-self-btn ${self === "had" ? "on good" : ""}`} aria-pressed={self === "had"} onClick={() => setSelf("had")}>I had it</button>
            <button type="button" data-own-enter="" className={`lp-self-btn ${self === "missed" ? "on" : ""}`} aria-pressed={self === "missed"} onClick={() => setSelf("missed")}>I missed it</button>
          </div>
        </motion.div>
      )}
    </StepLayout>
  );
}

/* ---------------- widget ---------------- */

export function WidgetView({ step, done, xp, onComplete }: { step: WidgetStep; done: boolean; xp: number; onComplete: () => void }) {
  const meta = WIDGETS[step.widget];
  const cb = useRef(onComplete); cb.current = onComplete;
  const stable = useMemo(() => () => cb.current(), []);
  const C = meta?.Component;
  return (
    <>
      <Eyebrow><span className="lp-eyebrow-icon"><IconFlask size={14} /></span>Try it</Eyebrow>
      <h2 className="lp-title"><Inline text={step.title ?? meta?.title ?? "Simulation"} /></h2>
      <div className={`lp-task ${done ? "done" : ""}`}>
        <span className="lp-task-mark" aria-hidden="true">{done ? <IconCheck size={14} /> : null}</span>
        <div className="lp-task-text"><Text text={step.task} /></div>
        {done && xp > 0 && <span className="lp-task-xp tnum"><IconBolt size={13} />+{xp} XP</span>}
        <span className="sr-only" aria-live="polite">{done ? "Task done." : ""}</span>
      </div>
      <div className="lp-widget">
        {C ? (
          <Boundary fallback={<div className="lp-visual-fail">This simulation could not start. You can skip it for now.</div>}>
            <Suspense fallback={<div className="lp-widget-loading" aria-label="Loading simulation"><span /><span /><span /></div>}>
              <C compact onComplete={stable} {...(step.props ?? {})} />
            </Suspense>
          </Boundary>
        ) : (
          <div className="lp-visual-fail">Unknown simulation "{step.widget}".</div>
        )}
      </div>
    </>
  );
}

/* ---------------- summary ---------------- */

export function SummaryView({ step, reduced }: { step: SummaryStep; reduced: boolean }) {
  return (
    <>
      <Eyebrow>Summary</Eyebrow>
      <h2 className="lp-title"><Inline text={step.title ?? "Key points"} /></h2>
      <ul className="lp-summary">
        {step.points.map((p, i) => (
          <motion.li key={i}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0.15 } : { delay: 0.12 + i * 0.09, type: "spring", stiffness: 260, damping: 30 }}>
            <span className="lp-summary-mark" aria-hidden="true"><IconCheck size={14} /></span>
            <div className="lp-summary-text"><Text text={p} /></div>
          </motion.li>
        ))}
      </ul>
    </>
  );
}
