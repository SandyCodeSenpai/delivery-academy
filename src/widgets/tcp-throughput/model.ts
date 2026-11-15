/**
 * Pure model for the "Latency, loss and throughput" widget.
 * Numbers follow Chapter 2 of the book: MSS 1,460 bytes, initial window 10 segments (RFC 6928),
 * the Mathis rule for loss-based TCP, and the handshake round-trip counts in Sections 2.9 and 2.10.
 */

export type CC = "cubic" | "bbr";

export interface PathState {
  rtt: number;      // ms
  loss: number;     // fraction, 0..0.05
  bw: number;       // last-mile bandwidth, Mbps
  bitrate: number;  // rendition bitrate, Mbps
  seg: number;      // segment length, s
  cc: CC;
  idle: boolean;    // slow start again after idle (each segment starts from the initial window)
}

export const MSS_BYTES = 1460;
export const MSS_BITS = MSS_BYTES * 8; // 11,680
export const IW_PACKETS = 10;
export const IW_BYTES = IW_PACKETS * MSS_BYTES; // 14,600

export type Verdict = "Smooth" | "Tight" | "Will rebuffer";
export const verdictTone = (v: Verdict) => (v === "Smooth" ? "good" : v === "Tight" ? "warn" : "bad") as "good" | "warn" | "bad";

/** Mathis et al. 1997: throughput <= (MSS / RTT) x (1.22 / sqrt(p)). Returns Mbps (Infinity when p = 0). */
export function mathisMbps(rttMs: number, p: number): number {
  if (p <= 0) return Infinity;
  return (MSS_BITS / (rttMs / 1000)) * (1.22 / Math.sqrt(p)) / 1e6;
}

/** Bandwidth-delay product in bytes. */
export const bdpBytes = (bwMbps: number, rttMs: number) => (bwMbps * 1e6 * (rttMs / 1000)) / 8;

export interface SlowStart {
  /** seconds from sending the GET until the last byte arrives */
  time: number;
  /** congestion window per round trip, bytes (first rounds only, for drawing) */
  rounds: { w: number; capped: boolean }[];
  /** round trips spent growing the window (fractional) */
  growRounds: number;
  /** window that fills the path at `rateMbps`, bytes */
  targetW: number;
}

/**
 * A new connection fetching `sizeBytes`. The window starts at 10 packets and doubles every RTT
 * until it reaches the window that fills the path (rate x RTT). After that, bytes flow at `rateMbps`.
 * Loss during slow start is ignored (it is a teaching model).
 */
export function slowStart(sizeBytes: number, rateMbps: number, rttMs: number): SlowStart {
  const rtt = rttMs / 1000;
  const rate = rateMbps * 1e6;
  const targetW = (rate * rtt) / 8;
  let w = IW_BYTES, sent = 0, t = 0, grow = 0;
  const rounds: { w: number; capped: boolean }[] = [];
  let guard = 0;
  while (sent < sizeBytes && guard++ < 64) {
    if (w >= targetW) {
      // path-limited from here: the rest flows at the steady rate, after the request round trip if nothing was sent yet
      const rest = sizeBytes - sent;
      if (sent === 0) t += rtt; // request goes out, first bytes come back one RTT later
      t += (rest * 8) / rate;
      const extra = Math.min(6, Math.ceil(rest / Math.max(1, targetW)));
      for (let i = 0; i < extra; i++) rounds.push({ w: targetW, capped: true });
      sent = sizeBytes;
      break;
    }
    if (sent + w >= sizeBytes) {
      const frac = (sizeBytes - sent) / w;
      t += rtt * frac; grow += frac;
      rounds.push({ w, capped: false });
      sent = sizeBytes;
    } else {
      sent += w; t += rtt; grow += 1;
      rounds.push({ w, capped: false });
      w *= 2;
    }
  }
  return { time: t, rounds, growRounds: grow, targetW };
}

export const HANDSHAKES = [
  { id: "tls12", label: "TCP + TLS 1.2", setup: 3 },
  { id: "tls13", label: "TCP + TLS 1.3", setup: 2 },
  { id: "quic", label: "QUIC (HTTP/3)", setup: 1 },
  { id: "zrtt", label: "QUIC 0-RTT resume", setup: 0 },
] as const;

/** First byte arrives after the setup round trips plus the request round trip. */
export const firstByteMs = (setupRtts: number, rttMs: number) => (setupRtts + 1) * rttMs;

export function verdictFor(ratio: number): Verdict {
  if (ratio < 0.7) return "Smooth";
  if (ratio < 1) return "Tight";
  return "Will rebuffer";
}

export interface Result {
  mathis: number;          // Mbps (may be Infinity)
  throughput: number;      // loss-based steady throughput, Mbps (Mathis capped by link)
  limitedBy: "loss" | "link";
  bdp: number;             // bytes, at the link rate
  bdpPackets: number;
  segBytes: number;
  download: number;        // s, one segment, loss-based model
  ratio: number;           // download / seg
  verdict: Verdict;
  /** BBR best case (link rate) when cc = bbr */
  bestDownload: number;
  bestRatio: number;
  bbrSplit: boolean;       // the loss-based and best-case verdicts disagree
  cold: SlowStart;         // first segment on a new connection
  coldTotal: number;       // s, TCP + TLS 1.3 handshake + slow-start fetch
}

function downloadTime(segBytes: number, rateMbps: number, rttMs: number, idle: boolean): number {
  if (idle) return slowStart(segBytes, rateMbps, rttMs).time;
  return rttMs / 1000 + (segBytes * 8) / (rateMbps * 1e6);
}

export function compute(s: PathState): Result {
  const mathis = mathisMbps(s.rtt, s.loss);
  const throughput = Math.min(s.bw, mathis);
  const limitedBy = mathis < s.bw ? "loss" : "link";
  const bdp = bdpBytes(s.bw, s.rtt);
  const segBytes = (s.bitrate * 1e6 * s.seg) / 8;
  const download = downloadTime(segBytes, throughput, s.rtt, s.idle);
  const ratio = download / s.seg;
  const bestDownload = downloadTime(segBytes, s.bw, s.rtt, s.idle);
  const bestRatio = bestDownload / s.seg;
  const vLoss = verdictFor(ratio), vBest = verdictFor(bestRatio);
  const bbrSplit = s.cc === "bbr" && vLoss !== vBest;
  const verdict: Verdict = bbrSplit ? "Tight" : vLoss;
  const cold = slowStart(segBytes, throughput, s.rtt);
  const coldTotal = (2 * s.rtt) / 1000 + cold.time;
  return { mathis, throughput, limitedBy, bdp, bdpPackets: bdp / MSS_BYTES, segBytes, download, ratio, verdict, bestDownload, bestRatio, bbrSplit, cold, coldTotal };
}

/* ---- loss slider: 0, then 0.01% .. 5% on a log scale ---- */
const P_MIN = 1e-4, P_MAX = 0.05;
export function lossFromSlider(v: number): number {
  if (v <= 0) return 0;
  return P_MIN * Math.pow(P_MAX / P_MIN, (v - 1) / 99);
}
export function sliderFromLoss(p: number): number {
  if (p <= 0) return 0;
  return 1 + (99 * Math.log(p / P_MIN)) / Math.log(P_MAX / P_MIN);
}

/* ---- formatting ---- */
export function fmtLoss(p: number): string {
  if (p <= 0) return "0%";
  const v = p * 100;
  return `${v < 1 ? v.toFixed(2) : v.toFixed(1)}%`;
}
export function oneIn(p: number): string {
  if (p <= 0) return "no loss";
  const n = 1 / p;
  const r = n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  return `1 in ${r.toLocaleString("en-US")} packets`;
}
export function fmtMbps(v: number): string {
  if (!isFinite(v)) return "no limit";
  if (v >= 100) return `${Math.round(v)} Mbps`;
  if (v >= 10) return `${v.toFixed(1).replace(/\.0$/, "")} Mbps`;
  return `${v.toFixed(v < 1 ? 2 : 1)} Mbps`;
}
export function fmtSec(s: number): string {
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  return `${s.toFixed(s < 10 ? 1 : 0)} s`;
}
export function fmtKB(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes < 1e5) return `${(bytes / 1000).toFixed(1).replace(/\.0$/, "")} KB`;
  return `${Math.round(bytes / 1000).toLocaleString("en-US")} KB`;
}

/* ---- presets ---- */
export interface Preset { id: string; label: string; state: Partial<PathState>; note: string }
export const PRESETS: Preset[] = [
  {
    id: "near-pop", label: "Viewer near PoP",
    state: { rtt: 12, loss: 0.001, bw: 50, bitrate: 6, seg: 4, cc: "cubic", idle: false },
    note: "A same-city edge, about 12 ms away. With 1 in 1,000 packets lost, the loss ceiling is still about 38 Mbps, far above the 6 Mbps rendition.",
  },
  {
    id: "sao-paulo", label: "Sao Paulo from Virginia",
    state: { rtt: 120, loss: 0.001, bw: 50, bitrate: 6, seg: 4, cc: "cubic", idle: false },
    note: "Same plan, same loss, same rendition. Only the distance changed: about 7,600 km in a straight line gives at least 76 ms of RTT (1 ms per 100 km of fiber); real routes are longer, so 120 ms is assumed.",
  },
  {
    id: "lossy-mobile", label: "Lossy mobile",
    state: { rtt: 60, loss: 0.02, bw: 20, bitrate: 4, seg: 4, cc: "cubic", idle: false },
    note: "A phone on a busy cell: 1 in 50 packets lost. Loss-based TCP backs off on every drop, even when the drop is radio noise, not congestion.",
  },
  {
    id: "bbr-vs-cubic", label: "BBR vs CUBIC",
    state: { rtt: 80, loss: 0.01, bw: 30, bitrate: 5, seg: 4, cc: "bbr", idle: false },
    note: "A lossy path where CUBIC (loss-based) struggles. Switch the sender between CUBIC and BBR to compare.",
  },
];

export const DEFAULT_STATE: PathState = { rtt: 40, loss: 0.001, bw: 25, bitrate: 5, seg: 4, cc: "cubic", idle: false };

export function findPreset(key?: string): Preset | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase();
  return PRESETS.find((p) => p.id === k || p.label.toLowerCase() === k);
}
