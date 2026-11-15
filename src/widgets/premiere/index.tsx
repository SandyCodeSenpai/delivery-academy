/**
 * Simulcast premiere (chapter 13).
 *
 * Props
 * - `onComplete?: () => void`  Called once, when the reader has run BOTH presets ("Naive launch" and
 *   "Playbook launch") to the end, OR has finished a custom run whose error rate never went above 0.5%.
 *   A run counts as finished when the clock reaches T+30:00 (or the reader presses "Skip to end").
 * - `preset?: "naive" | "playbook"`  Which launch plan is loaded first. Default "naive".
 * - `compact?: boolean`  Lesson mode (~640px): controls fold into a "Tune the launch" panel.
 *
 * The model (sim.ts) is deterministic: one sample per second from T-30 min to T+30 min.
 * All capacities are ASSUMED; book-cited numbers are labelled in the text.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WidgetProps } from "../types";
import type { Tone } from "@/content/types";
import { Button, Chip, LineChart, Segmented, Slider, Toggle, WidgetFrame, type Series } from "@/ui";
import { fmtBps, fmtNum, fmtPct } from "@/lib/format";
import { useRaf, useReducedMotion } from "@/lib/hooks";
import {
  AUTH_CAP, LIC_CAP, ORIGIN_CAP, PRESETS, QUOTA_GBPS, QUOTA_RPS, SPLITS, T_END, T_START,
  presetOf, simulate, speedAt, type Cfg, type PresetId, type Sample,
} from "./sim";
import { buildBeats, fmtClock, fmtK, phaseOf, predictFor } from "./story";
import "./premiere.css";

type Run = "idle" | "running" | "paused" | "done";
type Tab = "viewers" | "egress" | "origin" | "control" | "errors";
type Zoom = "hour" | "t0";

interface Props extends WidgetProps { preset?: PresetId }

const LAST = T_END - 1;

export default function Premiere({ onComplete, compact: compactProp, preset }: Props) {
  const compact = compactProp !== false;
  const reduced = useReducedMotion();
  const [cfg, setCfg] = useState<Cfg>(PRESETS[preset === "playbook" ? "playbook" : "naive"]);
  const [run, setRun] = useState<Run>("idle");
  const [t, setT] = useState(T_START);
  const [tab, setTab] = useState<Tab>("viewers");
  const [zoom, setZoom] = useState<Zoom>("hour");
  const [guess, setGuess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ran = useRef(new Set<string>());
  const fired = useRef(false);

  const kind: PresetId | "custom" = presetOf(cfg) ?? "custom";
  const { samples, sum } = useMemo(() => simulate(cfg), [cfg]);
  const beats = useMemo(() => buildBeats(cfg, sum, samples), [cfg, sum, samples]);
  const predict = useMemo(() => predictFor(kind, cfg, sum), [kind, cfg, sum]);

  const reset = () => { setRun("idle"); setT(T_START); };
  const change = (next: Cfg) => { setCfg(next); setGuess(null); reset(); };
  const set = <K extends keyof Cfg>(k: K) => (v: Cfg[K]) => change({ ...cfg, [k]: v });

  const finish = () => {
    setT(LAST); setRun("done");
    ran.current.add(kind);
    const ok = (ran.current.has("naive") && ran.current.has("playbook")) || (kind === "custom" && sum.peakErr < 0.005);
    if (ok && !fired.current) { fired.current = true; onComplete?.(); }
  };
  const launch = () => {
    if (!guess) return;
    if (reduced) { finish(); return; }
    setT(T_START); setRun("running");
  };

  useRaf((dt) => {
    setT((cur) => {
      const nt = cur + speedAt(cur) * dt;
      return nt >= LAST ? LAST : nt;
    });
  }, run === "running");
  useEffect(() => { if (run === "running" && t >= LAST) finish(); });

  const started = run !== "idle";
  const now = samples[Math.max(0, Math.min(samples.length - 1, Math.round(t) - T_START))];
  const shownBeats = started ? beats.filter((b) => b.t <= t) : [];
  const latest = shownBeats[shownBeats.length - 1];

  // ---------- chart data ----------
  const view = useMemo(() => buildView(samples, zoom), [samples, zoom]);
  const xNow = t / 60;
  const cut = <T extends [number, number]>(pts: T[]) => (started ? pts.filter((p) => p[0] <= xNow) : []);

  const status = statusOf(now, started, sum.cdnSatT !== null && t >= sum.cdnSatT);
  const tiles: { id: Tab; label: string; value: string; tone: Tone }[] = [
    { id: "viewers", label: "Watching", value: started ? fmtK(now.watching) : fmtK(cfg.peak / 2), tone: "neutral" },
    { id: "egress", label: "CDN egress", value: started ? fmtBps(now.egress) : fmtBps(cfg.peak / 2 * 4e6), tone: status.cdn },
    { id: "origin", label: "Origin", value: `${started ? fmtK(now.origin) : "0"}/s`, tone: status.origin },
    { id: "control", label: "Control plane", value: started ? `${fmtK(now.lic)} lic/s` : "idle", tone: status.control },
    { id: "errors", label: "Error rate", value: started ? fmtPct(now.err, now.err < 0.1 ? 1 : 0) : "0%", tone: status.err },
  ];

  const chart = chartFor(tab, cfg, sum, view, cut);
  const progress = (t - T_START) / (LAST - T_START);

  // ---------- pieces ----------
  const header = (
    <div className="pm-head">
      <Segmented<PresetId | "custom">
        label="Launch plan"
        value={kind}
        disabled={run === "running"}
        options={[{ value: "naive", label: "Naive launch" }, { value: "playbook", label: "Playbook launch" }, { value: "custom", label: "Custom" }]}
        onChange={(v) => { if (v === "custom") setOpen(true); else change(PRESETS[v]); }}
      />
    </div>
  );

  const clock = (
    <div className="pm-mission">
      <div className="pm-clock-wrap">
        <div className="pm-clock" aria-live="off" aria-label={`Clock ${fmtClock(t)}`}>{fmtClock(t)}</div>
        <div className="pm-phase">{phaseOf(t, started)}</div>
      </div>
      <div className="pm-actions">
        {run === "idle" && <Button variant="primary" onClick={launch} disabled={!guess} title={guess ? undefined : "Make a prediction first"}>Launch</Button>}
        {run === "running" && <Button onClick={() => setRun("paused")}>Pause</Button>}
        {run === "paused" && <Button variant="primary" onClick={() => setRun("running")}>Resume</Button>}
        {(run === "running" || run === "paused") && <Button variant="ghost" onClick={finish}>Skip to end</Button>}
        {run === "done" && <Button onClick={launch}>Replay</Button>}
        {run === "done" && kind !== "playbook" && <Button variant="primary" onClick={() => change(PRESETS.playbook)}>Try the playbook</Button>}
        {run === "done" && kind === "playbook" && <Button variant="primary" onClick={() => { setOpen(true); change({ ...PRESETS.playbook, jitter: 0, rampMin: 3 }); }}>Break it yourself</Button>}
      </div>
      <div className="pm-track" aria-hidden="true">
        <div className="pm-track-fill" style={{ width: `${progress * 100}%` }} />
        <div className="pm-track-t0" />
        <span className="pm-track-lbl l">T−30</span><span className="pm-track-lbl c">T0</span><span className="pm-track-lbl r">T+30</span>
      </div>
    </div>
  );

  const ticker = (
    <div className="pm-ticker" aria-live="polite">
      {!started && (
        <div className="pm-predict">
          <div className="pm-eyebrow">Predict before you launch</div>
          <div className="pm-q">{predict.q}</div>
          <div className="pm-opts" role="radiogroup" aria-label="Your prediction">
            {predict.options.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={guess === o} className={`pm-opt ${guess === o ? "on" : ""}`} onClick={() => setGuess(o)}>{o}</button>
            ))}
          </div>
          <div className="pm-hint">{guess ? "Locked in. Press Launch." : "Pick one to unlock Launch."}</div>
        </div>
      )}
      {started && (
        <>
          <AnimatePresence mode="popLayout" initial={false}>
            {latest && (
              <motion.div key={`${latest.t}-${latest.text}`} className={`pm-beat tone-${latest.tone}`}
                initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
                <span className="pm-beat-t">{latest.t <= T_START ? "T−30:00" : fmtClock(latest.t)}</span>
                <span className="pm-beat-text">{latest.text}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {shownBeats.length > 1 && (
            <ol className="pm-history" aria-label="Earlier events">
              {shownBeats.slice(-3, -1).reverse().map((b) => (
                <li key={`${b.t}-${b.text}`} className={`tone-${b.tone}`}><span>{b.t <= T_START ? "T−30:00" : fmtClock(b.t)}</span>{b.text}</li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );

  const reveal = run === "done" && guess && (
    <motion.div className={`pm-reveal ${guess === predict.answer ? "ok" : "miss"}`}
      initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="pm-reveal-top">
        <Chip tone={guess === predict.answer ? "good" : "warn"}>{guess === predict.answer ? "You called it" : "Not quite"}</Chip>
        <span className="pm-reveal-a">Answer: <b>{predict.answer}</b>{guess !== predict.answer && <> (you said {guess})</>}</span>
      </div>
      <p>{predict.explain}</p>
      <div className="pm-verdict">
        <Chip tone={sum.peakErr < 0.005 ? "good" : "bad"}>Peak errors {fmtPct(sum.peakErr, sum.peakErr < 0.05 ? 2 : 0)}</Chip>
        <Chip tone={sum.peakOrigin > ORIGIN_CAP ? "bad" : "good"}>Origin peak {fmtK(sum.peakOrigin)}/s</Chip>
        <Chip tone={sum.peakLic >= LIC_CAP ? "warn" : "good"}>Licenses peak {fmtK(sum.peakLic)}/s</Chip>
        {sum.storm && <Chip tone="bad">Retry storm {fmtNum(sum.maxAttemptRatio, 0)}x</Chip>}
      </div>
    </motion.div>
  );

  const board = (
    <div className="pm-board">
      <div className="pm-tiles" role="tablist" aria-label="Systems">
        {tiles.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={`pm-tile ${tab === x.id ? "on" : ""} tone-${x.tone}`} onClick={() => setTab(x.id)}>
            <span className="pm-tile-l"><i className="pm-dot" aria-hidden="true" />{x.label}</span>
            <span className="pm-tile-v">{x.value}</span>
          </button>
        ))}
      </div>
      <div className="pm-chart" role="tabpanel" aria-label={chart.title}>
        <div className="pm-chart-head">
          <div className="pm-chart-title">{chart.title}</div>
          <Segmented<Zoom> value={zoom} onChange={setZoom} options={[{ value: "hour", label: "Full hour" }, { value: "t0", label: "T0 close-up" }]} />
        </div>
        <LineChart
          series={chart.series}
          xMin={view.x0} xMax={view.x1} yMax={chart.yMax}
          height={compact ? 230 : 250}
          xFmt={(v) => xLabel(v, zoom)} yFmt={chart.yFmt}
          hLines={chart.hLines} bands={chart.bands}
          markers={[{ x: 0, label: "T0" }]}
        />
        <p className="pm-caption">{chart.caption}</p>
      </div>
    </div>
  );

  const controls = (
    <div className="pm-controls">
      <fieldset disabled={run === "running"}>
        <legend>Audience</legend>
        <Slider label="Peak concurrency" value={cfg.peak} min={2e5} max={2e6} step={1e5} onChange={set("peak")} format={(v) => `${fmtNum(v / 1e6, 1)}M`} hint="Half are already watching other titles." />
        <Slider label="Ramp to peak" value={cfg.rampMin} min={2} max={30} onChange={set("rampMin")} format={(v) => `${v} min`} hint="Shorter = a steeper wall." />
        <Slider label="Player start jitter" value={cfg.jitter} min={0} max={60} step={5} onChange={set("jitter")} format={(v) => (v ? `0–${v} s` : "Off")} />
      </fieldset>
      <fieldset disabled={run === "running"}>
        <legend>Caches</legend>
        <Slider label="Pre-warm" value={cfg.prewarm} min={0} max={10} onChange={set("prewarm")} format={(v) => (v ? `${v} seg (${v * 4} s)` : "Off")} hint="First N segments pushed to shields and edges." />
        <Toggle label="Request collapsing" checked={cfg.collapse} onChange={set("collapse")} hint="One upstream fetch per cache." />
        <Toggle label="Shield" checked={cfg.shield} onChange={set("shield")} hint="One cache tier in front of the origin." />
      </fieldset>
      <fieldset disabled={run === "running"}>
        <legend>CDN capacity</legend>
        <Segmented<number> label="CDNs" value={cfg.cdns} onChange={(v) => set("cdns")(v as 1 | 2 | 3)}
          options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
        <Slider label="Reserved per CDN" value={cfg.reservedTbps} min={0.15} max={6} step={0.05} onChange={set("reservedTbps")} format={(v) => fmtBps(v * 1e12)}
          hint={`Split ${SPLITS[cfg.cdns].map((x) => Math.round(x * 100)).join("/")}. Default quota is ${QUOTA_GBPS} Gbps and ${fmtK(QUOTA_RPS)} req/s.`} />
        <div className="pm-need">
          <Chip tone={sum.cdnSatT === null ? "good" : "bad"}>{fmtBps(sum.totalReserved)} reserved</Chip>
          <span>Peak needs {fmtBps(sum.peakNeed)}</span>
        </div>
      </fieldset>
      <fieldset disabled={run === "running"}>
        <legend>Control plane</legend>
        <Toggle label="Control-plane protection" checked={cfg.protect} onChange={set("protect")} hint="Cache login and entitlement, refresh early with jitter, rate-limit DRM licenses, players back off." />
      </fieldset>
    </div>
  );

  const stage = (
    <div className="pm-stage">
      {header}
      {clock}
      {ticker}
      {reveal}
      {board}
    </div>
  );

  return (
    <div className={`pm ${compact ? "is-compact" : "is-full"}`}>
      {compact ? (
        <WidgetFrame stage={stage} footer={
          <details className="pm-details" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
            <summary>Tune the launch<span>{kind === "custom" ? "Custom plan" : "8 controls"}</span></summary>
            {controls}
          </details>
        } />
      ) : (
        <WidgetFrame stage={stage} controls={controls} />
      )}
    </div>
  );
}

// ---------- helpers ----------

function statusOf(s: Sample, started: boolean, cdnFull: boolean) {
  const tone = (f: number): Tone => (!started ? "neutral" : f > 0.02 ? "bad" : f > 0.001 ? "warn" : "good");
  return {
    cdn: started && cdnFull ? "bad" : tone(s.fCdn),
    origin: tone(s.fOrigin),
    control: !started ? "neutral" : Math.max(s.fAuth, s.fLic) > 0.02 ? "bad" : s.lic >= LIC_CAP * 0.98 ? "warn" : "good",
    err: !started ? "neutral" : s.err >= 0.005 ? "bad" : s.err > 0.001 ? "warn" : "good",
  } as Record<string, Tone>;
}

type Pt = [number, number];
interface View { x0: number; x1: number; watching: Pt[]; forecast: Pt[]; egress: Pt[]; origin: Pt[]; originCap: Pt[]; err: Pt[]; auth: Pt[]; api: Pt[]; lic: Pt[]; renew: Pt[] }

/** Downsample to about 360 points: 10 s buckets for the hour, 1 s for the close-up. Rates keep the bucket max so spikes stay visible. */
function buildView(samples: Sample[], zoom: Zoom): View {
  const [a, b, step] = zoom === "hour" ? [T_START, T_END, 10] : [-60, 300, 1];
  const v: View = { x0: a / 60, x1: b / 60, watching: [], forecast: [], egress: [], origin: [], originCap: [], err: [], auth: [], api: [], lic: [], renew: [] };
  for (let t = a; t < b; t += step) {
    const xs = samples.slice(t - T_START, t - T_START + step);
    const mx = (k: keyof Sample) => Math.max(...xs.map((s) => s[k] as number));
    const mn = (k: keyof Sample) => Math.min(...xs.map((s) => s[k] as number));
    const x = (t + step - 1) / 60;
    v.watching.push([x, mx("watching")]); v.forecast.push([x, mx("forecast")]); v.egress.push([x, mx("egress")]);
    v.origin.push([x, mx("origin")]); v.originCap.push([x, mn("originCap")]); v.err.push([x, mx("err") * 100]);
    v.auth.push([x, mx("auth")]); v.api.push([x, mx("api")]); v.lic.push([x, mx("lic")]); v.renew.push([x, mx("renew")]);
  }
  return v;
}

function xLabel(v: number, zoom: Zoom) {
  if (Math.abs(v) < 1e-6) return "T0";
  const m = zoom === "hour" ? Math.round(v) : Math.round(v * 10) / 10;
  return `${m > 0 ? "+" : "−"}${Math.abs(m)}m`;
}

type Cut = (pts: Pt[]) => Pt[];
interface ChartSpec { title: string; caption: string; series: Series[]; yMax?: number; yFmt: (v: number) => string; hLines?: { y: number; label: string; tone?: Tone }[]; bands?: { y0: number; y1: number; tone: Tone }[] }

function chartFor(tab: Tab, c: Cfg, s: ReturnType<typeof simulate>["sum"], v: View, cut: Cut): ChartSpec {
  const k = (n: number) => fmtK(n);
  switch (tab) {
    case "viewers":
      return {
        title: "Concurrent viewers", yMax: c.peak * 1.1, yFmt: k,
        caption: "Dashed: the forecast if nothing fails. Solid: viewers who actually got the video. The gap is people stuck on an error screen.",
        series: [
          { id: "f", label: "Forecast (no failures)", color: "var(--muted)", points: v.forecast, dashed: true },
          { id: "w", label: "Watching", color: "var(--p5)", points: cut(v.watching), area: true },
        ],
      };
    case "egress": {
      const need = s.peakNeed, total = s.totalReserved;
      return {
        title: "CDN egress against reserved capacity", yMax: Math.max(need, total) * 1.15, yFmt: (x) => fmtBps(x),
        caption: `Egress = viewers x 4 Mbps. About 8 Tbps at 2M. A default quota (${QUOTA_GBPS} Gbps per CDN) is the red line near zero: capacity must be arranged weeks ahead.`,
        hLines: [
          { y: total, label: `Reserved ${fmtBps(total)}`, tone: s.cdnSatT === null ? "good" : "warn" },
          { y: QUOTA_GBPS * 1e9 * c.cdns, label: "Default quota", tone: "bad" },
        ],
        series: [{ id: "e", label: "Egress", color: "var(--p5)", points: cut(v.egress), area: true }],
      };
    }
    case "origin":
      return {
        title: "Origin requests per second", yMax: Math.max(s.peakOrigin, ORIGIN_CAP) * 1.12, yFmt: k,
        caption: "Each cold object costs one fetch per cache that misses. Without collapsing and a shield, thousands of servers fetch the same object at once.",
        hLines: [{ y: ORIGIN_CAP, label: `Origin capacity ${k(ORIGIN_CAP)}/s`, tone: "warn" }],
        series: [
          { id: "o", label: "Origin requests", color: "var(--p5)", points: cut(v.origin), area: true },
          { id: "c", label: "Usable capacity (drops when overloaded)", color: "var(--bad)", points: cut(v.originCap), dashed: true },
        ],
      };
    case "control":
      return {
        title: "Control plane: sign-in, playback API, DRM licenses", yMax: Math.max(33000, s.peakLic, s.peakAuth) * 1.1, yFmt: k,
        caption: "Book math: 2M streams renewing every 300 s is about 6,700 licenses/s. With start bursts, a 2M premiere needs 20–30k license requests/s (shaded).",
        bands: [{ y0: 20000, y1: 30000, tone: "warn" }],
        hLines: [{ y: LIC_CAP, label: `License limit ${k(LIC_CAP)}/s`, tone: "bad" }, { y: AUTH_CAP, label: `Sign-in limit ${k(AUTH_CAP)}/s`, tone: "warn" }],
        series: [
          { id: "l", label: "DRM licenses", color: "var(--p5)", points: cut(v.lic) },
          { id: "a", label: "Sign-in", color: "var(--accent)", points: cut(v.auth) },
          { id: "p", label: "Playback API", color: "var(--p3)", points: cut(v.api) },
          { id: "r", label: "License renewals", color: "var(--muted)", points: cut(v.renew), dashed: true },
        ],
      };
    case "errors":
      return {
        title: "Error rate", yMax: Math.min(100, Math.max(2, s.peakErr * 100 * 1.1)), yFmt: (x) => `${fmtNum(x, x < 10 && x > 0 ? 1 : 0)}%`,
        caption: "Share of play attempts that fail, plus viewers on an overloaded CDN. The goal line is 0.5%.",
        hLines: [{ y: 0.5, label: "0.5% goal", tone: "good" }],
        series: [{ id: "x", label: "Error rate", color: "var(--bad)", points: cut(v.err), area: true }],
      };
  }
}
