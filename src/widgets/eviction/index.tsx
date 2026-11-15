/**
 * Widget "eviction": What to keep.
 *
 * Props
 * - onComplete?: () => void
 *     Called once, after the reader has run a race to the end of the request stream
 *     (with Race or Skip to end, in Race mode) while the one-hit-wonder share is 40% or higher.
 *     The first predict question sets 60% and runs a race, so answering it also completes the widget.
 * - policies?: PolicyId[]   ("lru" | "lfu" | "fifo" | "s3fifo")
 *     The lanes shown at start, 2 to 4 of them, in order. Unknown ids are dropped.
 *     Default: ["lru", "s3fifo"] in compact mode, all four on the full lab page.
 * - compact?: boolean       (standard WidgetProps) lesson-width layout.
 *
 * The simulation (sim.ts) is pure and seeded: a stream of 2,000 requests mixing Zipf-popular
 * catalog episodes, a simulcast premiere burst and one-hit wonders, replayed through LRU, LFU,
 * FIFO and S3-FIFO, with an optional Akamai-style admit-on-second-hit filter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Segmented, Slider, Toggle, LineChart, Callout, Chip, WidgetFrame, Stage, type Series } from "@/ui";
import { useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import { fmtNum, fmtPct } from "@/lib/format";
import type { WidgetProps } from "../types";
import { Lane } from "./Lane";
import { QUESTIONS, type Setup } from "./predict";
import {
  POLICY_IDS, POLICY_NAME, POLICY_COLOR, HOT_RANKS, kindOf, labelOf, makeStream, runOptimal, runTrace,
  type PolicyId, type Trace,
} from "./sim";
import "./eviction.css";

const N = 2000;
const CATALOG = 300;
const SPEED = 300; // requests per second while racing
const PREVIEW = 300; // request shown on first load, and the earliest start for step mode

type Mode = "race" | "step";

function initialLanes(policies: unknown, compact: boolean): PolicyId[] {
  if (Array.isArray(policies)) {
    const ok = [...new Set(policies.filter((p): p is PolicyId => POLICY_IDS.includes(p as PolicyId)))].slice(0, 4);
    if (ok.length >= 2) return ok;
  }
  return compact ? ["lru", "s3fifo"] : [...POLICY_IDS];
}

export default function Eviction(props: WidgetProps) {
  const { onComplete, compact = false } = props;
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);

  const [lanes, setLanes] = useState<PolicyId[]>(() => initialLanes(props.policies, compact));
  const [cap, setCap] = useState(24);
  const [zipf, setZipf] = useState(0.9);
  const [ohw, setOhw] = useState(0.3);
  const [simulcast, setSimulcast] = useState(true);
  const [admit, setAdmit] = useState(false);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<Mode>("race");
  // Open on a lived-in cache, so the first view already shows what each policy chose to keep.
  // "Start race" replays the stream from request 1.
  const [t, setT] = useState(PREVIEW);
  const [playing, setPlaying] = useState(false);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const tf = useRef(PREVIEW);
  const raced = useRef(false);
  const completed = useRef(false);

  /* --------------------------------------------------------- simulation */
  const stream = useMemo(() => makeStream({ seed, zipf, ohw, simulcast, n: N, catalog: CATALOG }), [seed, zipf, ohw, simulcast]);
  const traces = useMemo(() => {
    const o = {} as Record<PolicyId, Trace>;
    for (const id of POLICY_IDS) o[id] = runTrace(stream, id, cap, admit);
    return o;
  }, [stream, cap, admit]);
  const other = useMemo(() => {
    const o = {} as Record<PolicyId, number>;
    for (const id of POLICY_IDS) o[id] = runTrace(stream, id, cap, !admit, false).hitRatio;
    return o;
  }, [stream, cap, admit]);
  const opt = useMemo(() => runOptimal(stream, cap), [stream, cap]);

  /* ------------------------------------------------------------ control */
  const resetRun = useCallback(() => { tf.current = 0; setT(0); setPlaying(false); raced.current = false; }, []);
  /** Every setting change restarts the stream from request 1, so a result always matches its settings. */
  const change = <V,>(set: (v: V) => void) => (v: V) => { set(v); resetRun(); setPick(null); };

  useRaf((dt) => {
    tf.current = Math.min(N, tf.current + dt * SPEED);
    const next = Math.floor(tf.current);
    setT(next);
    if (next >= N) setPlaying(false);
  }, playing);

  const play = () => {
    if (t >= N || !raced.current) { tf.current = 0; setT(0); }
    else tf.current = t;
    setMode("race"); raced.current = true; setPlaying(true);
  };
  const skip = () => { raced.current = true; setPlaying(false); tf.current = N; setT(N); };

  // First request at which every shown cache is full: a sensible place to start stepping.
  const warm = useMemo(() => {
    for (let i = 0; i < N; i++) {
      if (lanes.every((id) => { const tr = traces[id]; for (let s = 0; s < cap; s++) if (tr.slots[i * cap + s] < 0) return false; return true; })) return i + 1;
    }
    return 1;
  }, [lanes, traces, cap]);

  const setStepMode = (m: Mode) => {
    setMode(m); setPlaying(false);
    if (m === "step") { const start = Math.min(N - 1, Math.max(t, warm, PREVIEW)); tf.current = start; setT(start); }
  };
  const stepBy = (d: number) => { setPlaying(false); setT((x) => { const v = Math.max(1, Math.min(N, x + d)); tf.current = v; return v; }); };
  const nextEviction = () => {
    setPlaying(false);
    for (let i = t; i < N; i++) {
      if (lanes.some((id) => traces[id].evicted[i] >= 0)) { tf.current = i + 1; setT(i + 1); return; }
    }
    tf.current = N; setT(N);
  };

  const toggleLane = (id: PolicyId) => {
    setLanes((cur) => {
      if (cur.includes(id)) return cur.length > 2 ? cur.filter((x) => x !== id) : cur;
      return cur.length < 4 ? POLICY_IDS.filter((x) => cur.includes(x) || x === id) : cur;
    });
  };


  /* ---------------------------------------------------------- completion */
  useEffect(() => {
    if (t >= N && raced.current && mode === "race" && ohw >= 0.4 - 1e-9 && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }, [t, mode, ohw, onComplete]);

  /* ------------------------------------------------------------ predict */
  const q = QUESTIONS[qi];
  const matches = (s: Setup) => Math.abs(s.ohw - ohw) < 1e-9 && s.admit === admit && s.simulcast === simulcast && s.lanes.length === lanes.length && s.lanes.every((id) => lanes.includes(id));
  const runQuestion = (value: string) => {
    const s = q.setup;
    setOhw(s.ohw); setAdmit(s.admit); setSimulcast(s.simulcast); setLanes(s.lanes);
    setPick(value); setMode("race");
    tf.current = 0; setT(0); raced.current = true; setPlaying(true);
  };
  const qLive = pick !== null && matches(q.setup);
  const verdict = qLive && t >= N ? q.judge({ stream, traces, other }) : null;
  const nextQuestion = () => { setPick(null); setQi((i) => (i + 1) % QUESTIONS.length); };

  /* ------------------------------------------------------------- derived */
  const done = t >= N;
  const order = [...lanes].sort((a, b) => traces[b].hitRatio - traces[a].hitRatio);
  const rankOf = (id: PolicyId) => (done && traces[id].hitRatio === traces[order[0]].hitRatio ? 0 : 1);
  const stageW = Math.max(0, width - (width >= 760 ? 294 : 0));
  const laneCols = stageW < 520 ? 1 : lanes.length === 3 && stageW >= 600 ? 3 : lanes.length === 4 && stageW >= 980 ? 4 : 2;
  const narrow = width > 0 && width < 520;

  const chartSeries: Series[] = useMemo(() => {
    const STEP = 20;
    const line = (cum: Int32Array) => {
      const p: [number, number][] = [];
      for (let i = STEP; i <= t; i += STEP) p.push([i, cum[i - 1] / i]);
      if (t > 0 && t % STEP) p.push([t, cum[t - 1] / t]);
      return p;
    };
    return [
      ...lanes.map((id) => ({ id, label: POLICY_NAME[id], color: POLICY_COLOR[id], points: line(traces[id].cum) })),
      { id: "opt", label: "Best possible (knows the future)", color: "var(--muted)", dashed: true, points: line(opt) },
    ];
  }, [lanes, traces, opt, t]);
  const yMax = useMemo(() => {
    let m = 0;
    for (let i = 99; i < N; i++) m = Math.max(m, opt[i] / (i + 1));
    return Math.min(1, Math.ceil((m + 0.04) * 5) / 5);
  }, [opt]);

  /* ---------------------------------------------------------------- tape */
  const tapeLen = Math.max(6, Math.min(24, Math.floor(((stageW || 600) - 52) / 34)));
  const tape: number[] = [];
  for (let i = Math.max(0, t - tapeLen); i < t; i++) tape.push(i);

  const stage = (
    <div className="ev-stage">
      <div className="ev-bar">
        <Segmented<Mode> value={mode} onChange={setStepMode} options={[{ value: "race", label: "Race" }, { value: "step", label: "Step" }]} />
        <div className="ev-actions">
          {mode === "race" ? (
            <>
              <Button variant="primary" size="s" onClick={playing ? () => setPlaying(false) : play}>
                {playing ? "Pause" : done ? "Race again" : t > 0 && raced.current ? "Resume" : "Start race"}
              </Button>
              <Button size="s" onClick={skip} disabled={done}>Skip to end</Button>
            </>
          ) : (
            <>
              <Button size="s" onClick={() => stepBy(-1)} disabled={t <= 1} aria-label="Previous request">Back</Button>
              <Button variant="primary" size="s" onClick={() => stepBy(1)} disabled={done}>Next request</Button>
              <Button size="s" onClick={nextEviction} disabled={done}>Next eviction</Button>
            </>
          )}
          <Button variant="ghost" size="s" onClick={resetRun} disabled={t === 0}>Reset</Button>
        </div>
      </div>

      <div className="ev-tape-wrap">
        <div className="ev-tape-head">
          <span>Incoming requests</span>
          <span className="ev-num">{fmtNum(t)} / {fmtNum(N)}</span>
        </div>
        <div className="ev-tape" aria-label="Most recent requests, newest on the right">
          {tape.length === 0 && <span className="ev-tape-empty">{mode === "race" ? "Press Race to send the stream." : "Press Next request."}</span>}
          {tape.map((i) => {
            const k = stream.keys[i];
            return <span key={i} className={`ev-req ev-k-${kindOf(k)}${i === t - 1 ? " is-now" : ""}`}>{labelOf(k)}</span>;
          })}
        </div>
        <div className="ev-timeline" aria-hidden="true">
          {stream.burst && <div className="ev-timeline-burst" style={{ left: `${(stream.burst[0] / N) * 100}%`, width: `${((stream.burst[1] - stream.burst[0]) / N) * 100}%` }} />}
          <div className="ev-timeline-fill" style={{ width: `${(t / N) * 100}%` }} />
        </div>
        {stream.burst && <div className="ev-timeline-label" style={{ left: `${(stream.burst[0] / N) * 100}%` }}>Simulcast premiere</div>}
      </div>

      <div className="ev-lanes" style={{ gridTemplateColumns: `repeat(${laneCols}, minmax(0, 1fr))` }}>
        {lanes.map((id) => (
          <Lane key={id} trace={traces[id]} t={t} step={mode === "step"} reduced={reduced} other={other[id]}
            rank={rankOf(id)} done={done} fast={playing} reqKey={t > 0 ? stream.keys[t - 1] : -1} />
        ))}
      </div>

      <div className="ev-legend" aria-label="Tile colors">
        <span><i className="ev-k-hot" />Popular (top {HOT_RANKS})</span>
        <span><i className="ev-k-tail" />Catalog tail</span>
        <span><i className="ev-k-sim" />Simulcast</span>
        <span><i className="ev-k-ohw" />One-hit wonder</span>
        {lanes.includes("s3fifo") && <span><i className="ev-k-tail q-small" />S3-FIFO small queue (dashed)</span>}
      </div>

      <div className="ev-chart">
        <div className="ev-chart-title">Hit ratio so far</div>
        <LineChart series={chartSeries} xMax={N} yMax={yMax} height={compact ? 190 : 230}
          yFmt={(v) => fmtPct(v)} xFmt={(v) => (narrow ? (v % 1000 ? "" : v ? `${v / 1000}k` : "0") : fmtNum(v))}
          markers={stream.burst ? [{ x: stream.burst[0], label: "premiere" }, { x: stream.burst[1], label: "burst ends" }] : undefined} />
      </div>
    </div>
  );

  const controls = (
    <div className="ev-controls">
      <div className="ev-ctl-group ev-ctl-wide" role="group" aria-label="Policies to race">
        <div className="ev-ctl-label">Policies <small>pick 2 to 4</small></div>
        <div className="ev-pols">
          {POLICY_IDS.map((id) => {
            const on = lanes.includes(id);
            return (
              <button key={id} type="button" className={`ev-pol${on ? " on" : ""}`} aria-pressed={on} style={{ ["--lane" as string]: POLICY_COLOR[id] }}
                onClick={() => { toggleLane(id); setPick(null); }} disabled={on ? lanes.length <= 2 : lanes.length >= 4}>
                <i aria-hidden="true" />{POLICY_NAME[id]}
              </button>
            );
          })}
        </div>
      </div>
      <Slider label="Cache size" value={cap} min={8} max={64} step={4} onChange={change(setCap)} format={(v) => `${v} slots`} />
      <Slider label="Popularity skew (Zipf)" value={zipf} min={0.5} max={1.3} step={0.1} onChange={change(setZipf)} format={(v) => v.toFixed(1)}
        hint="Higher means a few episodes get most requests." />
      <Slider label="One-hit wonders" value={Math.round(ohw * 100)} min={0} max={80} step={5} onChange={(v) => change(setOhw)(v / 100)} format={(v) => `${v}%`}
        hint={`Old episodes asked for once. Always a miss, so no policy can beat ${fmtPct(1 - ohw)}.`} />
      <div className="ev-toggles">
        <Toggle label="Simulcast burst" checked={simulcast} onChange={change(setSimulcast)} hint="A new episode premieres mid-stream." />
        <Toggle label="Admit on second hit" checked={admit} onChange={change(setAdmit)} hint="Store an object only when it is asked for again soon." />
      </div>
      <div className="ev-ctl-wide ev-ctl-end"><Button size="s" variant="ghost" onClick={() => change(setSeed)(seed + 1)}>New random stream</Button></div>
    </div>
  );

  const footer = (
    <div className="ev-predict" aria-live="polite">
      <div className="ev-predict-head">
        <span className="ev-predict-tag">Predict</span>
        <span className="ev-num">{qi + 1} of {QUESTIONS.length}</span>
      </div>
      <p className="ev-predict-q">{q.prompt}</p>
      <div className="ev-predict-opts">
        {q.options.map((o) => {
          const state = verdict ? (verdict.correct.includes(o.value) ? " is-right" : o.value === pick ? " is-wrong" : "") : o.value === pick && qLive ? " is-picked" : "";
          return (
            <button key={o.value} type="button" className={`ev-opt${state}`} onClick={() => runQuestion(o.value)} disabled={qLive && !done}
              aria-pressed={o.value === pick && qLive}>{o.label}</button>
          );
        })}
      </div>
      {qLive && !verdict && <p className="ev-predict-wait">Racing on the same stream. The answer comes from this simulation when it ends.</p>}
      {verdict && (
        <div className="ev-verdict">
          <div className="ev-verdict-top">
            {verdict.correct.includes(pick ?? "") ? <Chip tone="good">You called it</Chip> : <Chip tone="warn">Not this time</Chip>}
            <Button size="s" variant="secondary" onClick={nextQuestion}>Next question</Button>
          </div>
          <p><b>{verdict.headline}</b></p>
          <p>{verdict.body}</p>
          {q.id === "admit" && (
            <Callout type="industry">Akamai stores an object only on its second request, tracked with rotating Bloom filters. In production, byte hit rate rose from about 74% to 83%, and disk writes fell 44% (Chapter 5, source 4). Here every object is the same size, so the request hit ratio above equals the byte hit ratio.</Callout>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className={`ev-root${compact ? " is-compact" : ""}`}>
      <WidgetFrame stage={<Stage>{stage}</Stage>} controls={controls} footer={footer} />
    </div>
  );
}
