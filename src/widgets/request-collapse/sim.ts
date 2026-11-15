/**
 * Request-collapsing simulation (pure, deterministic).
 *
 * Model (all numbers ASSUMED unless noted):
 * - A burst of N viewers asks for segment 1 of a new episode within about 3 s (front-loaded: most press play in the first second).
 * - Viewers are spread over P edge PoPs. Each PoP behaves as one cache cluster (PoP-wide collapsing, like Fastly clustering).
 * - Optional shield PoP between the edges and the origin. When present, the shield always collapses.
 * - Origin = object storage with a base response time T and a queue that drains at 5,500 GET/s for one prefix
 *   (the S3 per-prefix rate cited in Chapter 6). Above that rate, requests queue and response time grows.
 * - Players give up on a segment after 10 s.
 * - A 200 is cached as soon as it arrives. A 403/404/5xx with no-store is not cacheable.
 *
 * Counts are tracked per 10 ms tick in typed arrays so the stage can replay the run as particles.
 */

export type Answer = 200 | 403 | 404 | 503;
export type Policy = "share" | "serialize" | "hfp";
export interface Config { burst: number; pops: number; edgeCollapse: boolean; shield: boolean; originMs: number; answer: Answer; policy: Policy }

export const DT = 0.01;               // s per tick
export const ARRIVAL_WINDOW = 3;      // s
export const TIMEOUT = 10;            // s, player segment timeout (assumed)
export const MAX_T = ARRIVAL_WINDOW + TIMEOUT + 1;
export const NT = Math.ceil(MAX_T / DT);
export const ORIGIN_RATE = 5500;      // GET/s for one prefix (Chapter 6, S3)
export const HFP_TTL = 120;           // s, Fastly hit-for-pass default (Chapter 5)
export const SEGMENT_BYTES = 2.5e6;   // bytes, top-rendition segment (Chapter 5 example)
export const RTT = { viewer: 0.02, edgeShield: 0.04, shieldOrigin: 0.01, edgeOrigin: 0.06 };
const TAU = 0.4;                      // arrival shape t*exp(-t/TAU)

interface Group { t: number; k: number; ok: boolean; timeout?: boolean }
type Up = (t: number, k: number) => Group[];

export interface Rec {
  arrivals: Float32Array[];   // [pop][tick] viewer requests arriving at the edge
  edgeUp: Float32Array[];     // requests the edge sends upstream
  edgeBack: Float32Array[];   // upstream responses arriving at the edge (ok)
  edgeBackErr: Float32Array[];
  shieldUp: Float32Array;     // shield -> origin
  shieldBack: Float32Array;   // origin -> shield (ok)
  shieldBackErr: Float32Array;
  served: Float32Array[];     // responses delivered to viewers (ok)
  servedErr: Float32Array[];  // error responses delivered to viewers
  waiting: Float32Array[];    // viewers waiting at each PoP (level, not flow)
  upCum: Float32Array[];      // cumulative requests sent upstream by each PoP
  originRps: Float32Array;    // requests reaching origin, per second (100 ms window)
  originCum: Float32Array;    // cumulative requests reaching origin
  inflight: Float32Array;     // requests in flight at the origin (level)
  cachedAt: number[];         // per PoP, time the segment became a cache hit (Infinity = never)
  shieldCachedAt: number;
}

export interface Result {
  cfg: Config;
  rec: Rec;
  endT: number;               // last interesting sim time (s)
  originRequests: number;
  peakRps: number;            // requests/s at the origin, 100 ms window
  peakInflight: number;
  waitedMedian: number;       // s, median time to first byte for viewers who waited (not cache hits), 0 if none
  p50: number; p99: number;   // s, all viewers (timeouts count as TIMEOUT)
  waitedShare: number;        // share of viewers who missed and waited
  errorShare: number;         // got an error or timed out
  timeoutShare: number;
  hist: number[];             // counts per bucket, see BUCKETS
  firstByteSpread: number;    // s, p90 - p10 of the moment waiting viewers received bytes
}

/** TTFB buckets for the distribution bar. The last bucket is errors and timeouts. */
export const BUCKETS: { label: string; max: number; color: string }[] = [
  { label: "Cache hit", max: 0.05, color: "var(--good)" },
  { label: "Under 0.3 s", max: 0.3, color: "var(--p1)" },
  { label: "0.3 to 1 s", max: 1, color: "var(--p3)" },
  { label: "1 to 3 s", max: 3, color: "var(--p4)" },
  { label: "Over 3 s", max: Infinity, color: "var(--warn)" },
  { label: "Error or timeout", max: NaN, color: "var(--bad)" },
];

const tick = (t: number) => Math.max(0, Math.min(NT - 1, Math.floor(t / DT + 1e-9)));
const maxT = (gs: Group[]) => gs.reduce((m, g) => Math.max(m, g.t), -Infinity);
const minT = (gs: Group[]) => gs.reduce((m, g) => Math.min(m, g.t), Infinity);
const arr = () => new Float32Array(NT);

/** Seeded RNG local to the sim, so runs repeat exactly. */
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

interface TierOpts { collapse: boolean; policy: Policy; rtt: number; up: Up; onUp: (t: number, k: number) => void; onBack: (g: Group) => void }
interface Tier { request: (t: number, k: number) => Group[]; cachedAt: () => number }

/** One caching tier (an edge PoP or the shield): cache, waiting list, and the three uncacheable-answer policies. */
function makeTier(o: TierOpts): Tier {
  let cachedAt = Infinity, inflightDone = -Infinity, inflightOk = true, hfpUntil = -Infinity, chainEnd = -Infinity;
  const half = o.rtt / 2;
  const fetch = (t: number, k: number): Group[] => {
    o.onUp(t, k);
    const gs = o.up(t + half, k).map((g) => ({ ...g, t: g.t + half }));
    gs.forEach(o.onBack);
    return gs;
  };
  /** Requests that arrive while a collapsed fetch is in flight. */
  const waitOn = (t: number, k: number): Group[] => {
    if (inflightOk) return [{ t: inflightDone, k, ok: true }];
    if (o.policy === "share") return [{ t: inflightDone, k, ok: false }];
    if (o.policy === "hfp") return fetch(inflightDone, k); // released to go upstream in parallel
    // serialize: the answer served only its own request; the waiters form a new line, one fetch at a time
    const out: Group[] = [];
    let start = Math.max(chainEnd, inflightDone), left = k;
    while (left > 0) {
      if (start - t > TIMEOUT) { out.push({ t: t + TIMEOUT, k: left, ok: false, timeout: true }); break; }
      const gs = fetch(start, 1);
      const done = maxT(gs);
      out.push({ t: done, k: 1, ok: gs[0].ok });
      start = done; left--;
    }
    chainEnd = Math.max(chainEnd, start);
    inflightDone = Math.max(inflightDone, chainEnd);
    return out;
  };
  const request = (t: number, k: number): Group[] => {
    if (k <= 0) return [];
    if (t >= cachedAt) return [{ t, k, ok: true }];
    if (!o.collapse || t < hfpUntil) {
      const gs = fetch(t, k);
      if (gs.every((g) => g.ok)) cachedAt = Math.min(cachedAt, minT(gs));
      return gs;
    }
    if (t < inflightDone) return waitOn(t, k);
    // first request for this key: one fetch upstream, everyone else joins its waiting list
    const gs = fetch(t, 1);
    const done = maxT(gs), ok = gs.every((g) => g.ok);
    inflightDone = done; inflightOk = ok;
    if (ok) cachedAt = done;
    else if (o.policy === "hfp") hfpUntil = done + HFP_TTL;
    const first: Group[] = [{ t: done, k: 1, ok }];
    return k > 1 ? first.concat(waitOn(t, k - 1)) : first;
  };
  return { request, cachedAt: () => cachedAt };
}

export function simulate(cfg: Config): Result {
  const P = cfg.pops, T = cfg.originMs / 1000, okAnswer = cfg.answer === 200;
  const rec: Rec = {
    arrivals: [], edgeUp: [], edgeBack: [], edgeBackErr: [], served: [], servedErr: [], waiting: [], upCum: [],
    shieldUp: arr(), shieldBack: arr(), shieldBackErr: arr(), originRps: arr(), originCum: arr(), inflight: arr(),
    cachedAt: [], shieldCachedAt: Infinity,
  };
  for (let p = 0; p < P; p++) {
    rec.arrivals.push(arr()); rec.edgeUp.push(arr()); rec.edgeBack.push(arr()); rec.edgeBackErr.push(arr());
    rec.served.push(arr()); rec.servedErr.push(arr()); rec.waiting.push(arr()); rec.upCum.push(arr());
  }
  const originIn = arr();

  // ---- origin: FIFO queue draining at ORIGIN_RATE, base latency T
  let backlogEnd = 0;
  const origin: Up = (t, k) => {
    originIn[tick(t)] += k;
    const start = Math.max(t, backlogEnd), span = k / ORIGIN_RATE;
    backlogEnd = start + span;
    const n = Math.min(k, 4), base = Math.floor(k / n);
    const out: Group[] = [];
    for (let i = 0; i < n; i++) {
      const kk = base + (i < k - base * n ? 1 : 0);
      const done = start + T + (span * (i + 0.5)) / n;
      out.push({ t: done, k: kk, ok: okAnswer });
      rec.inflight[tick(t)] += kk; rec.inflight[tick(done)] -= kk;
    }
    return out;
  };

  // ---- shield (always collapses when present)
  const shield = cfg.shield ? makeTier({
    collapse: true, policy: cfg.policy, rtt: RTT.shieldOrigin, up: origin,
    onUp: (t, k) => { rec.shieldUp[tick(t)] += k; },
    onBack: (g) => { (g.ok ? rec.shieldBack : rec.shieldBackErr)[tick(g.t)] += g.k; },
  }) : null;

  // ---- edges
  const edges = Array.from({ length: P }, (_, p) => makeTier({
    collapse: cfg.edgeCollapse, policy: cfg.policy,
    rtt: shield ? RTT.edgeShield : RTT.edgeOrigin,
    up: shield ? shield.request : origin,
    onUp: (t, k) => { rec.edgeUp[p][tick(t)] += k; },
    onBack: (g) => { (g.ok ? rec.edgeBack[p] : rec.edgeBackErr[p])[tick(g.t)] += g.k; },
  }));

  // ---- arrivals: integer counts per PoP per tick, PoPs have slightly different sizes
  const r = lcg(7);
  const weights = Array.from({ length: P }, () => 0.7 + r() * 0.6);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const arrTicks = Math.round(ARRIVAL_WINDOW / DT);
  const cdf = (t: number) => 1 - Math.exp(-t / TAU) * (1 + t / TAU);
  const cdfEnd = cdf(ARRIVAL_WINDOW);
  const shares = weights.map((w) => w / wSum);
  // distribute N across PoPs exactly
  const popN = shares.map((s) => Math.floor(cfg.burst * s));
  let rem = cfg.burst - popN.reduce((a, b) => a + b, 0);
  for (let p = 0; rem > 0; p = (p + 1) % P, rem--) popN[p]++;

  const ttfb: [number, number][] = [];      // [seconds, count]
  const firstBytes: [number, number][] = []; // [absolute time, count] for waiters
  let errors = 0, timeouts = 0, waited = 0;
  const hist = BUCKETS.map(() => 0);
  let endT = 0;

  for (let i = 0; i < arrTicks; i++) {
    const t = i * DT;
    for (let p = 0; p < P; p++) {
      const k = Math.round((popN[p] * cdf((i + 1) * DT)) / cdfEnd) - Math.round((popN[p] * cdf(i * DT)) / cdfEnd);
      if (k <= 0) continue;
      rec.arrivals[p][i] += k;
      for (const g of edges[p].request(t, k)) {
        const wait = g.t - t + RTT.viewer;
        const isTimeout = !!g.timeout || wait > TIMEOUT;
        const tEnd = isTimeout ? t + TIMEOUT : g.t;
        if (g.t > t + 1e-9) { rec.waiting[p][i] += g.k; rec.waiting[p][tick(tEnd)] -= g.k; waited += g.k; }
        if (isTimeout) { timeouts += g.k; errors += g.k; hist[5] += g.k; ttfb.push([TIMEOUT, g.k]); endT = Math.max(endT, tEnd); continue; }
        (g.ok ? rec.served[p] : rec.servedErr[p])[tick(g.t)] += g.k;
        ttfb.push([wait, g.k]);
        if (g.t > t + 1e-9) firstBytes.push([g.t, g.k]);
        if (!g.ok) { errors += g.k; hist[5] += g.k; }
        else hist[BUCKETS.findIndex((b) => wait < b.max)] += g.k;
        endT = Math.max(endT, g.t);
      }
    }
  }
  // origin traffic continues after viewers give up (serialized line, released waiters), so include it
  for (let i = NT - 1; i >= 0; i--) if (originIn[i] > 0 || rec.inflight[i] !== 0) { endT = Math.max(endT, i * DT); break; }
  endT = Math.min(MAX_T, Math.max(endT, ARRIVAL_WINDOW * 0.6));

  // ---- integrate levels and windows
  let originRequests = 0, peakRps = 0, peakInflight = 0;
  const W = Math.round(0.1 / DT);
  for (let i = 0; i < NT; i++) {
    originRequests += originIn[i];
    rec.originCum[i] = originRequests;
    if (i > 0) rec.inflight[i] += rec.inflight[i - 1];
    peakInflight = Math.max(peakInflight, rec.inflight[i]);
    const win = rec.originCum[i] - (i >= W ? rec.originCum[i - W] : 0);
    rec.originRps[i] = win * 10;
    peakRps = Math.max(peakRps, rec.originRps[i]);
  }
  for (let p = 0; p < P; p++) {
    let up = 0;
    for (let i = 0; i < NT; i++) {
      if (i > 0) rec.waiting[p][i] += rec.waiting[p][i - 1];
      up += rec.edgeUp[p][i]; rec.upCum[p][i] = up;
    }
    rec.cachedAt.push(edges[p].cachedAt());
  }
  rec.shieldCachedAt = shield ? shield.cachedAt() : Infinity;

  // ---- percentiles
  const pct = (pairs: [number, number][], q: number) => {
    if (!pairs.length) return 0;
    const s = [...pairs].sort((a, b) => a[0] - b[0]);
    const total = s.reduce((a, b) => a + b[1], 0);
    let c = 0;
    for (const [v, k] of s) { c += k; if (c >= q * total) return v; }
    return s[s.length - 1][0];
  };
  const waitedPairs = ttfb.filter(([v]) => v > RTT.viewer + 1e-6);
  const N = cfg.burst;
  return {
    cfg, rec, endT, originRequests: Math.round(originRequests), peakRps, peakInflight: Math.round(peakInflight),
    waitedMedian: pct(waitedPairs, 0.5), p50: pct(ttfb, 0.5), p99: pct(ttfb, 0.99),
    waitedShare: waited / N, errorShare: errors / N, timeoutShare: timeouts / N, hist,
    firstByteSpread: firstBytes.length ? pct(firstBytes, 0.9) - pct(firstBytes, 0.1) : 0,
  };
}

/** Which tiers collapse at all. */
export const anyCollapse = (c: Config) => c.edgeCollapse || c.shield;
