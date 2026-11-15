/**
 * Pure model for the multi-CDN widget. No React here.
 * Every RUM number, price and share in this file is ASSUMED for teaching unless a comment cites the book (chapter 9).
 */

export type CdnId = "A" | "B" | "C";
export const CDNS: CdnId[] = ["A", "B", "C"];
export const CDN_COLOR: Record<CdnId, string> = { A: "var(--p2)", B: "var(--p1)", C: "var(--p3)" };

export interface Cell { thr: number; err: number; price: number } // Mbps (median, RUM), error rate in %, $/GB
export interface Region { id: string; name: string; short: string; weight: number; cells: Record<CdnId, Cell> }

/** Assumed. Shapes follow 9.2: a premium global CDN (A), a mid-price CDN strong in LatAm (B), a cheap CDN strong in India (C). */
export const REGIONS: Region[] = [
  { id: "na", name: "North America", short: "N. America", weight: 0.38, cells: {
    A: { thr: 24, err: 0.2, price: 0.0045 }, B: { thr: 21, err: 0.3, price: 0.0035 }, C: { thr: 15, err: 0.6, price: 0.002 } } },
  { id: "latam", name: "LatAm", short: "LatAm", weight: 0.16, cells: {
    A: { thr: 13, err: 0.35, price: 0.0095 }, B: { thr: 14, err: 0.3, price: 0.008 }, C: { thr: 8, err: 0.9, price: 0.006 } } },
  { id: "eu", name: "Europe", short: "Europe", weight: 0.24, cells: {
    A: { thr: 22, err: 0.25, price: 0.005 }, B: { thr: 20, err: 0.3, price: 0.004 }, C: { thr: 14, err: 0.7, price: 0.0025 } } },
  { id: "apac", name: "APAC", short: "APAC", weight: 0.12, cells: {
    A: { thr: 18, err: 0.3, price: 0.011 }, B: { thr: 13, err: 0.5, price: 0.009 }, C: { thr: 12, err: 0.8, price: 0.007 } } },
  { id: "india", name: "India", short: "India", weight: 0.10, cells: {
    A: { thr: 7, err: 0.8, price: 0.01 }, B: { thr: 6, err: 0.9, price: 0.008 }, C: { thr: 9, err: 0.5, price: 0.0045 } } },
];

/** Assumed monthly volume from the running example: ~540 PB delivered a month. */
export const MONTHLY_GB = 540e6;
/** Assumed minimum commits, as a share of our monthly bytes. */
export const COMMIT: Record<CdnId, number> = { A: 0.4, B: 0.35, C: 0.25 };
/** Exploration floor per healthy CDN per region (9.9.4: shares, not a single winner). */
export const FLOOR = 0.05;
const TEMP = 0.07;

/** QoE score 0..100 for one cell. Assumed teaching formula: throughput headroom over a ~4 Mbps stream, minus an error penalty. */
export function cellQoe(c: Cell): number {
  const headroom = 1 - Math.exp(-c.thr / 8);
  const errPenalty = Math.min(0.9, c.err * 0.25);
  return 100 * headroom * (1 - errPenalty);
}

export interface Weights { perf: number; cost: number; avail: number }
export interface PolicyResult {
  shares: Record<CdnId, number>[]; // per region, sums to 1
  forced: Record<CdnId, number>[]; // per region, share added by commits
  global: Record<CdnId, number>;
  pricePerGb: number;
  qoe: number;
  regionQoe: number[];
  regionPrice: number[];
  commitUnmet: CdnId[];
}

const zero = (): Record<CdnId, number> => ({ A: 0, B: 0, C: 0 });

/** Explainable per-cell score in 0..1 (9.9.4), from normalised performance, cost and availability. */
export function scores(r: Region, w: Weights): Record<CdnId, number> {
  const maxThr = Math.max(...CDNS.map((c) => r.cells[c].thr));
  const minPrice = Math.min(...CDNS.map((c) => r.cells[c].price));
  const minErr = Math.min(...CDNS.map((c) => r.cells[c].err));
  const tot = w.perf + w.cost + w.avail || 1;
  const out = zero();
  for (const c of CDNS) {
    const x = r.cells[c];
    out[c] = (w.perf * (x.thr / maxThr) + w.cost * (minPrice / x.price) + w.avail * (minErr / x.err)) / tot;
  }
  return out;
}

export function runPolicy(w: Weights, commits: Record<CdnId, boolean>): PolicyResult {
  const sc = REGIONS.map((r) => scores(r, w));
  const shares = sc.map((s) => {
    const e = CDNS.map((c) => Math.exp(s[c] / TEMP));
    const sum = e.reduce((a, b) => a + b, 0);
    const o = zero();
    CDNS.forEach((c, i) => { o[c] = FLOOR + (1 - FLOOR * CDNS.length) * (e[i] / sum); });
    return o;
  });
  const forced = REGIONS.map(zero);
  const glob = () => { const g = zero(); REGIONS.forEach((r, i) => CDNS.forEach((c) => { g[c] += r.weight * shares[i][c]; })); return g; };

  // Commit enforcement (9.9.6): move traffic onto a CDN that is behind on commit, taking it from the cell
  // where the score loss is smallest ("raise A's share in cells where A ties the best").
  const STEP = 0.002;
  const unmet: CdnId[] = [];
  for (let iter = 0; iter < 3000; iter++) {
    const g = glob();
    const behind = CDNS.filter((c) => commits[c] && g[c] < COMMIT[c] - 1e-6 && !unmet.includes(c))
      .sort((a, b) => (COMMIT[b] - g[b]) - (COMMIT[a] - g[a]));
    if (!behind.length) break;
    const c = behind[0];
    let best: { i: number; d: CdnId; loss: number } | null = null;
    REGIONS.forEach((r, i) => {
      for (const d of CDNS) {
        if (d === c || shares[i][d] - FLOOR < 1e-6) continue;
        if (commits[d] && g[d] - STEP < COMMIT[d]) continue;
        const loss = sc[i][d] - sc[i][c];
        if (!best || loss < best.loss) best = { i, d, loss };
      }
    });
    if (!best) { unmet.push(c); continue; }
    const { i, d } = best as { i: number; d: CdnId; loss: number };
    const r = REGIONS[i];
    const amt = Math.min(STEP, COMMIT[c] - g[c], r.weight * (shares[i][d] - FLOOR)) / r.weight;
    shares[i][d] -= amt; shares[i][c] += amt; forced[i][c] += amt;
  }

  const regionQoe = REGIONS.map((r, i) => CDNS.reduce((a, c) => a + shares[i][c] * cellQoe(r.cells[c]), 0));
  const regionPrice = REGIONS.map((r, i) => CDNS.reduce((a, c) => a + shares[i][c] * r.cells[c].price, 0));
  return {
    shares, forced, global: glob(),
    qoe: REGIONS.reduce((a, r, i) => a + r.weight * regionQoe[i], 0),
    pricePerGb: REGIONS.reduce((a, r, i) => a + r.weight * regionPrice[i], 0),
    regionQoe, regionPrice, commitUnmet: unmet,
  };
}

/** Sweep from "all performance" to "all cost", keeping availability and the commit set. For the trade-off plot. */
export function frontier(w: Weights, commits: Record<CdnId, boolean>, n = 24) {
  const pc = w.perf + w.cost || 1;
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n;
    const r = runPolicy({ perf: pc * (1 - t), cost: pc * t, avail: w.avail }, commits);
    return { price: r.pricePerGb, qoe: r.qoe };
  });
}

/* ------------------------------------------------------------------ Outage ------------------------------------------------------------------ */

export type MethodId = "dns" | "api" | "client" | "cs" | "combo";
export interface Method { id: MethodId; label: string; short: string; color: string }
export const METHODS: Method[] = [
  { id: "dns", label: "DNS weighted", short: "DNS", color: "var(--p5)" },
  { id: "api", label: "Playback API at session start", short: "Playback API", color: "var(--p3)" },
  { id: "client", label: "Player failover on errors", short: "Player failover", color: "var(--p2)" },
  { id: "cs", label: "Content Steering (server update)", short: "Content Steering", color: "var(--p1)" },
  { id: "combo", label: "Combination (book's design)", short: "Combination", color: "var(--p4)" },
];

/** Outage assumptions. Cited values are marked; everything else is assumed. */
export const OUT = {
  aShare: 0.4,          // CDN A carries 40% of LatAm sessions before the outage (assumed)
  detect: 1.0,          // min: steering decides after two 30 s aggregation intervals (9.8, 9.9.4 gate; timing assumed)
  dnsTtl: 5,            // min: DNS answer TTL 300 s (the scenario)
  dnsTail: 15,          // min: resolvers that ignore TTL; switch delays of 300 s to 15 min reported (SMPTE 2025 [3])
  dnsIgnoreFrac: 0.3,   // share of sessions behind TTL-ignoring resolvers or device caches (assumed)
  restartRate: 0.35,    // per min: a stalled viewer presses play again (assumed)
  failoverMin: 0.1,     // min: 6 s, first failed segment plus retries (assumed)
  failoverMax: 0.4,     // min: 24 s (assumed)
  modern: 0.85,         // players with Content Steering and error failover (assumed; see 9.7.4 support list)
  failoverOnly: 0.09,   // custom players with failover but no Content Steering (assumed)
  legacy: 0.06,         // old players with neither (assumed)
};

const dnsLeft = (t: number) => {
  if (t <= OUT.detect) return 1;
  const s = t - OUT.detect;
  return (1 - OUT.dnsIgnoreFrac) * Math.max(0, 1 - s / OUT.dnsTtl) + OUT.dnsIgnoreFrac * Math.max(0, 1 - s / OUT.dnsTail);
};
const restartLeft = (t: number) => (t <= OUT.detect ? 1 : Math.exp(-OUT.restartRate * (t - OUT.detect)));
const failoverLeft = (t: number) => Math.min(1, Math.max(0, 1 - (t - OUT.failoverMin) / (OUT.failoverMax - OUT.failoverMin)));
const reloadLeft = (t: number, ttlMin: number) => (t <= OUT.detect ? 1 : Math.max(0, 1 - (t - OUT.detect) / ttlMin));

/** Fraction of CDN A's LatAm sessions still failing at minute t (0..1). */
export function leftOnA(m: MethodId, t: number, csTtlSec: number): number {
  const ttl = csTtlSec / 60;
  switch (m) {
    case "dns": return dnsLeft(t);
    case "api": return restartLeft(t);
    case "client": return (OUT.modern + OUT.failoverOnly) * failoverLeft(t) + OUT.legacy;
    case "cs": return OUT.modern * reloadLeft(t, ttl) + (1 - OUT.modern);
    case "combo": return (OUT.modern + OUT.failoverOnly) * failoverLeft(t) + OUT.legacy * restartLeft(t) * dnsLeft(t);
  }
}

export const T_END = 10;

export interface MethodStats { drain90: number | null; at5: number; lostMin: number }
export function methodStats(m: MethodId, csTtlSec: number): MethodStats {
  let drain90: number | null = null, lost = 0;
  const dt = 0.01;
  for (let t = 0; t <= T_END + 1e-9; t += dt) {
    const f = leftOnA(m, t, csTtlSec);
    if (drain90 === null && f <= 0.1 + 1e-9) drain90 = t;
    lost += f * OUT.aShare * 1000 * dt; // failing session-minutes per 1,000 LatAm sessions
  }
  return { drain90, at5: leftOnA(m, 5, csTtlSec) * OUT.aShare, lostMin: lost };
}

export function seriesPoints(m: MethodId, csTtlSec: number, upTo: number): [number, number][] {
  const pts: [number, number][] = [[0, OUT.aShare * 100]];
  const step = 0.05;
  for (let t = step; t <= upTo + 1e-9; t += step) pts.push([t, leftOnA(m, t, csTtlSec) * OUT.aShare * 100]);
  if (upTo > 0 && pts[pts.length - 1][0] < upTo) pts.push([upTo, leftOnA(m, upTo, csTtlSec) * OUT.aShare * 100]);
  return upTo <= 0 ? [] : pts;
}
