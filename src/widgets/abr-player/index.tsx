/**
 * Inside the player (Chapter 10). An adaptive bitrate (ABR) player simulation.
 *
 * Props (all optional):
 * - `onComplete?: () => void` Called once, when one run reaches the end of the 2-minute session
 *   (by playing through or by "Skip to end") on a network trace that contains at least one
 *   bandwidth drop. A drop = bandwidth later falls to 60% or less of an earlier value, and by
 *   at least 1 Mbps. The train, evening and sudden-drop presets all qualify; "Stable 8 Mbps"
 *   does not unless the reader drags the line down.
 * - `trace?: "stable" | "train" | "evening" | "drop" | number[]` Starting network. A preset key, or
 *   61 bandwidth points in Mbps (one every 2 s, 0:00 to 2:00). Default "train".
 * - `algo?: "throughput" | "bba" | "bola" | "hybrid"` Starting algorithm. Default "throughput".
 * - `compact?: boolean` Lesson mode (about 640px wide). Player settings fold into a disclosure.
 *
 * The model, ladder and algorithm rules live in model.ts; predict questions in questions.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Chip, Icon, IconButton, Segmented, Slider, Stage, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import { fmtPct } from "@/lib/format";
import type { WidgetProps } from "../types";
import {
  ALGOS, DEFAULT_PARAMS, DROP_AT, DURATION, LADDER, TRACES, TRACE_N, TUNNEL, algoLabel, hasDrop, makeSid, presetTrace, qoeAt, sampleAt, simulate,
  type AlgoKey, type Params, type QoE, type TraceKey,
} from "./model";
import { QUESTIONS } from "./questions";
import { Screen, type ScreenPhase } from "./Screen";
import { BufferChart, NetworkChart, mmss, type Player } from "./Charts";
import { Predict } from "./Predict";
import "./abr-player.css";

const COLOR_A = "var(--p4)", COLOR_B = "var(--p1)";
const isTraceKey = (v: unknown): v is TraceKey => typeof v === "string" && TRACES.some((t) => t.key === v);
const isAlgo = (v: unknown): v is AlgoKey => typeof v === "string" && ALGOS.some((a) => a.key === v);
const mbps = (kbps: number) => `${(kbps / 1000).toFixed(kbps < 1000 ? 2 : 1)} Mbps`;

export default function AbrPlayer(props: WidgetProps) {
  const compact = props.compact ?? false;
  const startTrace: TraceKey | "custom" = Array.isArray(props.trace) && props.trace.length === TRACE_N ? "custom" : isTraceKey(props.trace) ? props.trace : "train";
  const [traceKey, setTraceKey] = useState<TraceKey | "custom">(startTrace);
  const [trace, setTrace] = useState<number[]>(() => (startTrace === "custom" ? (props.trace as number[]).map(Number) : presetTrace(startTrace)));
  const [algoA, setAlgoA] = useState<AlgoKey>(isAlgo(props.algo) ? props.algo : "throughput");
  const [algoB, setAlgoB] = useState<AlgoKey>(isAlgo(props.algo) && props.algo === "bba" ? "throughput" : "bba");
  const [compare, setCompare] = useState(false);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [speed, setSpeed] = useState(6);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [touched, setTouched] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [qIndex, setQIndex] = useState(() => Math.max(0, QUESTIONS.findIndex((q) => q.trace === startTrace)));
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const sid = useMemo(() => makeSid(Math.floor(Math.random() * 2 ** 31)), []);

  const runA = useMemo(() => simulate(trace, algoA, params, sid), [trace, algoA, params, sid]);
  const runB = useMemo(() => (compare ? simulate(trace, algoB, params, sid) : null), [compare, trace, algoB, params, sid]);
  const players: Player[] = [{ run: runA, color: COLOR_A, label: algoLabel(algoA) }, ...(runB ? [{ run: runB, color: COLOR_B, label: algoLabel(algoB) }] : [])];

  /* ---- completion ---- */
  const onCompleteRef = useRef(props.onComplete); onCompleteRef.current = props.onComplete;
  const firedRef = useRef(false);
  const traceRef = useRef(trace); traceRef.current = trace;
  const finish = useCallback(() => {
    setRunning(false); setT(DURATION);
    if (hasDrop(traceRef.current)) {
      setCompleted(true);
      if (!firedRef.current) { firedRef.current = true; onCompleteRef.current?.(); }
    }
  }, []);

  useRaf((dt) => {
    setT((prev) => {
      const next = prev + dt * speed;
      if (next >= DURATION) { queueMicrotask(finish); return DURATION; }
      return next;
    });
  }, running);

  const play = () => {
    setTouched(true);
    if (running) { setRunning(false); return; }
    if (t >= DURATION) setT(0);
    setRunning(true);
  };
  const reset = () => { setRunning(false); setT(0); };
  const skip = () => { setTouched(true); finish(); };

  // keyboard: space toggles play when focus is on the stage itself
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const f = (e: KeyboardEvent) => { if (e.key === " " && e.target === el) { e.preventDefault(); play(); } };
    el.addEventListener("keydown", f); return () => el.removeEventListener("keydown", f);
  });

  const pickTrace = (k: TraceKey) => { setTraceKey(k); setTrace(presetTrace(k)); if (t >= DURATION) setT(DURATION); };
  const editTrace = (next: number[]) => { setTraceKey("custom"); setTrace(next); };
  const pickA = (k: AlgoKey) => { if (compare && k === algoB) setAlgoB(algoA); setAlgoA(k); };
  const pickB = (k: AlgoKey) => { if (k === algoA) setAlgoA(algoB); setAlgoB(k); };
  const onQuestion = (i: number) => { setQIndex(i); const q = QUESTIONS[i]; setTraceKey(q.trace); setTrace(presetTrace(q.trace)); setRunning(false); setT(0); };
  const onWatch = (k: TraceKey, pair: [AlgoKey, AlgoKey]) => {
    setTraceKey(k); setTrace(presetTrace(k)); setCompare(true); setAlgoA(pair[0]); setAlgoB(pair[1]);
    setT(0); setRunning(true); setTouched(true);
    stageRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  };

  /* ---- layout ---- */
  const wide = width >= 760;
  const stageW = Math.max(280, (wide ? width - 280 - 12 : width) - 26);
  const H = compact || stageW < 480 ? 150 : 176;
  const screenW = compare ? (stageW - 12) / 2 : stageW >= 560 ? stageW * 0.58 : stageW;
  const markers = traceKey === "train" ? [{ x: TUNNEL[0], label: "Tunnel" }] : traceKey === "drop" ? [{ x: DROP_AT, label: "Drop" }] : undefined;
  const idle = t === 0 && !running;
  const traceNote = traceKey === "custom" ? "Your own network. Drag the line again to change it." : TRACES.find((x) => x.key === traceKey)!.note;
  const dropOK = hasDrop(trace);

  const settings = (
    <>
      <Slider label="Buffer target" value={params.target} min={12} max={36} step={2} format={(v) => `${v} s`}
        onChange={(v) => setParams((p) => ({ ...p, target: v }))} hint="The player stops fetching above this. hls.js uses 30 s, Shaka 10 s." />
      <Slider label="Safety factor" value={params.safety} min={0.5} max={1} step={0.05} format={(v) => v.toFixed(2)}
        onChange={(v) => setParams((p) => ({ ...p, safety: v }))} hint="Share of the estimate the throughput rule spends. ExoPlayer: 0.70." />
    </>
  );

  const controls = (
    <>
      <Segmented label={compare ? "Player A" : "ABR algorithm"} value={algoA} options={ALGOS.map((a) => ({ value: a.key, label: a.short }))} onChange={pickA} />
      <p className="abrp-blurb">{ALGOS.find((a) => a.key === algoA)!.blurb}</p>
      <Toggle label="Compare two algorithms" checked={compare} onChange={(v) => { setCompare(v); if (v && algoB === algoA) setAlgoB(algoA === "bba" ? "throughput" : "bba"); }} hint="Same network, same settings" />
      {compare && <Segmented label="Player B" value={algoB} options={ALGOS.map((a) => ({ value: a.key, label: a.short }))} onChange={pickB} />}
      <div className="abrp-sep" />
      <Segmented label="Network" value={traceKey === "custom" ? ("" as TraceKey) : traceKey} options={TRACES.map((x) => ({ value: x.key, label: x.label.split(" ")[x.key === "stable" ? 0 : x.key === "drop" ? 1 : 0].replace(/^./, (c) => c.toUpperCase()) }))} onChange={pickTrace} />
      <p className="abrp-blurb">{traceKey === "custom" && <Chip tone="accent">Custom</Chip>} {traceNote}</p>
      <Slider label="Playback speed" value={speed} min={4} max={10} step={1} format={(v) => `${v}x`} onChange={setSpeed} />
      {compact ? <details className="abrp-more"><summary>Player settings</summary><div className="abrp-more-body">{settings}</div></details> : settings}
    </>
  );

  const stage = (
    <div ref={stageRef} tabIndex={-1} className="abrp-stagewrap">
      <Stage>
        <div className="abrp-transport">
          <Button variant="primary" size="s" onClick={play} className={!touched && !reduce ? "abrp-pulse" : ""} aria-label={running ? "Pause" : t >= DURATION ? "Replay" : "Play"}>
            <Icon name={running ? "pause" : "play"} size={16} /> {running ? "Pause" : t >= DURATION ? "Replay" : "Play"}
          </Button>
          <IconButton label="Reset to the start" onClick={reset} disabled={idle}><Icon name="reset" size={18} /></IconButton>
          <Button variant="ghost" size="s" onClick={skip} disabled={t >= DURATION}>Skip to end</Button>
          <span className="abrp-clock mono" aria-live="off">{mmss(t)} <span className="abrp-muted">/ {mmss(DURATION)}</span></span>
          {completed && <span className="abrp-donechip"><Icon name="check" size={14} stroke={2.4} /> Done</span>}
        </div>

        <div className={`abrp-screens ${compare ? "two" : "one"}`}>
          {players.map((pl, k) => <PlayerView key={k} pl={pl} t={t} running={running} idle={idle} reduce={reduce} width={screenW} onPlay={play} single={!compare} />)}
        </div>

        <div className="abrp-charthead">
          <h4>Network and bitrate</h4>
          <span className="abrp-muted">Drag the grey line to reshape the network</span>
        </div>
        <div>
          <NetworkChart trace={trace} onEdit={editTrace} players={players} t={t} H={H} markers={markers} started={!idle} />
        </div>
        <div className="abrp-charthead">
          <h4>Buffer</h4>
          <span className="abrp-muted"><i className="abrp-key red" /> rebuffering{players.some((p) => p.run.algo === "bba") && <><i className="abrp-key amber" /> BBA reservoir <i className="abrp-key blue" /> cushion</>}</span>
        </div>
        <div>
          <BufferChart players={players} t={t} H={H} target={params.target} showBBA={players.some((p) => p.run.algo === "bba")} />
        </div>
        {t >= DURATION && !dropOK && <p className="abrp-hint">This network never drops. Pick a preset with a drop, or drag part of the line down, and run again.</p>}
      </Stage>
    </div>
  );

  const footer = (
    <div className="abrp-footer">
      <Qoe players={players} t={t} />
      <Cmcd players={players} t={t} sid={sid} />
    </div>
  );

  return (
    <div ref={rootRef} className={`abrp${compact ? " compact" : ""}`} style={{ "--abrp-a": COLOR_A, "--abrp-b": COLOR_B } as CSSProperties}>
      <Predict params={params} reduce={reduce} qIndex={qIndex} onQuestion={onQuestion} onWatch={onWatch} />
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}

/* ---------------- one player: screen + live readout ---------------- */

function PlayerView(p: { pl: Player; t: number; running: boolean; idle: boolean; reduce: boolean; width: number; onPlay: () => void; single: boolean }) {
  const { run } = p.pl;
  const s = sampleAt(run, p.t);
  const phase: ScreenPhase = p.idle ? "idle" : p.t >= DURATION ? "done" : !s || !s.started ? "starting" : s.stalled ? "stalled" : "playing";
  const last = [...run.segs].reverse().find((g) => g.reqT <= p.t);
  return (
    <div className="abrp-player">
      <Screen label={p.pl.label} color={p.pl.color} sample={p.idle ? null : s} phase={phase} width={p.width} reduce={p.reduce} onPlay={p.onPlay} startingFor={p.t} />
      <dl className="abrp-readout">
        <div><dt>Buffer</dt><dd className="mono">{s && !p.idle ? `${s.buf.toFixed(1)} s` : "0.0 s"}</dd></div>
        <div><dt>Estimate</dt><dd className="mono">{last?.mtp != null ? mbps(last.mtp) : "none yet"}</dd></div>
        <div><dt>Last pick</dt><dd className="mono">{last ? `${LADDER[last.rung].kbps} kbps` : "none yet"}</dd></div>
        <p className="abrp-why-line">{last ? <>Why: {last.why}.</> : "Press play. The player fetches the manifest, then picks the first rung."}</p>
      </dl>
    </div>
  );
}

/* ---------------- QoE ---------------- */

const METRICS: { key: keyof QoE | "avg"; label: string; fmt: (q: QoE) => string; better: "low" | "high"; num: (q: QoE) => number | null }[] = [
  { key: "vst", label: "Video start", fmt: (q) => (q.vst != null ? `${q.vst.toFixed(1)} s` : "pending"), better: "low", num: (q) => q.vst },
  { key: "rebufRatio", label: "Rebuffer ratio", fmt: (q) => fmtPct(q.rebufRatio, 1), better: "low", num: (q) => q.rebufRatio },
  { key: "avg", label: "Average bitrate", fmt: (q) => (q.avgKbps != null ? mbps(q.avgKbps) : "none yet"), better: "high", num: (q) => q.avgKbps },
  { key: "switches", label: "Switches", fmt: (q) => String(q.switches), better: "low", num: (q) => q.switches },
  { key: "ebvs", label: "Exit-before-start risk", fmt: (q) => (q.ebvs != null ? fmtPct(q.ebvs, 0) : "0%"), better: "low", num: (q) => q.ebvs ?? 0 },
];

function Qoe({ players, t }: { players: Player[]; t: number }) {
  const qs = players.map((p) => qoeAt(p.run, t));
  const started = t > 0;
  if (players.length === 1) {
    const q = qs[0];
    return (
      <section className="abrp-panel" aria-label="Quality of experience">
        <h4>Quality of experience <span className="abrp-muted">live, so far</span></h4>
        <StatGrid>
          <Stat label="Video start" value={q.vst != null ? q.vst.toFixed(1) : started ? "…" : "0"} unit="s" sub="press to first frame" />
          <Stat label="Rebuffer ratio" value={fmtPct(q.rebufRatio, 1)} tone={q.rebufRatio > 0 ? "bad" : "neutral"} sub={`${q.stalls} stall${q.stalls === 1 ? "" : "s"}, ${q.stallTime.toFixed(1)} s`} />
          <Stat label="Average bitrate" value={q.avgKbps != null ? (q.avgKbps / 1000).toFixed(2) : "0"} unit="Mbps" sub="time-weighted" />
          <Stat label="Switches" value={q.switches} sub="visible quality changes" />
          <Stat label="Exit-before-start risk" value={fmtPct(q.ebvs ?? 0, 0)} tone={(q.ebvs ?? 0) > 0 ? "warn" : "neutral"} sub="+5.8% per s past 2 s" />
        </StatGrid>
      </section>
    );
  }
  return (
    <section className="abrp-panel" aria-label="Quality of experience, compared">
      <h4>Quality of experience <span className="abrp-muted">live, so far</span></h4>
      <table className="abrp-cmp">
        <thead><tr><th scope="col"><span className="abrp-sr">Metric</span></th>{players.map((p, k) => <th key={k} scope="col"><i className="abrp-dot" style={{ background: p.color }} />{p.label}</th>)}</tr></thead>
        <tbody>
          {METRICS.map((m) => {
            const vals = qs.map(m.num);
            const both = vals.every((v) => v != null) && vals[0] !== vals[1] && started;
            const bestIdx = both ? (m.better === "low" ? (vals[0]! < vals[1]! ? 0 : 1) : (vals[0]! > vals[1]! ? 0 : 1)) : -1;
            return (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                {qs.map((q, k) => <td key={k} className={`mono${k === bestIdx ? " best" : ""}`}>{m.fmt(q)}{k === bestIdx && <Icon name="check" size={13} stroke={2.4} label="better" />}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="abrp-foot">Exit-before-start risk uses the IMC 2012 finding: viewers start leaving after about 2 s, then about 5.8% more per extra second.</p>
    </section>
  );
}

/* ---------------- CMCD ---------------- */

function Cmcd({ players, t, sid }: { players: Player[]; t: number; sid: string }) {
  return (
    <section className="abrp-panel" aria-label="CMCD data on each request">
      <h4>CMCD on each segment request</h4>
      <p className="abrp-foot">The player adds these keys to every request (CTA-5004). The CDN logs them. <code>sid="{sid.slice(0, 8)}…"</code> is the same on every request in this session.</p>
      <div className={`abrp-cmcd-cols n${players.length}`}>
        {players.map((p, k) => <CmcdList key={k} pl={p} t={t} sid={sid} />)}
      </div>
      <dl className="abrp-keys">
        <div><dt>br</dt><dd>bitrate of this object, kbps</dd></div>
        <div><dt>bl</dt><dd>buffer length now, ms</dd></div>
        <div><dt>mtp</dt><dd>measured throughput, kbps</dd></div>
        <div><dt>sid</dt><dd>session ID, joins CDN logs to QoE</dd></div>
      </dl>
    </section>
  );
}

function CmcdList({ pl, t, sid }: { pl: Player; t: number; sid: string }) {
  const segs = pl.run.segs.filter((g) => g.reqT <= t).slice(-4).reverse();
  return (
    <div className="abrp-cmcd">
      {/* title only matters when two players are shown */}
      <div className="abrp-cmcd-title"><i className="abrp-dot" style={{ background: pl.color }} />{pl.label}</div>
      {segs.length === 0 && <div className="abrp-muted abrp-cmcd-empty">No segment requests yet.</div>}
      <div className="abrp-reqs">
      {segs.map((g, k) => {
        const prev = pl.run.segs[g.i - 1];
        const brCh = prev && prev.rung !== g.rung;
        return (
          <div key={g.i} className={`abrp-req${k === 0 ? " newest" : ""}`}>
            <span className="abrp-req-name">seg_{String(g.i + 1).padStart(5, "0")}.m4s</span>
            <code className="abrp-req-kv">
              <span className={brCh ? "ch" : ""}>br={LADDER[g.rung].kbps}</span>,
              <span>bl={Math.round((g.bl * 1000) / 100) * 100}</span>
              {g.mtp != null && <>,<span>mtp={Math.round(g.mtp / 100) * 100}</span></>}
              <span className="abrp-sidkv">,sid="{sid.slice(0, 8)}…"</span>
            </code>
          </div>
        );
      })}
      </div>
    </div>
  );
}

