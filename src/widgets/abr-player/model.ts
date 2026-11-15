/**
 * Pure ABR player simulation for the "Inside the player" widget (book Chapter 10).
 * No React here. Everything is deterministic: same trace + algorithm + params = same run.
 *
 * Model (book 10.4): the screen drains the buffer at 1 s per s; each segment of duration D at
 * bitrate R takes T = TTFB + (R x D) / throughput to download. Buffer 0 while playing = rebuffer.
 */

/** Apple's example H.264 ladder ("one possible set"), book Table 7.5.1. kbps. */
export const LADDER = [
  { kbps: 365, res: "360p" },
  { kbps: 730, res: "432p" },
  { kbps: 1100, res: "432p" },
  { kbps: 2000, res: "540p" },
  { kbps: 3000, res: "720p" },
  { kbps: 4500, res: "720p" },
  { kbps: 6000, res: "1080p" },
  { kbps: 7800, res: "1080p" },
] as const;
export const TOP = LADDER.length - 1;

export const SEG = 4;            // s per segment (book model: 4-6 s)
export const DURATION = 120;     // s of wall-clock session we simulate
export const TRACE_STEP = 2;     // s between editable bandwidth points
export const TRACE_N = DURATION / TRACE_STEP + 1;
export const BW_MAX = 12;        // Mbps, top of the editor
export const BW_MIN = 0.1;
export const TTFB = 0.1;         // s per request (edge hit, assumed)
export const CONTROL_PLANE = 0.8; // s: playback API + manifest + license before the first segment (assumed)
export const COLD_START = 0.5;   // s: TCP slow start on the first segment of a cold connection (book 10.5.2)
export const START_DEFAULT_KBPS = 500; // hls.js and Shaka default estimate with no history (book 10.3.2)
const DT = 0.02;
const SAMPLE_EVERY = 0.25;

export type AlgoKey = "throughput" | "bba" | "bola" | "hybrid";
export const ALGOS: { key: AlgoKey; label: string; short: string; blurb: string }[] = [
  { key: "throughput", label: "Throughput", short: "Thru", blurb: "Moving average of download speed x safety factor. Highest rung that fits." },
  { key: "bba", label: "BBA", short: "BBA", blurb: "Bitrate from buffer level only. Lowest below the reservoir, rising through the cushion." },
  { key: "bola", label: "BOLA-lite", short: "BOLA", blurb: "Scores each rung by utility minus buffer pressure. Will not climb past the throughput estimate." },
  { key: "hybrid", label: "Hybrid", short: "Hybrid", blurb: "Like dash.js DYNAMIC: throughput rule while the buffer is small, BOLA once it is large." },
];
export const algoLabel = (k: AlgoKey) => ALGOS.find((a) => a.key === k)!.label;

export interface Params { target: number; safety: number }
export const DEFAULT_PARAMS: Params = { target: 24, safety: 0.7 };

/* ---------------- Network traces ---------------- */

export type TraceKey = "stable" | "train" | "evening" | "drop";
export const TRACES: { key: TraceKey; label: string; note: string }[] = [
  { key: "stable", label: "Stable 8 Mbps", note: "Home fibre. Nothing goes wrong." },
  { key: "train", label: "Commuter train", note: "Dips between masts, then a tunnel at 1:04." },
  { key: "evening", label: "Congested evening", note: "9 pm peak. A slow start, then a link that sags and wobbles." },
  { key: "drop", label: "Sudden drop", note: "8 Mbps, then 1.5 Mbps from 0:40." },
];

/** Tunnel window in the commuter preset (s). */
export const TUNNEL: [number, number] = [64, 76];
export const DROP_AT = 40;

function fromKnots(knots: [number, number][]): number[] {
  // knots: [time s, Mbps], linear between knots, sampled every TRACE_STEP
  const out: number[] = [];
  for (let i = 0; i < TRACE_N; i++) {
    const t = i * TRACE_STEP;
    let k = 0;
    while (k < knots.length - 2 && knots[k + 1][0] <= t) k++;
    const [t0, v0] = knots[k], [t1, v1] = knots[k + 1];
    const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    out.push(+(v0 + (v1 - v0) * f).toFixed(2));
  }
  return out;
}

export function presetTrace(key: TraceKey): number[] {
  switch (key) {
    case "stable": return Array.from({ length: TRACE_N }, () => 8);
    case "drop": return fromKnots([[0, 8], [DROP_AT, 8], [DROP_AT + 2, 1.5], [DURATION, 1.5]]);
    case "train": return fromKnots([
      [0, 6.5], [6, 7.5], [12, 5], [16, 3.2], [20, 6.5], [28, 8], [34, 4.5], [38, 2.6], [42, 5.5],
      [50, 7], [56, 4.2], [60, 6], [62, 5], [TUNNEL[0], 0.15], [TUNNEL[1], 0.15], [82, 3.5], [86, 6.5],
      [94, 7.5], [100, 4], [104, 2.8], [108, 5.5], [114, 7], [120, 6.5],
    ]);
    case "evening": return fromKnots([
      [0, 0.9], [4, 1.2], [8, 4.8], [14, 3.4], [18, 4.2], [24, 2.6], [30, 3.4], [36, 2.1], [42, 2.9], [48, 1.8],
      [54, 2.6], [60, 1.6], [66, 2.4], [72, 1.9], [78, 2.7], [86, 1.7], [92, 2.5], [100, 2.0], [106, 2.8], [114, 2.2], [120, 2.6],
    ]);
  }
}

/** Bandwidth (Mbps) at time t, linear between points. */
export function bwAt(trace: number[], t: number): number {
  const x = Math.max(0, Math.min(DURATION, t)) / TRACE_STEP;
  const i = Math.min(trace.length - 2, Math.floor(x));
  const f = x - i;
  return trace[i] + (trace[i + 1] - trace[i]) * f;
}

/** A "drop": bandwidth later falls to <= 60% of an earlier value and by at least 1 Mbps. */
export function hasDrop(trace: number[]): boolean {
  let peak = -Infinity;
  for (const v of trace) {
    if (peak - v >= 1 && v <= peak * 0.6) return true;
    peak = Math.max(peak, v);
  }
  return false;
}

/* ---------------- ABR rules ---------------- */

const highestUnder = (kbps: number) => { let r = 0; for (let i = 0; i < LADDER.length; i++) if (LADDER[i].kbps <= kbps) r = i; return r; };
const fmtM = (kbps: number) => `${(kbps / 1000).toFixed(kbps < 1000 ? 2 : 1)} Mbps`;

export interface Decision { rung: number; why: string; mode?: "thru" | "bola" }

interface Ctx { buffer: number; est: number | null; prev: number; params: Params; hybridBola: boolean }

function ruleThroughput(c: Ctx): Decision {
  const est = c.est ?? START_DEFAULT_KBPS;
  const budget = est * c.params.safety;
  const rung = highestUnder(budget);
  const src = c.est == null ? "no history: default estimate" : "estimate";
  return { rung, why: `${src} ${fmtM(est)} x ${c.params.safety.toFixed(2)} = ${fmtM(budget)}, so ${LADDER[rung].kbps} kbps fits` };
}

/** BBA-0 (Huang et al., SIGCOMM 2014), scaled to a small buffer: reservoir 25% of target, cushion to 85%. */
export function bbaZones(target: number) { return { reservoir: target * 0.25, upper: target * 0.85 }; }
function ruleBBA(c: Ctx): Decision {
  const { reservoir, upper } = bbaZones(c.params.target);
  const b = c.buffer;
  const rMin = LADDER[0].kbps, rMax = LADDER[TOP].kbps;
  if (b <= reservoir) return { rung: 0, why: `buffer ${b.toFixed(1)} s is in the reservoir (< ${reservoir.toFixed(0)} s): lowest rung` };
  if (b >= upper) return { rung: TOP, why: `buffer ${b.toFixed(1)} s is above the cushion (> ${upper.toFixed(0)} s): top rung` };
  const f = rMin + ((rMax - rMin) * (b - reservoir)) / (upper - reservoir);
  // BBA-0 hysteresis: move up only when f passes the next rung, down only when f falls below the previous one.
  const p = c.prev;
  const up = p < TOP ? LADDER[p + 1].kbps : Infinity, down = p > 0 ? LADDER[p - 1].kbps : -Infinity;
  let rung = p;
  if (f >= up) rung = highestUnder(f);
  else if (f <= down) { rung = 0; for (let i = 0; i < LADDER.length; i++) if (LADDER[i].kbps > f) { rung = i; break; } }
  const verb = rung === p ? "keep" : rung > p ? "step up to" : "step down to";
  return { rung, why: `buffer ${b.toFixed(1)} s in the cushion maps to ${fmtM(f)}: ${verb} ${LADDER[rung].kbps} kbps` };
}

/** BOLA-BASIC utility rule (Spiteri et al. 2016) as written in dash.js BolaRule, with its "no climb past throughput" guard. */
function ruleBOLA(c: Ctx): Decision {
  // Decisions happen at buffer <= target - SEG (the player pauses above it), so that is BOLA's top.
  const T = c.params.target - SEG;
  const bMin = T / 3;
  const u = LADDER.map((r) => Math.log(r.kbps / LADDER[0].kbps) + 1);
  const gp = (u[TOP] - 1) / (T / bMin - 1);
  const V = bMin / gp;
  let best = 0, bestScore = -Infinity;
  for (let m = 0; m < LADDER.length; m++) {
    const s = (V * (u[m] + gp) - c.buffer) / LADDER[m].kbps;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  let rung = best, why = `buffer ${c.buffer.toFixed(1)} s: best utility score is ${LADDER[best].kbps} kbps`;
  if (rung > c.prev && c.est != null && LADDER[rung].kbps > c.est) {
    rung = Math.max(c.prev, highestUnder(c.est));
    why += `, but throughput ${fmtM(c.est)} cannot carry it: ${LADDER[rung].kbps} kbps`;
  }
  return { rung, why };
}

/** Hybrid switch points (dash.js DYNAMIC, simplified): BOLA from target/3, back to throughput below target/6. */
export function hybridSwitch(target: number) { return { on: target / 3, off: target / 6 }; }

function decide(algo: AlgoKey, c: Ctx): Decision {
  if (algo === "throughput") return ruleThroughput(c);
  if (algo === "bba") return ruleBBA(c);
  if (algo === "bola") return ruleBOLA(c);
  const d = c.hybridBola ? ruleBOLA(c) : ruleThroughput(c);
  return { ...d, mode: c.hybridBola ? "bola" : "thru", why: (c.hybridBola ? "BOLA mode, " : "throughput mode, ") + d.why };
}

/* ---------------- Simulation ---------------- */

export interface SegRec {
  i: number; rung: number; reqT: number; doneT: number;
  bl: number;          // buffer at request (s)
  mtp: number | null;  // estimate at request (kbps)
  why: string;
}
export interface Sample { t: number; buf: number; play: number | null; sel: number; stalled: boolean; started: boolean; media: number }
export interface Stall { start: number; end: number }

export interface Run {
  algo: AlgoKey;
  segs: SegRec[];
  samples: Sample[];
  stalls: Stall[];
  vst: number | null;
  sid: string;
}

export function makeSid(seed: number): string {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s; };
  const hex = (n: number) => Array.from({ length: n }, () => (r() >>> 28).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export function simulate(trace: number[], algo: AlgoKey, params: Params, sid = "6e2fb550-c457-41e9-bb97-0800200c9a66"): Run {
  const segs: SegRec[] = [], samples: Sample[] = [], stalls: Stall[] = [];
  let t = 0, buffer = 0, media = 0;
  let started = false, playing = false, vst: number | null = null;
  let est: number | null = null, prev = 0, hybridBola = false;
  let dl: { rung: number; size: number; got: number; ttfb: number; reqT: number } | null = null;
  let nextSample = 0, stallStart = -1;
  const order: number[] = []; // rung per media segment index
  const hs = hybridSwitch(params.target);

  while (t < DURATION - 1e-9) {
    // 1. start a request when there is room in the buffer
    if (!dl && t >= CONTROL_PLANE && buffer <= params.target - SEG + 1e-9) {
      if (algo === "hybrid") { if (!hybridBola && buffer >= hs.on) hybridBola = true; else if (hybridBola && buffer < hs.off) hybridBola = false; }
      const d = decide(algo, { buffer, est, prev, params, hybridBola });
      const first = segs.length === 0;
      segs.push({ i: segs.length, rung: d.rung, reqT: t, doneT: NaN, bl: buffer, mtp: est, why: d.why });
      dl = { rung: d.rung, size: LADDER[d.rung].kbps * SEG, got: 0, ttfb: TTFB + (first ? COLD_START : 0), reqT: t };
      prev = d.rung;
    }
    // 2. move bytes
    if (dl) {
      if (dl.ttfb > 0) dl.ttfb -= DT;
      else dl.got += bwAt(trace, t) * 1000 * DT;
      if (dl.got >= dl.size) {
        const took = t + DT - dl.reqT;
        const sample = dl.size / took;
        // EWMA with a 3 s half-life, weighted by download duration (hls.js style)
        if (est == null) est = sample;
        else { const a = Math.pow(0.5, took / 3); est = a * est + (1 - a) * sample; }
        buffer += SEG;
        order.push(dl.rung);
        segs[segs.length - 1].doneT = t + DT;
        dl = null;
      }
    }
    // 3. playback
    if (playing) {
      buffer -= DT; media += DT;
      if (buffer <= 0) { buffer = 0; playing = false; stallStart = t + DT; }
    } else if (!started) {
      if (buffer >= SEG - 1e-9) { started = true; playing = true; vst = t + DT; }
    } else if (buffer >= SEG - 1e-9) {
      playing = true; stalls.push({ start: stallStart, end: t + DT }); stallStart = -1;
    }
    t += DT;
    if (t >= nextSample - 1e-9) {
      const idx = Math.min(order.length - 1, Math.floor(media / SEG));
      samples.push({ t: +t.toFixed(3), buf: buffer, play: started && idx >= 0 ? order[idx] : null, sel: prev, stalled: started && !playing, started, media });
      nextSample += SAMPLE_EVERY;
    }
  }
  if (stallStart >= 0) stalls.push({ start: stallStart, end: DURATION });
  return { algo, segs, samples, stalls, vst, sid };
}

/* ---------------- QoE up to time t ---------------- */

export interface QoE {
  vst: number | null; rebufRatio: number; stallTime: number; avgKbps: number | null;
  switches: number; ebvs: number | null; stalls: number;
}

/** Krishnan and Sitaraman (IMC 2012): abandonment starts at about 2 s, then about 5.8% more per extra second. */
export const ebvsRisk = (vst: number) => Math.min(1, Math.max(0, vst - 2) * 0.058);

export function qoeAt(run: Run, t: number): QoE {
  let play = 0, stall = 0, kbpsTime = 0, last: number | null = null, switches = 0;
  for (let k = 0; k < run.samples.length; k++) {
    const s = run.samples[k];
    if (s.t > t + 1e-9) break;
    const dt = k === 0 ? s.t : s.t - run.samples[k - 1].t;
    if (s.stalled) stall += dt;
    else if (s.started && s.play != null) {
      play += dt; kbpsTime += LADDER[s.play].kbps * dt;
      if (last != null && s.play !== last) switches++;
      last = s.play;
    }
  }
  const vst = run.vst != null && run.vst <= t ? run.vst : null;
  const stallCount = run.stalls.filter((x) => x.start <= t).length;
  // startup still pending at t: show the risk so far
  const ebvs = vst != null ? ebvsRisk(vst) : t > 2 ? ebvsRisk(t) : null;
  return {
    vst, stallTime: stall, rebufRatio: play + stall > 0 ? stall / (play + stall) : 0,
    avgKbps: play > 0 ? kbpsTime / play : null, switches, ebvs, stalls: stallCount,
  };
}

/** Index of the last sample at or before t. */
export function sampleAt(run: Run, t: number): Sample | null {
  let lo = 0, hi = run.samples.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (run.samples[m].t <= t + 1e-9) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans >= 0 ? run.samples[ans] : null;
}

/** Stall seconds that overlap [a, b]. */
export const stallIn = (run: Run, a: number, b: number) =>
  run.stalls.reduce((s, x) => s + Math.max(0, Math.min(b, x.end) - Math.max(a, x.start)), 0);
