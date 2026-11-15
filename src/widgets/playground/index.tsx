/**
 * Delivery Playground: a live, playable system design of a Crunchyroll-like delivery
 * platform (the book's Chapter 18 proposal, not Crunchyroll's real system).
 *
 * Props
 * - `compact?: boolean`  true (lesson mode, ~640 x 600): scenario-first, simplified stage,
 *                        a small free-play tab. false (lab page, ~1100 wide): the whole stage,
 *                        all controls, live traffic stats and the narration side panel.
 * - `scenario?: number`  1-based scenario to open first (1 A cache hit, 2 A miss the shield
 *                        catches, 3 Cold premiere herd, 4 CDN A goes down, 5 The origin region
 *                        fails, 6 Make it cheaper). Compact mode opens scenario 1 by default;
 *                        full mode opens in free play unless this is set.
 * - `onComplete?: () => void`  called once, when the reader has finished 2 scenarios in
 *                        compact mode, or 3 scenarios in full mode. "Finished" means the
 *                        scenario ran and its answer was revealed (right or wrong).
 *
 * Files: model.ts (pure simulation), layout.ts (geometry), Stage.tsx (SVG + packet),
 * Controls.tsx (controls + stats), Narration.tsx, ScenarioCard.tsx, scenarios.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Segmented } from "@/ui";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { clamp } from "@/lib/format";
import type { WidgetProps } from "../types";
import {
  INITIAL, NO_FAULTS, simulateRequest, simulateTraffic, viewersFromLog,
  type PgState, type RequestTrace,
} from "./model";
import { makeLayout } from "./layout";
import { CDN_COLOR, Stage } from "./Stage";
import { CompactControls, FullControls, TrafficStatsGrid, fmtViewers, type Patch } from "./Controls";
import { Narration } from "./Narration";
import { ScenarioCard, type Phase } from "./ScenarioCard";
import { SCENARIOS, applyPatch, freshState, type RunCtx, type ScenarioPatch } from "./scenarios";
import "./playground.css";

interface Props extends WidgetProps { scenario?: number }

const STAGE_LABEL = "Delivery architecture: viewers in Tokyo, Sao Paulo, Frankfurt and Los Angeles; a steering service; CDN A and CDN B, each with an edge PoP per region and its own shield; origin S3 us-west-2 with a GCS replica in us-central1.";

export default function Playground({ compact = false, onComplete, scenario }: Props) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const width = useWidth(root);
  const startIdx = clamp(Math.round(Number(scenario) || 1) - 1, 0, SCENARIOS.length - 1);
  const guided = compact || scenario != null;

  const [s, setS] = useState<PgState>(() => (guided ? freshState(SCENARIOS[startIdx].start) : INITIAL));
  const [view, setView] = useState<"request" | "traffic">(guided ? SCENARIOS[startIdx].view : "request");
  const [trace, setTrace] = useState<RequestTrace | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rampLog, setRampLog] = useState<number | null>(null);

  const [scIdx, setScIdx] = useState<number | null>(guided ? startIdx : null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [choice, setChoice] = useState<number | null>(null);
  const [ctx, setCtx] = useState<RunCtx | null>(null);
  const [nextCtx, setNextCtx] = useState<RunCtx | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [tab, setTab] = useState<"scenarios" | "free">("scenarios");

  const pending = useRef<null | (() => void)>(null);
  const raf = useRef(0);
  const timer = useRef(0);
  const fired = useRef(false);
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current); }, []);

  // Completion rule: 2 scenarios in lesson mode, 3 on the lab page.
  useEffect(() => {
    if (!fired.current && done.length >= (compact ? 2 : 3)) { fired.current = true; onComplete?.(); }
  }, [done, compact, onComplete]);

  const shownState = rampLog != null ? { ...s, viewersLog: rampLog } : s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const traffic = useMemo(() => simulateTraffic(shownState), [s, rampLog]);
  const baseStats = useMemo(() => simulateTraffic(s).stats, [s]);

  const kind = width > 0 && width < 520 ? "tall" : compact || (width > 0 && width < 900) ? "compact" : "wide";
  const L = useMemo(() => makeLayout(kind), [kind]);

  const patch: Patch = useCallback((p) => setS((prev) => ({ ...prev, ...p, faults: { ...prev.faults, ...(p.faults ?? {}) } })), []);

  /** Stop whatever is animating (packet or traffic ramp). */
  const stopAll = () => {
    pending.current = null;
    cancelAnimationFrame(raf.current); clearTimeout(timer.current);
    setRampLog(null); setBusy(false);
  };

  /** Animate one request through the stage. `then` runs when the bytes are back. */
  const play = (st: PgState, then?: (t: RequestTrace) => void) => {
    const t = simulateRequest(st);
    setTrace(t); setRevealed(0); setView("request"); setBusy(true); setPlayKey((k) => k + 1);
    pending.current = () => {
      setS((prev) => ({ ...prev, filled: Array.from(new Set([...prev.filled, ...t.fills])) }));
      setBusy(false);
      then?.(t);
    };
  };
  const onHop = useCallback((i: number) => setRevealed(i + 1), []);
  const onDone = useCallback(() => { const f = pending.current; pending.current = null; f?.(); }, []);

  /** Ramp viewers from zero to the target so flows visibly grow (skipped with reduced motion). */
  const ramp = (target: number, then: () => void) => {
    setView("traffic");
    if (reduced) { then(); return; }
    setBusy(true);
    const t0 = performance.now(), dur = 1500;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setRampLog((1 - Math.pow(1 - k, 3)) * target);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else { setRampLog(null); setBusy(false); then(); }
    };
    raf.current = requestAnimationFrame(step);
  };
  /** A discrete change in traffic view: let the flows ease to their new width, then reveal. */
  const settle = (then: () => void) => {
    setView("traffic");
    if (reduced) { then(); return; }
    setBusy(true);
    timer.current = window.setTimeout(() => { setBusy(false); then(); }, 900);
  };

  const markDone = (id: number) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  const openScenario = (i: number) => {
    stopAll();
    const sc = SCENARIOS[i];
    setScIdx(i); setPhase("ask"); setChoice(null); setCtx(null); setNextCtx(null);
    setS(freshState(sc.start)); setView(sc.view); setTrace(null); setRevealed(0); setPlayKey((k) => k + 1);
    setTab("scenarios");
  };

  const runStep = (change: ScenarioPatch | undefined, run: "request" | "traffic", first: boolean, finish: (c: RunCtx) => void) => {
    const before = simulateTraffic(s).stats;
    const ns = applyPatch(s, change);
    const after = simulateTraffic(ns).stats;
    setS(ns);
    if (run === "request") { play(ns, (t) => finish({ before, after, trace: t })); return; }
    setTrace(null); setRevealed(0);
    if (first && !change) ramp(ns.viewersLog, () => finish({ before, after, trace: null }));
    else settle(() => finish({ before, after, trace: null }));
  };

  const runScenario = () => {
    if (scIdx == null) return;
    const sc = SCENARIOS[scIdx];
    setPhase("running");
    runStep(sc.change, sc.run, true, (c) => { setCtx(c); setPhase("revealed"); markDone(sc.id); });
  };
  const tryNext = () => {
    if (scIdx == null) return;
    const nx = SCENARIOS[scIdx].next; if (!nx) return;
    setPhase("next-running");
    runStep(nx.change, nx.run, false, (c) => { setNextCtx(c); setPhase("next-revealed"); });
  };

  const freePlay = () => { stopAll(); setScIdx(null); setTrace(null); setRevealed(0); setPlayKey((k) => k + 1); };
  const purge = () => patch({ edgeWarm: false, shieldWarm: false, filled: [] });
  const runTraffic = () => { setTrace(null); setRevealed(0); ramp(s.viewersLog, () => {}); };
  const resetAll = () => { stopAll(); setS({ ...INITIAL, faults: NO_FAULTS }); setTrace(null); setRevealed(0); setPlayKey((k) => k + 1); setView("request"); };

  const sc = scIdx != null ? SCENARIOS[scIdx] : null;
  const card = sc && (
    <ScenarioCard sc={sc} phase={phase} choice={choice} before={baseStats} ctx={ctx} nextCtx={nextCtx} reduced={reduced} compact={compact}
      isLast={scIdx === SCENARIOS.length - 1} onChoose={setChoice} onRun={runScenario} onTryNext={tryNext}
      onNext={() => openScenario(Math.min(SCENARIOS.length - 1, (scIdx ?? 0) + 1))}
      onReplay={() => play(s)}
      live={compact && trace ? <Narration trace={trace} revealed={revealed} reduced={reduced} compact /> : undefined} />
  );

  const stage = (
    <div className="pg-stage">
      <Stage L={L} s={s} view={view} traffic={traffic} trace={trace} revealed={revealed} playKey={playKey} reduced={reduced}
        onHop={onHop} onDone={onDone} onPickRegion={busy || (sc && phase !== "ask") || (compact && tab === "scenarios") ? undefined : (r) => patch({ region: r })} label={STAGE_LABEL} />
      {view === "traffic" && (
        <div className="pg-stage-chip" aria-live="polite">
          {fmtViewers(viewersFromLog(shownState.viewersLog))} viewers · {traffic.stats.phase === "cold" ? "first minute, cold caches" : "steady state"}
        </div>
      )}
    </div>
  );

  const legend = (
    <div className="pg-legend">
      <span><i style={{ background: CDN_COLOR.A }} />CDN A · Fastly-like</span>
      <span><i style={{ background: CDN_COLOR.B }} />CDN B · CloudFront-like</span>
      <span><i className="ring" />solid ring = warm cache, dashed = cold</span>
      {view === "traffic" && <span><i className="bar" />line width grows with load</span>}
    </div>
  );

  const scenarioNav = (
    <nav className="pg-scnav" aria-label="Scenarios">
      {SCENARIOS.map((x, i) => (
        <button key={x.id} type="button" className={`pg-scbtn${scIdx === i ? " on" : ""}${done.includes(x.id) ? " done" : ""}`} onClick={() => openScenario(i)}
          aria-current={scIdx === i ? "step" : undefined} aria-label={`Scenario ${x.id}: ${x.title}${done.includes(x.id) ? ", done" : ""}`}>
          <span className="pg-scnum">{done.includes(x.id) ? <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3L5 8.6L9.5 3.6" /></svg> : x.id}</span>
          {!compact && <span className="pg-sctitle">{x.title}</span>}
        </button>
      ))}
    </nav>
  );

  const assumptions = (
    <p className="pg-assume">
      Assumed numbers, not Crunchyroll's: ~4 Mbps per stream, so 2M viewers ≈ 8 Tbps; {s.segSec} s segments with separate audio and video; each PoP dot stands for ~20 PoPs; 6 Tbps reserved per CDN; prices from the book's ranges.
    </p>
  );

  if (compact) {
    return (
      <div ref={root} className={`pg pg-compact${kind === "tall" ? " is-tall" : ""}`}>
        <div className="pg-topbar">
          <Segmented value={tab} options={[{ value: "scenarios", label: "Scenarios" }, { value: "free", label: "Free play" }]}
            onChange={(v: "scenarios" | "free") => { if (v === "free") { freePlay(); setTab("free"); } else openScenario(scIdx ?? 0); }} />
          {tab === "scenarios" ? scenarioNav : <span className="pg-progress">{done.length} of {SCENARIOS.length} scenarios done</span>}
        </div>
        {stage}
        {tab === "free" && <Narration trace={trace} revealed={revealed} reduced={reduced} compact />}
        {tab === "scenarios" ? card : (
          <CompactControls s={s} patch={patch} busy={busy} onPlay={() => play(s)} onPurge={purge} onRunTraffic={runTraffic} view={view} />
        )}
      </div>
    );
  }

  return (
    <div ref={root} className={`pg pg-full${kind === "wide" ? "" : " is-narrow"}${kind === "tall" ? " is-tall" : ""}`}>
      <header className="pg-head">
        <div>
          <div className="pg-eyebrow">Chapter 18 · System design you can play</div>
          <h2>Delivery Playground</h2>
        </div>
        <div className="pg-head-r">
          <Segmented value={view} options={[{ value: "request", label: "One request" }, { value: "traffic", label: "Traffic" }]}
            onChange={(v: "request" | "traffic") => (v === "traffic" ? runTraffic() : setView("request"))} disabled={busy} />
          <Button variant="ghost" size="s" onClick={resetAll} disabled={busy}>Reset</Button>
        </div>
      </header>
      {scenarioNav}
      <div className="pg-main">
        <div className="pg-left">
          {stage}
          {legend}
      <section className="pg-statsblock" aria-label="Live traffic stats">
            <div className="pg-stats-head">
              <span>If {fmtViewers(viewersFromLog(shownState.viewersLog))} viewers did this</span>
              <span className="pg-muted">{traffic.stats.phase === "cold" ? "first minute after T0 or a purge" : "steady state"}</span>
            </div>
            <TrafficStatsGrid st={traffic.stats} />
            {traffic.stats.notes.length > 0 && (
              <ul className="pg-notes">{traffic.stats.notes.map((n, i) => <li key={i} className={`tone-${n.tone}`}>{n.text}</li>)}</ul>
            )}
          </section>
        </div>
        <aside className="pg-side">
          {card}
          {sc && <div className="pg-side-free"><Button variant="ghost" size="s" onClick={freePlay}>Leave scenario, free play</Button></div>}
          {(!sc || trace) && <Narration trace={trace} revealed={revealed} reduced={reduced} dense={!!sc} />}
        </aside>
      </div>
      <FullControls s={s} patch={patch} busy={busy} onPlay={() => play(s)} onPurge={purge} onRunTraffic={runTraffic} view={view} />
      {assumptions}
    </div>
  );
}
