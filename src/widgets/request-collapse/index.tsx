/**
 * Request collapsing (Chapter 5.6, Chapter 13.4).
 *
 * A simulcast premiere starts: thousands of viewers ask for segment 1 of a new episode in the same seconds,
 * and no cache has it. The reader fires the burst with and without collapsing (edge and shield) and sees how
 * many requests reach the origin, the origin's peak load, how long waiting viewers wait, and the tail.
 * Two one-click edge cases from the book: an uncacheable 403/404/5xx under collapsing (shared error,
 * serialized line, or hit-for-pass), and a slow origin under collapsing (no stampede, uniform waiting).
 *
 * Props
 * - `onComplete?: () => void` Called once, after the reader has fired a burst with collapsing OFF
 *   (edge collapsing off and no shield, origin answering 200) and then, later, a burst with edge collapsing ON
 *   (origin answering 200). Unlocks Continue in a lesson.
 * - `preset?: "stampede" | "edge" | "shield" | "error" | "slow"` Optional starting setup. Default "stampede"
 *   (50k viewers, 6 PoPs, no collapsing, no shield, 250 ms origin). "edge" = edge collapsing on;
 *   "shield" = edge collapsing + shield; "error" = uncacheable 404 that serializes the waiting list;
 *   "slow" = 100k viewers, collapsing + shield, 2 s origin.
 * - `compact?: boolean` (from WidgetProps) Lesson mode, about 640px wide.
 *
 * All traffic numbers are ASSUMED (see sim.ts), except the 5,500 GET/s per-prefix S3 rate (Chapter 6) and
 * Fastly's 2-minute hit-for-pass default (Chapter 5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetProps } from "../types";
import { Button, Callout, Chip, Eyebrow, Icon, LineChart, Segmented, Slider, Stage, Stat, StatGrid, Toggle, WidgetFrame, type Series } from "@/ui";
import { fmtBps, fmtMs, fmtNum, fmtPct } from "@/lib/format";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import CollapseStage, { fmtShort, type Phase } from "./CollapseStage";
import { anyCollapse, BUCKETS, DT, ORIGIN_RATE, SEGMENT_BYTES, simulate, TIMEOUT, type Answer, type Config, type Policy, type Result } from "./sim";
import "./request-collapse.css";

export type RequestCollapsePreset = "stampede" | "edge" | "shield" | "error" | "slow";

const BASE: Config = { burst: 50000, pops: 6, edgeCollapse: false, shield: false, originMs: 250, answer: 200, policy: "share" };
const PRESETS: Record<RequestCollapsePreset, Config> = {
  stampede: BASE,
  edge: { ...BASE, edgeCollapse: true },
  shield: { ...BASE, edgeCollapse: true, shield: true },
  error: { ...BASE, burst: 20000, edgeCollapse: true, shield: true, originMs: 250, answer: 404, policy: "serialize" },
  slow: { ...BASE, burst: 100000, edgeCollapse: true, shield: true, originMs: 2000 },
};
const DEMOS: { id: RequestCollapsePreset; label: string }[] = [
  { id: "stampede", label: "No collapsing" },
  { id: "edge", label: "Edge collapsing" },
  { id: "shield", label: "Edge + shield" },
  { id: "error", label: "Uncacheable 404" },
  { id: "slow", label: "Slow origin" },
];

const BURSTS = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 150000, 200000];
const ORIGIN_MS = [50, 100, 150, 250, 400, 600, 800, 1000, 1500, 2000];
const nearest = (list: number[], v: number) => list.reduce((bi, x, i) => (Math.abs(x - v) < Math.abs(list[bi] - v) ? i : bi), 0);

/* ---------------- predict questions ---------------- */
interface Question { kind: "count" | "slow" | "error"; prompt: string; options: { id: string; label: string }[] }

function question(c: Config): Question {
  if (c.answer !== 200) return {
    kind: "error",
    prompt: `The origin answers ${c.answer} with no-store, so the answer cannot be cached. What happens to the viewers waiting for it?`,
    options: [
      { id: "same", label: "They all get the same error, at once" },
      { id: "line", label: "They go to the origin one at a time, and most give up" },
      { id: "herd", label: "They all go to the origin in parallel: the herd is back" },
    ],
  };
  if (c.originMs >= 800 && anyCollapse(c)) return {
    kind: "slow",
    prompt: `The origin now takes ${fmtMs(c.originMs)} to answer. With collapsing on, what do the viewers see?`,
    options: [
      { id: "fast", label: "Most are fast; only a few wait for the origin" },
      { id: "together", label: "Most wait, then all get the first byte at the same moment" },
      { id: "herd", label: "The origin is flooded with requests" },
    ],
  };
  return {
    kind: "count",
    prompt: `${fmtNum(c.burst)} viewers ask for segment 1 across ${c.pops} cold PoPs. How many requests reach the origin?`,
    options: [
      { id: "many", label: "Far more than one per PoP" },
      { id: "perPop", label: `About one per PoP (${c.pops})` },
      { id: "one", label: "Just 1" },
    ],
  };
}

function correctOption(q: Question, r: Result): string {
  const c = r.cfg;
  if (q.kind === "error") return !anyCollapse(c) || c.policy === "hfp" ? "herd" : c.policy === "share" ? "same" : "line";
  if (q.kind === "slow") return r.originRequests > 3 * c.pops ? "herd" : r.waitedShare > 0.5 ? "together" : "fast";
  return r.originRequests <= 1 ? "one" : r.originRequests <= 3 * c.pops ? "perPop" : "many";
}

/* ---------------- plain-English read-out of a run ---------------- */
function insight(r: Result): string {
  const c = r.cfg, n = r.originRequests;
  if (c.answer !== 200) {
    if (!anyCollapse(c)) return `Nothing collapses, so every miss went to the origin: ${fmtNum(n)} requests, and every viewer still got a ${c.answer}.`;
    if (c.policy === "share") return `The CDN copied the one ${c.answer} to every waiting viewer. That is fast, but all ${fmtShort(c.burst)} viewers saw an error at the premiere. The origin got only ${fmtNum(n)} requests, about one per round trip.`;
    if (c.policy === "serialize") return `The ${c.answer} could not be shared, so it answered only the first request. The rest formed a new line and went to the origin one at a time, each waiting for the one before. Only ${fmtNum(n)} requests reached the origin in ${fmtNum(r.endT, 0)} s, and ${fmtPct(r.timeoutShare)} of viewers gave up after ${TIMEOUT} s.`;
    return `After the first ${c.answer}, the CDN remembered "do not collapse this URL" (hit-for-pass). The waiters were released and every new request went straight through: ${fmtNum(n)} origin requests. No line, but no protection either.`;
  }
  if (c.originMs >= 800 && anyCollapse(c)) return `Only ${fmtNum(n)} request${n === 1 ? "" : "s"} reached the origin, so there was no stampede. But ${fmtPct(r.waitedShare)} of viewers waited on that one fetch, and they all got their first byte at the same moment. If their players time out together, they retry together.`;
  if (!anyCollapse(c)) {
    const q = r.peakRps > ORIGIN_RATE ? ` That is above the ${fmtNum(ORIGIN_RATE)} requests per second the origin can serve, so a queue formed and the slowest viewers waited ${fmtMs(r.p99 * 1000)}.` : "";
    return `Every miss went to the origin until the first copy came back and was cached. ${fmtNum(n)} requests reached the origin, peaking at ${fmtShort(r.peakRps)} per second.${q}`;
  }
  if (c.edgeCollapse && !c.shield) return `Each PoP sent one request and held the rest on a waiting list: ${fmtNum(n)} origin requests for ${c.pops} PoPs. In a real CDN this is about one per PoP per server cluster, and more if each server collapses on its own.`;
  if (c.edgeCollapse && c.shield) return `Each PoP sent one request to the shield, and the shield collapsed those ${c.pops} into ${fmtNum(n)}. One origin request served ${fmtShort(c.burst)} viewers.`;
  const sh = r.rec.shieldUp.reduce((a, b) => a + b, 0);
  return `The edges did not collapse, so the shield received the herd and collapsed it into ${fmtNum(n)} origin request${n === 1 ? "" : "s"} (${fmtNum(sh)} sent up). The origin is safe, but the shield is now the hot spot.`;
}

const describe = (c: Config) =>
  `${c.edgeCollapse ? (c.shield ? "Edge + shield" : "Edge collapsing") : c.shield ? "Shield only" : "No collapsing"}${c.answer !== 200 ? `, ${c.answer}` : ""}`;

/* ---------------- widget ---------------- */
export default function RequestCollapse({ onComplete, preset, compact }: WidgetProps & { preset?: RequestCollapsePreset }) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWidth(rootRef) >= 760; // same breakpoint as WidgetFrame: controls move to the right column
  const [cfg, setCfg] = useState<Config>(() => PRESETS[(preset as RequestCollapsePreset) in PRESETS ? (preset as RequestCollapsePreset) : "stampede"]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [prev, setPrev] = useState<Result | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [task, setTask] = useState({ off: false, on: false });
  const completed = useRef(false);

  const q = useMemo(() => question(cfg), [cfg]);

  const update = (patch: Partial<Config>) => {
    setCfg((c) => ({ ...c, ...patch }));
    if (result) setPrev(result);
    setResult(null); setPhase("idle"); setPick(null);
  };
  const loadPreset = (id: RequestCollapsePreset) => update(PRESETS[id]);

  const fire = () => {
    if (!pick) return;
    if (result) setPrev(result);
    const r = simulate(cfg);
    setResult(r);
    setPhase(reduced ? "done" : "running");
  };
  const again = () => { if (result) setPrev(result); setResult(null); setPhase("idle"); setPick(null); };

  const finished = useCallback(() => setPhase("done"), []);

  // completion: a 200 run with nothing collapsing, then a 200 run with edge collapsing on
  useEffect(() => {
    if (phase !== "done" || !result) return;
    const c = result.cfg;
    if (c.answer !== 200) return;
    setTask((t) => {
      const next = { ...t };
      if (!c.edgeCollapse && !c.shield) next.off = true;
      if (c.edgeCollapse && t.off) next.on = true;
      return next;
    });
  }, [phase, result]);
  useEffect(() => {
    if (task.off && task.on && !completed.current) { completed.current = true; onComplete?.(); }
  }, [task, onComplete]);

  const correct = result && phase === "done" ? correctOption(q, result) : null;
  const locked = phase === "running";

  /* ---------- controls ---------- */
  const controls = (
    <div className="rc-controls">
      <div className="rc-demos">
        <div className="rc-label">One-click setups</div>
        <div className="rc-demo-row">
          {DEMOS.map((d) => (
            <button key={d.id} type="button" className="rc-demo" disabled={locked} onClick={() => loadPreset(d.id)}
              aria-pressed={JSON.stringify(PRESETS[d.id]) === JSON.stringify(cfg)}>{d.label}</button>
          ))}
        </div>
      </div>
      <div className="rc-grid">
        <Slider label="Burst size" value={nearest(BURSTS, cfg.burst)} min={0} max={BURSTS.length - 1} disabled={locked}
          format={(i) => `${fmtShort(BURSTS[i])} requests`} onChange={(i) => update({ burst: BURSTS[i] })} hint="Within about 3 seconds" />
        <Slider label="Edge PoPs" value={cfg.pops} min={2} max={12} disabled={locked} onChange={(v) => update({ pops: v })} />
        <Slider label="Origin response time" value={nearest(ORIGIN_MS, cfg.originMs)} min={0} max={ORIGIN_MS.length - 1} disabled={locked}
          format={(i) => fmtMs(ORIGIN_MS[i])} onChange={(i) => update({ originMs: ORIGIN_MS[i] })} />
        <Segmented<Answer> label="Origin answers" value={cfg.answer} disabled={locked}
          options={[{ value: 200, label: "200" }, { value: 403, label: "403" }, { value: 404, label: "404" }, { value: 503, label: "503" }]}
          onChange={(v) => update({ answer: v })} />
        <Toggle label="Collapsing at the edge" hint="Each PoP sends one request per object" checked={cfg.edgeCollapse} disabled={locked} onChange={(v) => update({ edgeCollapse: v })} />
        <Toggle label="Shield" hint="One PoP in front of the origin; it also collapses" checked={cfg.shield} disabled={locked} onChange={(v) => update({ shield: v })} />
        {cfg.answer !== 200 && (
          <div className="rc-span">
            <Segmented<Policy> label="When the answer cannot be cached, the waiting list..." value={cfg.policy} disabled={locked}
              options={[{ value: "share", label: "Shares it" }, { value: "serialize", label: "Goes one by one" }, { value: "hfp", label: "Hit-for-pass" }]}
              onChange={(v) => update({ policy: v })} />
          </div>
        )}
      </div>
    </div>
  );

  /* ---------- run bar: predict, fire, feedback ---------- */
  const runBar = (
    <div className="rc-run">
      <div className="rc-run-head">
        <Eyebrow dot="var(--p3)">Predict, then fire</Eyebrow>
        <span className="rc-task" aria-label="Task progress">
          <Chip tone={task.off ? "good" : "neutral"}>{task.off && <Icon name="check" size={12} stroke={2.5} />}Collapsing off</Chip>
          <Chip tone={task.on ? "good" : "neutral"}>{task.on && <Icon name="check" size={12} stroke={2.5} />}Then on</Chip>
        </span>
      </div>
      <p className="rc-q" id="rc-q">{q.prompt}</p>
      <div className="rc-options" role="radiogroup" aria-labelledby="rc-q">
        {q.options.map((o) => {
          const state = correct ? (o.id === correct ? "is-right" : o.id === pick ? "is-wrong" : "is-dim") : o.id === pick ? "is-picked" : "";
          return (
            <button key={o.id} type="button" role="radio" aria-checked={o.id === pick} disabled={phase !== "idle"}
              className={`rc-option ${state}`} onClick={() => setPick(o.id)}>
              <span className="rc-radio" aria-hidden="true">{correct && o.id === correct ? <Icon name="check" size={12} stroke={3} /> : correct && o.id === pick ? <Icon name="x" size={12} stroke={3} /> : null}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="rc-actions">
        {phase === "idle" && <Button variant="primary" onClick={fire} disabled={!pick}><Icon name="bolt" size={18} />Fire the burst</Button>}
        {phase === "idle" && !pick && <span className="rc-hint">Pick an answer to unlock the run.</span>}
        {phase === "running" && <><Button variant="secondary" onClick={() => setSkip((s) => s + 1)}>Skip to the end</Button><span className="rc-hint">Watching {fmtShort(cfg.burst)} requests arrive...</span></>}
        {phase === "done" && <>
          <Button variant="secondary" onClick={again}><Icon name="reset" size={16} />Run again</Button>
          <span className={`rc-verdict ${correct === pick ? "good" : "bad"}`}>{correct === pick ? "You called it." : "Not quite."}</span>
          {!task.off ? <span className="rc-hint">Next: turn collapsing off and fire.</span> : !task.on ? <span className="rc-hint">Next: turn on collapsing at the edge and fire again.</span> : null}
        </>}
      </div>
    </div>
  );

  /* ---------- results ---------- */
  const results = result && phase === "done" ? <Results r={result} prev={prev} compact={!!compact} /> : null;

  return (
    <div className="rc-root" ref={rootRef}>
      <WidgetFrame
        stage={<div className="rc-footer">
          <Stage className="rc-stagebox"><CollapseStage cfg={cfg} result={result} phase={phase} reduced={reduced} skip={skip} onFinished={finished} /></Stage>
          {wide && runBar}
        </div>}
        controls={controls}
        footer={<div className="rc-footer">
          {!wide && runBar}
          {results}
          {cfg.answer !== 200 && (
            <Callout type="mistake">
              Collapsing works because the CDN can copy one answer to everyone who is waiting. A {cfg.answer} sent with <code>no-store</code> cannot be copied.
              So the CDN has three bad choices. It can hand the same error to every waiter. It can hold the waiters off and send them to the origin one at a time,
              so a {fmtMs(cfg.originMs)} origin becomes a line many seconds long (Fastly calls this serializing the waiting list). Or it can remember
              "do not collapse this URL" for a while (hit-for-pass, 2 minutes by default on Fastly) and let every request through in parallel, which brings the herd back.
              The fix: publish segments before the manifest, and give error answers a short, explicit TTL (for example 1 to 2 s) so they can be shared.
            </Callout>
          )}
          {result && phase === "done" && cfg.answer === 200 && cfg.originMs >= 800 && anyCollapse(cfg) && (
            <Callout type="staff">
              Collapsing turns a slow origin into uniform waiting. Keep the shield close to the origin, set CDN origin timeouts shorter than the player's
              segment timeout so the CDN can fail over first, and serve stale when an older copy exists.
            </Callout>
          )}
        </div>}
      />
    </div>
  );
}

function Results({ r, prev, compact }: { r: Result; prev: Result | null; compact: boolean }) {
  const c = r.cfg, n = r.originRequests;
  const shieldIn = r.rec.shieldUp.reduce((a, b) => a + b, 0);
  const total = r.hist.reduce((a, b) => a + b, 0) || 1;
  const step = 5; // 50 ms points
  const pts = (x: Result): [number, number][] => {
    const out: [number, number][] = [];
    const end = Math.ceil(x.endT / DT);
    for (let i = 0; i <= end; i += step) out.push([i * DT, x.rec.originRps[i] ?? 0]);
    return out;
  };
  const series: Series[] = [{ id: "now", label: `This run: ${describe(c)}`, color: "var(--p3)", points: pts(r), area: true }];
  if (prev && JSON.stringify(prev.cfg) !== JSON.stringify(c)) series.push({ id: "prev", label: `Last run: ${describe(prev.cfg)}`, color: "var(--muted)", points: pts(prev), dashed: true });
  const xMax = Math.max(r.endT, series.length > 1 && prev ? prev.endT : 0);
  const tone = n <= 1 ? "good" : n <= 3 * c.pops ? "accent" : "bad";
  return (
    <div className="rc-results">
      <StatGrid>
        <Stat label="Requests at origin" value={fmtNum(n)} tone={tone}
          sub={c.shield ? `shield received ${fmtShort(shieldIn)}` : `from ${fmtShort(c.burst)} viewers`} />
        <Stat label="Peak origin load" value={fmtShort(r.peakRps)} unit="req/s" tone={r.peakRps > ORIGIN_RATE ? "bad" : "neutral"}
          sub={`${fmtBps(r.peakRps * SEGMENT_BYTES * 8)} egress`} />
        <Stat label="Waiting viewers wait" value={r.waitedShare > 0 ? fmtMs(r.waitedMedian * 1000) : "none"} tone={r.waitedMedian > 1 ? "warn" : "neutral"}
          sub={`median; ${fmtPct(r.waitedShare)} of viewers waited`} />
        <Stat label="Slowest 1%" value={r.timeoutShare >= 0.01 ? `${TIMEOUT} s+` : fmtMs(r.p99 * 1000)} tone={r.p99 >= 3 ? "bad" : r.p99 >= 1 ? "warn" : "neutral"}
          sub={r.errorShare > 0 ? `${fmtPct(r.errorShare)} got an error or gave up` : "time to first byte"} />
      </StatGrid>

      <div className="rc-dist">
        <div className="rc-label">Time to first byte, all viewers</div>
        <div className="rc-bar" role="img" aria-label={BUCKETS.map((b, i) => `${b.label} ${fmtPct(r.hist[i] / total)}`).join(", ")}>
          {BUCKETS.map((b, i) => r.hist[i] > 0 && <span key={b.label} style={{ flexGrow: r.hist[i], background: b.color }} />)}
        </div>
        <div className="rc-legend">
          {BUCKETS.map((b, i) => r.hist[i] > 0 && (
            <span key={b.label}><i style={{ background: b.color }} />{b.label} <b>{fmtPct(r.hist[i] / total, r.hist[i] / total < 0.01 ? 1 : 0)}</b></span>
          ))}
        </div>
      </div>

      <p className="rc-insight">{insight(r)}</p>

      {Math.max(r.peakRps, series.length > 1 && prev ? prev.peakRps : 0) >= 200 && <div className="rc-chart">
        <div className="rc-label">Requests per second at the origin, by seconds after T0</div>
        <LineChart series={series} xMax={xMax} height={compact ? 170 : 210}
          xFmt={(v) => `${fmtNum(v, 1)}`} yFmt={(v) => fmtShort(v)} hLines={[{ y: ORIGIN_RATE, label: "origin limit 5.5k/s", tone: "warn" }]}
          yMax={Math.max(ORIGIN_RATE * 1.25, ...series.flatMap((s) => s.points.map((p) => p[1] * 1.1)))} />
      </div>}
    </div>
  );
}
