/**
 * Widget: "Latency, loss and throughput" (Chapter 2).
 *
 * Props (WidgetProps):
 * - onComplete?: () => void
 *     Called ONCE, after the reader has seen the verdict "Will rebuffer" AND the verdict "Smooth"
 *     (in either order; the default path starts "Smooth", so the reader must find a path that rebuffers).
 * - preset?: string
 *     Optional starting preset. Accepts an id or a label (case-insensitive):
 *     "near-pop" | "sao-paulo" | "lossy-mobile" | "bbr-vs-cubic"
 *     ("Viewer near PoP", "Sao Paulo from Virginia", "Lossy mobile", "BBR vs CUBIC").
 * - compact?: boolean   (from the player) false = full lab page, which adds the formula explainer.
 *
 * Model (book Chapter 2): MSS 1,460 B; Mathis throughput = MSS/RTT x 1.22/sqrt(p), capped by the link;
 * BDP = bandwidth x RTT; slow start from 10 packets doubling per RTT; handshake setup RTTs
 * 3 (TCP+TLS 1.2), 2 (TCP+TLS 1.3), 1 (QUIC), 0 (0-RTT), plus 1 RTT for the request.
 * BBR is shown qualitatively only: the book gives no formula for it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WidgetProps } from "../types";
import { WidgetFrame, Slider, Stat, StatGrid, LineChart, Segmented, Toggle, Button } from "@/ui";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { clamp, fmtMs } from "@/lib/format";
import {
  compute, DEFAULT_STATE, PRESETS, findPreset, HANDSHAKES, firstByteMs, mathisMbps, verdictTone, verdictFor,
  lossFromSlider, sliderFromLoss, fmtLoss, oneIn, fmtMbps, fmtSec, fmtKB, MSS_BYTES, IW_BYTES,
  type PathState, type Verdict, type Result,
} from "./model";
import { Pipe } from "./Pipe";
import "./tcp.css";

type View = "segment" | "startup" | "curve";

export default function TcpThroughput(props: WidgetProps) {
  const { onComplete } = props;
  const full = props.compact === false;
  const initialPreset = findPreset(typeof props.preset === "string" ? props.preset : undefined);

  const [s, setS] = useState<PathState>(() => ({ ...DEFAULT_STATE, ...(initialPreset?.state ?? {}) }));
  const [presetId, setPresetId] = useState<string | null>(initialPreset?.id ?? null);
  const [view, setView] = useState<View>("segment");
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null); // the pipe wrapper (no padding), so SVG text stays at real size
  const stageW = useWidth(stageRef);
  const narrow = stageW > 0 && stageW < 520;

  const r = useMemo(() => compute(s), [s]);

  const set = useCallback((patch: Partial<PathState>) => { setS((p) => ({ ...p, ...patch })); setPresetId(null); }, []);
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id); if (!p) return;
    setS({ ...DEFAULT_STATE, ...p.state }); setPresetId(id);
  };

  // ---- completion: seen both "Will rebuffer" and "Smooth" ----
  const seen = useRef(new Set<Verdict>());
  const done = useRef(false);
  useEffect(() => {
    seen.current.add(r.verdict);
    if (!done.current && seen.current.has("Smooth") && seen.current.has("Will rebuffer")) {
      done.current = true;
      onComplete?.();
    }
  }, [r.verdict, onComplete]);

  const preset = presetId ? PRESETS.find((p) => p.id === presetId) : undefined;
  const tone = verdictTone(r.verdict);

  const stage = (
    <div className="tcpw-stage">
      <div className="tcpw-head">
        <div className="tcpw-head-text">
          <div className="tcpw-eyebrow">One {s.seg} s segment at {fmtMbps(s.bitrate)}</div>
          <div className="tcpw-headline">{headline(r, s)}</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={r.verdict} className={`tcpw-verdict tone-${tone}`} role="status" aria-live="polite"
            initial={reduced ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96 }} transition={{ duration: reduced ? 0 : 0.18 }}>
            <i aria-hidden="true" />{r.verdict}
          </motion.span>
        </AnimatePresence>
      </div>

      <div ref={stageRef} className="tcpw-pipe-wrap">
        {stageW > 0 && <Pipe width={stageW} rtt={s.rtt} bw={s.bw} throughput={r.throughput} loss={s.loss} cc={s.cc} reduced={reduced} />}
      </div>
      <div className="tcpw-caption">
        Length = round-trip time. Thickness = bandwidth.
        {s.loss > 0 && (reduced ? " Red packets are lost." : " Red packets are lost; drops are shown more often than real so you can see them.")}
        {s.cc === "cubic" && s.loss > 0 && !reduced && " Watch the flow thin out after each drop: CUBIC cuts its window."}
      </div>

      <Segmented<View> label="Look at" value={view} onChange={setView}
        options={[{ value: "segment", label: "Download vs play" }, { value: "startup", label: "Startup" }, { value: "curve", label: "RTT curve" }]} />

      <div className="tcpw-view">
        {view === "segment" && <SegmentView s={s} r={r} />}
        {view === "startup" && <StartupView s={s} r={r} width={stageW} />}
        {view === "curve" && <CurveView s={s} r={r} narrow={narrow} />}
      </div>

      <StatGrid>
        <Stat label="Throughput" value={numPart(r.throughput)} unit="Mbps" tone={tone}
          sub={s.cc === "bbr" && r.limitedBy === "loss" ? "CUBIC model; BBR likely higher" : r.limitedBy === "loss" ? "Limited by loss" : "Limited by the link"} />
        <Stat label="Bandwidth-delay product" value={fmtKB(r.bdp)} sub={`${Math.round(r.bdpPackets).toLocaleString("en-US")} packets in flight`} />
        <Stat label="Segment download" value={fmtSec(r.download)} tone={tone} sub={`${Math.round(r.ratio * 100)}% of ${s.seg} s play time`} />
        <Stat label="First byte, TLS 1.3" value={fmtMs(firstByteMs(2, s.rtt))} sub={`QUIC: ${fmtMs(firstByteMs(1, s.rtt))}`} />
      </StatGrid>

      {(preset || s.cc === "bbr") && (
        <div className="tcpw-notes">
          {preset && <p className="tcpw-note"><b>{preset.label}.</b> {preset.note}</p>}
          {s.cc === "bbr" && <BbrNote r={r} s={s} />}
        </div>
      )}
    </div>
  );

  const segBytes = r.segBytes;
  const controls = (
    <div className="tcpw-controls">
      <div className="tcpw-group">Network path</div>
      <Slider label="Round-trip time (RTT)" value={s.rtt} min={5} max={300} step={1} onChange={(v) => set({ rtt: v })}
        format={(v) => `${v} ms`} hint={`About ${(s.rtt * 100).toLocaleString("en-US")} km of fiber (1 ms per 100 km)`} />
      <Slider label="Packet loss" value={sliderFromLoss(s.loss)} min={0} max={100} step={1} onChange={(v) => set({ loss: lossFromSlider(v) })}
        format={() => fmtLoss(s.loss)} hint={`${oneIn(s.loss)}. Log scale.`} />
      <Slider label="Last-mile bandwidth" value={s.bw} min={1} max={100} step={1} onChange={(v) => set({ bw: v })} format={(v) => `${v} Mbps`} />
      <div className="tcpw-group">Video</div>
      <Slider label="Rendition bitrate" value={s.bitrate} min={1} max={15} step={0.5} onChange={(v) => set({ bitrate: v })}
        format={(v) => `${v} Mbps`} hint={`Segment is ${fmtKB(segBytes)}, about ${Math.round(segBytes / MSS_BYTES).toLocaleString("en-US")} packets`} />
      <Slider label="Segment length" value={s.seg} min={2} max={6} step={1} onChange={(v) => set({ seg: v })} format={(v) => `${v} s`} />
      <div className="tcpw-group">Sender (the CDN edge)</div>
      <Segmented<PathState["cc"]> label="Congestion control" value={s.cc} onChange={(v) => set({ cc: v })}
        options={[{ value: "cubic", label: "CUBIC" }, { value: "bbr", label: "BBR" }]} />
      <Toggle label="Slow start after idle" hint="Each segment restarts from 10 packets" checked={s.idle} onChange={(v) => set({ idle: v })} />
    </div>
  );

  return (
    <div className={`tcpw ${full ? "is-full" : "is-compact"}`}>
      <div className="tcpw-presets" role="group" aria-label="Presets">
        <span className="tcpw-presets-label">Try a path</span>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`tcpw-preset${presetId === p.id ? " on" : ""}`} aria-pressed={presetId === p.id} onClick={() => applyPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <WidgetFrame stage={stage} controls={controls}
        footer={
          <div className="tcpw-footer">
            <Predict s={s} apply={(patch, v) => { setS((p) => ({ ...p, ...patch })); setPresetId(null); if (v) setView(v); }} reduced={reduced} />
            {full && <Formulas s={s} r={r} />}
          </div>
        } />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const numPart = (mbps: number) => (mbps >= 100 ? String(Math.round(mbps)) : mbps >= 10 ? mbps.toFixed(1).replace(/\.0$/, "") : mbps.toFixed(mbps < 1 ? 2 : 1));

function headline(r: Result, s: PathState): string {
  if (r.bbrSplit) return `CUBIC needs ${fmtSec(r.download)} per ${s.seg} s segment. BBR's best case is ${fmtSec(r.bestDownload)}.`;
  const verb = r.ratio >= 1 ? "slower than real time" : "faster than real time";
  return `Downloads in ${fmtSec(r.download)}, plays for ${s.seg} s: ${verb}.`;
}

function SegmentView({ s, r }: { s: PathState; r: Result }) {
  const cap = s.seg * 3;
  const scale = Math.max(s.seg, Math.min(r.download, cap)) * 1.04;
  const pct = (t: number) => `${(clamp(t, 0, cap) / scale) * 100}%`;
  const delta = s.seg - r.download;
  const tone = verdictTone(verdictFor(r.ratio));
  const rows: { label: string; t: number; cls: string; over?: boolean }[] = [
    { label: "Plays for", t: s.seg, cls: "play" },
    { label: s.cc === "bbr" ? "Download (CUBIC)" : "Downloads in", t: r.download, cls: `dl tone-${tone}`, over: r.download > cap },
  ];
  if (s.cc === "bbr") rows.push({ label: "BBR best case", t: r.bestDownload, cls: "dl best" });
  return (
    <div className="tcpw-bars" aria-label="Segment download time compared with play time">
      {rows.map((row) => (
        <div key={row.label} className="tcpw-bar-row">
          <span className="tcpw-bar-label">{row.label}</span>
          <div className="tcpw-bar-track">
            <div className={`tcpw-bar-fill ${row.cls}`} style={{ width: pct(row.t) }} />
            <div className="tcpw-bar-mark" style={{ left: pct(s.seg) }} aria-hidden="true" />
          </div>
          <span className="tcpw-bar-val">{fmtSec(row.t)}{row.over ? "+" : ""}</span>
        </div>
      ))}
      <p className={`tcpw-explain tone-${tone}`}>
        {delta >= 0
          ? <>Each segment adds <b>{fmtSec(delta)}</b> to the buffer. {r.ratio >= 0.7 ? "The margin is thin: one timeout or slow start on this path can eat it." : "Plenty of margin."}</>
          : <>Each segment costs <b>{fmtSec(-delta)}</b> of buffer. The buffer drains, and playback stalls unless the player drops to a lower rendition.</>}
      </p>
    </div>
  );
}

function StartupView({ s, r, width }: { s: PathState; r: Result; width: number }) {
  const maxMs = firstByteMs(3, s.rtt);
  const ss = r.cold;
  const W = Math.max(280, width - 2);
  const H = 104, base = 82, top = 16;
  const n = ss.rounds.length;
  const gap = 4;
  const bw = clamp((W - 8) / Math.max(n, 1) - gap, 6, 34);
  const maxW = Math.max(...ss.rounds.map((x) => x.w), 1);
  const hOf = (w: number) => Math.max(3, ((base - top) * w) / maxW);
  const growN = ss.rounds.filter((x) => !x.capped).length;
  const lastGrow = ss.rounds[growN - 1];
  return (
    <div className="tcpw-startup">
      <div className="tcpw-sub-title">Before the first byte (new connection)</div>
      <div className="tcpw-bars">
        {HANDSHAKES.map((h) => {
          const ms = firstByteMs(h.setup, s.rtt);
          return (
            <div key={h.id} className="tcpw-bar-row">
              <span className="tcpw-bar-label">{h.label}</span>
              <div className="tcpw-bar-track"><div className={`tcpw-bar-fill hs hs-${h.setup}`} style={{ width: `${(ms / maxMs) * 100}%` }} /></div>
              <span className="tcpw-bar-val">{fmtMs(ms)}</span>
            </div>
          );
        })}
      </div>
      <p className="tcpw-explain">Setup round trips, then 1 more for the request: TLS 1.2 needs 3 + 1, TLS 1.3 needs 2 + 1, QUIC 1 + 1, and 0-RTT sends the request at once.</p>

      <div className="tcpw-sub-title">Slow start: window per round trip</div>
      <svg className="tcpw-ss" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Slow start: the window starts at 10 packets and doubles each round trip; ${ss.growRounds.toFixed(1)} round trips of growth for this segment.`}>
        <line x1={0} x2={W} y1={base} y2={base} className="tcpw-ss-axis" />
        {ss.rounds.map((x, i) => {
          const h = hOf(x.w);
          const xx = 4 + i * (bw + gap);
          return <rect key={i} x={xx} y={base - h} width={bw} height={h} rx={3} className={x.capped ? "tcpw-ss-bar capped" : "tcpw-ss-bar"} />;
        })}
        <text x={4} y={base + 16} className="tcpw-svg-sub">10 packets</text>
        {lastGrow && growN > 1 && (
          <text x={Math.min(W - 4, 4 + (growN - 1) * (bw + gap) + bw)} y={Math.max(12, base - hOf(lastGrow.w) - 5)} textAnchor="end" className="tcpw-svg-sub">
            {Math.round(lastGrow.w / MSS_BYTES).toLocaleString("en-US")} packets
          </text>
        )}
        {growN < n && (
          <text x={W - 2} y={base + 16} textAnchor="end" className="tcpw-svg-sub">
            pale: path full at {Math.max(1, Math.round(ss.targetW / MSS_BYTES)).toLocaleString("en-US")} packets
          </text>
        )}
      </svg>
      <p className="tcpw-explain">
        The window starts at 10 packets ({fmtKB(IW_BYTES)}) and doubles every round trip. This {fmtKB(r.segBytes)} segment needs
        about <b>{ss.growRounds.toFixed(1)} round trips</b> of growth. On a new TCP + TLS 1.3 connection the first segment takes
        about <b>{fmtSec(r.coldTotal)}</b>, against {fmtSec(r.download)} on a warm connection. That is why players reuse connections.
      </p>
    </div>
  );
}

function CurveView({ s, r, narrow }: { s: PathState; r: Result; narrow: boolean }) {
  const pts = (p: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let x = 5; x <= 300; x += 5) out.push([x, Math.min(s.bw, mathisMbps(x, p))]);
    return out;
  };
  const top = Math.max(s.bw, s.bitrate) * 1.08;
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((x) => x * 4 >= top) ?? 50;
  const yMax = step * 4;
  if (narrow) {
    const rows = [10, 40, 80, 150, 300];
    return (
      <div className="tcpw-mini">
        <div className="tcpw-sub-title">Throughput at {fmtLoss(s.loss)} loss</div>
        <table>
          <thead><tr><th>RTT</th><th>Throughput</th><th>vs {fmtMbps(s.bitrate)}</th></tr></thead>
          <tbody>
            {rows.map((x) => {
              const t = Math.min(s.bw, mathisMbps(x, s.loss));
              return <tr key={x} className={Math.abs(x - s.rtt) < 1 ? "on" : ""}><td>{x} ms</td><td>{fmtMbps(t)}</td><td className={t >= s.bitrate ? "ok" : "no"}>{t >= s.bitrate ? "enough" : "too slow"}</td></tr>;
            })}
          </tbody>
        </table>
        <p className="tcpw-explain">Your path: {s.rtt} ms gives {fmtMbps(r.throughput)}.</p>
      </div>
    );
  }
  const series = [
    { id: "now", label: `Loss-based TCP at ${fmtLoss(s.loss)} loss`, color: "var(--p2)", points: pts(s.loss), area: true },
  ];
  if (s.loss > 0 && s.loss * 4 <= 0.05) series.push({ id: "x4", label: `At ${fmtLoss(s.loss * 4)} loss (x4)`, color: "var(--muted)", points: pts(s.loss * 4), area: false });
  return (
    <div>
      <LineChart series={series.map((x) => (x.id === "x4" ? { ...x, dashed: true } : x))} xMin={0} xMax={300} yMax={yMax} height={230}
        yLabel="Mbps" xFmt={(v) => `${Math.round(v)} ms`} yFmt={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
        hLines={[{ y: s.bitrate, label: `Rendition ${fmtMbps(s.bitrate)}`, tone: "warn" }, { y: s.bw, label: `Link ${fmtMbps(s.bw)}`, tone: "neutral" }]}
        markers={[{ x: s.rtt, label: `you: ${fmtMbps(r.throughput)}` }]} />
      <p className="tcpw-explain">Below the orange line, the stream cannot keep up. Throughput falls as 1/RTT: double the distance, half the speed.</p>
    </div>
  );
}

function BbrNote({ r, s }: { r: Result; s: PathState }) {
  return (
    <p className="tcpw-note bbr">
      <b>BBR, qualitatively.</b> CUBIC treats every loss as congestion and cuts its window. BBR measures the bottleneck rate and the
      minimum RTT and paces at that rate, so it mostly ignores isolated, random loss. On this path it is likely somewhere between the
      CUBIC number ({fmtMbps(r.mathis < s.bw ? r.mathis : s.bw)}) and the link ({fmtMbps(s.bw)}); the book gives no formula for where.
      Google reported about 4% higher median throughput and about 11% longer time between rebuffers on YouTube with BBR. It is not
      magic: traffic policers and heavy loss still hurt it.
    </p>
  );
}

/* ------------------------------ Predict ------------------------------ */

interface Question {
  id: string;
  prompt: (s: PathState) => string;
  options: string[];
  correct: number;
  explain: (s: PathState) => string;
  apply: (s: PathState) => Partial<PathState>;
  view?: View;
}

const halfRtt = (s: PathState) => Math.max(5, Math.round(s.rtt / 2));
const qLossBase = (s: PathState) => clamp(s.loss > 0 ? s.loss : 0.001, 0.0005, 0.0125);
const SAO = PRESETS.find((p) => p.id === "sao-paulo")!.state;

const QUESTIONS: Question[] = [
  {
    id: "half-rtt",
    prompt: (s) => `Halve the RTT, from ${s.rtt} ms to ${halfRtt(s)} ms. Does throughput double?`,
    options: ["Yes, always", "Only when loss is the limit", "No, RTT does not change throughput"],
    correct: 1,
    explain: (s) => {
      const a = compute(s), b = compute({ ...s, rtt: halfRtt(s) });
      const capped = b.limitedBy === "link";
      return `Mathis throughput is proportional to 1/RTT, so the loss ceiling doubles. Here: ${fmtMbps(a.throughput)} becomes ${fmtMbps(b.throughput)}${capped ? `, because the ${fmtMbps(s.bw)} link stops it from going higher` : ""}.`;
    },
    apply: (s) => ({ rtt: halfRtt(s) }),
  },
  {
    id: "loss-x4",
    prompt: (s) => `Loss goes up 4 times, from ${fmtLoss(qLossBase(s))} to ${fmtLoss(qLossBase(s) * 4)}. Loss-limited throughput falls to about...`,
    options: ["A quarter", "A half", "Almost the same"],
    correct: 1,
    explain: (s) => {
      const p = qLossBase(s);
      const a = mathisMbps(s.rtt, p), b = mathisMbps(s.rtt, p * 4);
      return `Throughput falls with the square root of loss. The square root of 4 is 2, so the ceiling halves: ${fmtMbps(a)} to ${fmtMbps(b)} at ${s.rtt} ms.`;
    },
    apply: (s) => ({ loss: qLossBase(s) * 4 }),
  },
  {
    id: "more-bw",
    prompt: () => "The Sao Paulo viewer upgrades from 50 to 100 Mbps. Does the stall go away?",
    options: ["Yes, twice the bandwidth fixes it", "No: RTT and loss are the limit, not the link", "Only with a new router"],
    correct: 1,
    explain: () => {
      const a = compute({ ...DEFAULT_STATE, ...SAO }), b = compute({ ...DEFAULT_STATE, ...SAO, bw: 100 });
      return `The Mathis ceiling has no bandwidth term. At 120 ms and 0.1% loss it is ${fmtMbps(a.throughput)} on 50 Mbps and still ${fmtMbps(b.throughput)} on 100 Mbps. The fix is a closer edge (lower RTT), not a faster plan.`;
    },
    apply: () => ({ ...SAO, bw: 100 }),
  },
  {
    id: "quic",
    prompt: () => "At 150 ms RTT, how much sooner does QUIC deliver the first byte than TCP + TLS 1.2?",
    options: ["About 150 ms", "About 300 ms", "No difference: same distance"],
    correct: 1,
    explain: () => `TCP + TLS 1.2 needs 3 setup round trips, QUIC needs 1. Two fewer round trips at 150 ms is 300 ms: first byte at ${fmtMs(firstByteMs(3, 150))} against ${fmtMs(firstByteMs(1, 150))}.`,
    apply: () => ({ rtt: 150 }),
    view: "startup",
  },
];

function Predict({ s, apply, reduced }: { s: PathState; apply: (p: Partial<PathState>, v?: View) => void; reduced: boolean }) {
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [snap, setSnap] = useState<PathState | null>(null);
  const q = QUESTIONS[qi];
  const ctx = snap ?? s;
  const answered = pick !== null;
  const right = answered && pick === q.correct;
  const next = () => { setQi((i) => (i + 1) % QUESTIONS.length); setPick(null); setSnap(null); };
  return (
    <section className="tcpw-q" aria-label="Predict">
      <div className="tcpw-q-top"><span className="tcpw-q-tag">Predict</span><span className="tcpw-q-count">{qi + 1} of {QUESTIONS.length}</span></div>
      <p className="tcpw-q-prompt">{q.prompt(ctx)}</p>
      <div className="tcpw-q-opts">
        {q.options.map((o, i) => {
          const cls = !answered ? "" : i === q.correct ? " right" : i === pick ? " wrong" : " dim";
          return (
            <button key={o} type="button" className={`tcpw-opt${cls}`} disabled={answered} aria-pressed={pick === i}
              onClick={() => { setSnap(s); setPick(i); }}>{o}</button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {answered && (
          <motion.div key={q.id} className={`tcpw-q-reveal ${right ? "tone-good" : "tone-bad"}`}
            initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}>
            <p><b>{right ? "Right." : "Not quite."}</b> {q.explain(ctx)}</p>
            <div className="tcpw-q-actions">
              <Button size="s" variant="primary" onClick={() => apply(q.apply(ctx), q.view)}>Show me</Button>
              <Button size="s" variant="ghost" onClick={next}>{qi + 1 < QUESTIONS.length ? "Next question" : "Start over"}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------ Formulas (full mode) ------------------------------ */

function Formulas({ s, r }: { s: PathState; r: Result }) {
  const rttS = (s.rtt / 1000).toFixed(3);
  const sq = s.loss > 0 ? Math.sqrt(s.loss).toFixed(4) : "0";
  const segMbit = s.bitrate * s.seg;
  return (
    <section className="tcpw-formulas" aria-label="How the numbers are computed">
      <div className="tcpw-q-top"><span className="tcpw-q-tag f">The math</span></div>
      <div className="tcpw-f">
        <div className="tcpw-f-name">Bandwidth-delay product</div>
        <code>BDP = bandwidth x RTT = {s.bw} Mbps x {rttS} s = {fmtKB(r.bdp)}</code>
        <p>The data that must be in flight to keep the path full: about {Math.round(r.bdpPackets).toLocaleString("en-US")} packets of 1,460 bytes.</p>
      </div>
      <div className="tcpw-f">
        <div className="tcpw-f-name">Loss ceiling (Mathis, 1997)</div>
        <code>(MSS / RTT) x 1.22 / sqrt(p) = (11,680 bits / {rttS} s) x 1.22 / {sq} = {fmtMbps(r.mathis)}</code>
        <p>Then capped by the {fmtMbps(s.bw)} link: <b>{fmtMbps(r.throughput)}</b>. A model of Reno-style TCP with random loss; CUBIC and BBR do better, but the direction holds.</p>
      </div>
      <div className="tcpw-f">
        <div className="tcpw-f-name">One segment</div>
        <code>{s.bitrate} Mbps x {s.seg} s = {segMbit.toFixed(1).replace(/\.0$/, "")} Mbit = {fmtKB(r.segBytes)}</code>
        <code>{s.idle ? `slow start from 10 packets = ${fmtSec(r.download)}` : `1 RTT + size / throughput = ${rttS} + ${segMbit.toFixed(1)} / ${numPart(r.throughput)} = ${fmtSec(r.download)}`}</code>
        <p>{Math.round(r.ratio * 100)}% of the play time. Under 70% is smooth, 70 to 100% is tight, over 100% drains the buffer.</p>
      </div>
      <div className="tcpw-f">
        <div className="tcpw-f-name">Slow start</div>
        <code>14.6 KB x (2^n - 1) = {fmtKB(r.segBytes)}  →  n ≈ {Math.log2(r.segBytes / IW_BYTES + 1).toFixed(1)} round trips</code>
        <p>
          Initial window of 10 packets (RFC 6928), doubling each RTT.{" "}
          {r.cold.rounds.some((x) => x.capped)
            ? `Here the path fills first, at about ${Math.max(1, Math.round(r.cold.targetW / MSS_BYTES))} packets per round trip, after ${r.cold.growRounds.toFixed(1)} round trips; the rest flows at ${fmtMbps(r.throughput)}.`
            : "The path never fills before the segment ends, so slow start sets the time."}
        </p>
      </div>
      <div className="tcpw-f">
        <div className="tcpw-f-name">First byte</div>
        <code>(setup RTTs + 1) x {s.rtt} ms: {HANDSHAKES.map((h) => `${h.setup + 1} RTT`).join(", ")}</code>
      </div>
    </section>
  );
}
