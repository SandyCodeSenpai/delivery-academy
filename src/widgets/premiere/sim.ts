/**
 * Simulcast premiere model. Pure and deterministic: config in, one sample per second out.
 * Every constant is ASSUMED (the book's Crunchyroll model, chapters 8 and 13) unless noted.
 */

export interface Cfg {
  /** Peak concurrent streams on the whole platform (book: ~2M at a big premiere). */
  peak: number;
  /** Minutes until the premiere audience is ~95% arrived. */
  rampMin: number;
  /** First N segments pushed to shields and edges before T0 (0 = no pre-warm). */
  prewarm: number;
  /** Player start jitter window in seconds (0 = everyone starts at the same second). */
  jitter: number;
  collapse: boolean;
  shield: boolean;
  cdns: 1 | 2 | 3;
  /** Capacity reserved with each CDN for the event, in Tbps. */
  reservedTbps: number;
  /** Login/entitlement caching + DRM license rate limiting + player backoff. */
  protect: boolean;
}

export type PresetId = "naive" | "playbook";
export const PRESETS: Record<PresetId, Cfg> = {
  naive: { peak: 2e6, rampMin: 10, prewarm: 0, jitter: 0, collapse: false, shield: false, cdns: 1, reservedTbps: 6, protect: false },
  playbook: { peak: 2e6, rampMin: 10, prewarm: 10, jitter: 45, collapse: true, shield: true, cdns: 3, reservedTbps: 4, protect: true },
};
export const sameCfg = (a: Cfg, b: Cfg) => (Object.keys(a) as (keyof Cfg)[]).every((k) => a[k] === b[k]);
export const presetOf = (c: Cfg): PresetId | null => (sameCfg(c, PRESETS.naive) ? "naive" : sameCfg(c, PRESETS.playbook) ? "playbook" : null);

// ---- assumed constants ----
export const T_START = -1800, T_END = 1800;
export const BITRATE = 4e6;               // 4 Mbps average
export const QUOTA_GBPS = 150;             // CloudFront default per distribution (book [24])
export const QUOTA_RPS = 250_000;          // CloudFront default per distribution (book [24])
export const POPS = 100, SERVERS = 30;     // per CDN, per PoP (book 13.2.4)
export const HOT_OBJECTS = 48;             // (3 x 7 + 3) x 2 (book 13.2.4)
export const TRACKS = 16;                  // (7 video + 1 audio) x 2 encryption variants
export const ORIGIN_CAP = 50_000;          // origin req/s
export const AUTH_CAP = 8_000;             // sign-in / session checks per s
export const API_CAP = 15_000;             // playback API per s
export const LIC_CAP = 25_000;             // DRM license per s (often the vendor's rate limit)
export const RENEW_S = 300;
export const LIC_PER_START = 2;            // audio + video keys (book ch. 8: 1-2 per start)                // license renewal interval (book ch. 8)
export const COUNTDOWN_SHARE = 0.05;       // share of the premiere audience waiting on the countdown
export const RETRY_NOW = 0.6;             // share of failed starts that retry within a second when there is no backoff
export const SPLITS: Record<1 | 2 | 3, number[]> = { 1: [1], 2: [0.55, 0.45], 3: [0.4, 0.35, 0.25] };

export interface Sample {
  t: number;
  watching: number; forecast: number;
  egress: number;          // bps
  busiest: number;         // busiest CDN load / its reservation
  origin: number; originCap: number;
  err: number;             // 0..1
  auth: number; api: number; lic: number; renew: number;
  starts: number;          // attempted premiere starts per s (incl. retries)
  newStarts: number;       // real new demand per s
  fAuth: number; fLic: number; fOrigin: number; fCdn: number;
}

export interface Summary {
  peakErr: number; peakErrT: number;
  peakOrigin: number; peakOriginT: number; originFirst10s: number;
  peakLic: number; peakAuth: number; peakApi: number; peakStarts: number; peakEgress: number;
  maxAttemptRatio: number; storm: boolean;
  signInShare: number; failShares: { signin: number; api: number; license: number; video: number; cdn: number };
  cdnSatT: number | null; originMeltT: number | null; authFailT: number | null; licFailT: number | null;
  recoverT: number | null; peakReachedT: number | null;
  fetchersPerObject: number; coldAtT0: number; totalReserved: number; peakNeed: number;
}

export function fetchers(c: Cfg) { return c.cdns * (c.shield ? 1 : POPS) * (c.collapse ? 1 : SERVERS); }
/** Share of the T0 hot objects already warm thanks to pre-warm. Edge-only pre-warm reaches only some PoPs. */
export function coverage(c: Cfg) { return Math.min(1, c.prewarm / 3) * (c.shield ? 1 : 0.5); }

export function simulate(c: Cfg): { samples: Sample[]; sum: Summary } {
  const P = c.peak / 2, B = c.peak / 2;                 // premiere audience, other titles
  const tau = (c.rampMin * 60) / 3;
  const crowd = P * COUNTDOWN_SHARE, w = Math.max(2, c.jitter);
  const baseStarts = B / 1440;                           // starts on other titles (24-min episodes)
  const F = fetchers(c), cov = coverage(c);
  const split = SPLITS[c.cdns], resBps = c.reservedTbps * 1e12;
  const authPer = c.protect ? 0.05 : 1.3, apiPer = c.protect ? 0.3 : 1;

  let concP = 0, cold = 1 - cov, fOprev = 0;
  // Overloaded services lose goodput (exhausted pools, timeouts) and recover slowly: a metastable failure.
  const melt = { auth: 0, api: 0, lic: 0, origin: 0 };
  const svc = (k: keyof typeof melt, cap: number, load: number) => {
    const eff = cap * (1 - 0.6 * melt[k]);
    const f = load > 0 ? Math.max(0, 1 - eff / load) : 0;
    melt[k] = Math.min(1, Math.max(0, melt[k] + (f > 0.25 ? 1 / 12 : f < 0.02 ? -1 / 150 : 0)));
    return { f, eff };
  };
  let retryPool = 0, manualPool = 0, awayPool = 0, backoffPool = 0, licQ = 0;
  let forecastCum = 0;
  const fails = { signin: 0, api: 0, license: 0, video: 0, cdn: 0 };
  const out: Sample[] = [];
  const sum: Summary = {
    peakErr: 0, peakErrT: 0, peakOrigin: 0, peakOriginT: 0, originFirst10s: 0, peakLic: 0, peakAuth: 0, peakApi: 0, peakStarts: 0, peakEgress: 0,
    maxAttemptRatio: 1, storm: false, signInShare: 0, failShares: fails,
    cdnSatT: null, originMeltT: null, authFailT: null, licFailT: null, recoverT: null, peakReachedT: null,
    fetchersPerObject: F, coldAtT0: Math.round(HOT_OBJECTS * (1 - cov)), totalReserved: resBps * c.cdns, peakNeed: c.peak * BITRATE,
  };
  let wasBad = false;

  for (let t = T_START; t < T_END; t++) {
    // --- demand ---
    const organic = t >= 0 ? (P * (1 - COUNTDOWN_SHARE) * Math.exp(-t / tau)) / tau : 0;
    const burst = t >= 0 && t < w ? crowd / w : 0;
    const newStarts = organic + burst;
    forecastCum += newStarts;
    const retries = (c.protect ? backoffPool / 8 : retryPool + manualPool / 40) + awayPool / 600;
    awayPool -= awayPool / 600;
    if (c.protect) backoffPool -= backoffPool / 8; else { retryPool = 0; manualPool -= manualPool / 40; }
    const attempts = newStarts + retries;
    const allStarts = attempts + baseStarts;

    // --- control plane ---
    const preRefresh = c.protect && t >= -600 && t < 0 ? (P * 0.3) / 600 : 0;    // jittered token refresh before T0
    const prefetch = c.protect && t >= -300 && t < 0 ? (P * 0.5) / 300 : 0;     // playback info prefetched
    const auth = allStarts * authPer + preRefresh;
    const api = allStarts * apiPer + prefetch;
    const watching = B + concP;
    const renew = watching / RENEW_S;
    const licDemand = allStarts * LIC_PER_START + renew;
    const fAuth = svc("auth", AUTH_CAP, auth).f * Math.min(1, authPer);
    const fApi = svc("api", API_CAP, api).f;
    let fLic: number, lic: number;
    if (c.protect) {
      // rate limit + backoff: excess waits in a queue instead of failing; only very long waits time out
      // anything that would wait more than 10 s is rejected with a retry-after and comes back later
      licQ += licDemand; lic = Math.min(LIC_CAP, licQ); licQ -= lic;
      const rejected = Math.max(0, licQ - 10 * LIC_CAP); licQ -= rejected;
      fLic = Math.min(1, rejected / licDemand);
    } else { lic = licDemand; fLic = svc("lic", LIC_CAP, licDemand).f; }

    // --- origin ---
    const demand = t >= 0 ? Math.min(1, attempts / 1000) : 0;
    const burstOrigin = HOT_OBJECTS * cold * F * demand;
    const seg = Math.floor(t / 4);
    const progCold = t >= 12 && t < 1440 && seg >= c.prewarm ? 1 : t >= 12 && t < 1440 && !c.shield ? 0.5 : 0;
    const progressive = (TRACKS * F * 0.25 * progCold) / 4;
    const baseOrigin = B * 0.5 * (c.shield ? 0.003 : 0.02);
    const prewarmLoad = c.prewarm > 0 && t >= -1200 && t < -1140 ? (c.prewarm * TRACKS * c.cdns * (c.shield ? 1 : POPS)) / 60 : 0;
    const origin = baseOrigin + prewarmLoad + (burstOrigin + progressive) * (1 + (c.collapse ? 0 : 1.5 * fOprev));
    const { f: fO, eff: originCap } = svc("origin", ORIGIN_CAP, origin);
    const fSeg = t >= 0 ? cold * fO : 0;
    if (t >= 0 && demand > 0) cold *= 1 - (1 - fO) * 0.5;
    fOprev = fO;

    // --- start outcome (steps in order: sign-in, playback API, license, first segments) ---
    const pA = fAuth, pB = (1 - pA) * fApi, pC = (1 - pA) * (1 - fApi) * fLic, pD = (1 - pA) * (1 - fApi) * (1 - fLic) * fSeg;
    const fStart = pA + pB + pC + pD;
    const fBase = pA + pB + pC;                     // other titles are already warm
    const failed = attempts * fStart;
    concP = Math.min(P, concP + attempts - failed);
    // no backoff: most retry at once, some press play again later, a few walk away for ~10 min
    if (c.protect) { backoffPool += failed * 0.95; awayPool += failed * 0.05; } else { retryPool += failed * RETRY_NOW; manualPool += failed * 0.3; awayPool += failed * (0.7 - RETRY_NOW); }

    // --- CDN egress ---
    const egress = (B + concP) * BITRATE;
    let fCdn = 0, busiest = 0;
    for (const s of split) { const load = s * egress; busiest = Math.max(busiest, load / resBps); fCdn += s * Math.max(0, 1 - resBps / load); }

    const fStartAll = allStarts > 0 ? (attempts * fStart + baseStarts * fBase) / allStarts : 0;
    const err = 1 - (1 - fStartAll) * (1 - fCdn);

    // forecast = what concurrency would be with zero failures
    const forecast = B + Math.min(P, forecastCum);
    out.push({ t, watching: B + concP, forecast, egress, busiest, origin, originCap, err, auth, api, lic, renew, starts: attempts, newStarts, fAuth, fLic, fOrigin: fO, fCdn });

    // --- summary ---
    const n = attempts + baseStarts;
    // failed starts by the step that broke (what a viewer would report on Downdetector)
    fails.signin += n * pA; fails.api += n * pB; fails.license += n * pC; fails.video += attempts * pD;
    fails.cdn += fCdn * newStarts;   // starts that land on an overloaded CDN and buffer
    if (err > sum.peakErr) { sum.peakErr = err; sum.peakErrT = t; }
    if (origin > sum.peakOrigin) { sum.peakOrigin = origin; sum.peakOriginT = t; }
    if (t >= 0 && t < 10) sum.originFirst10s += origin;
    sum.peakLic = Math.max(sum.peakLic, lic); sum.peakAuth = Math.max(sum.peakAuth, auth); sum.peakApi = Math.max(sum.peakApi, api);
    sum.peakStarts = Math.max(sum.peakStarts, attempts); sum.peakEgress = Math.max(sum.peakEgress, egress);
    if (t >= 0 && t < 120 && newStarts > 200) sum.maxAttemptRatio = Math.max(sum.maxAttemptRatio, attempts / newStarts);
    if (sum.cdnSatT === null && fCdn > 0.002) sum.cdnSatT = t;
    if (sum.originMeltT === null && fO > 0.05) sum.originMeltT = t;
    if (sum.authFailT === null && fAuth > 0.05) sum.authFailT = t;
    if (sum.licFailT === null && (c.protect ? lic >= LIC_CAP * 0.98 : fLic > 0.05)) sum.licFailT = t;
    if (err > 0.005) wasBad = true; else if (wasBad && sum.recoverT === null && t > 0) sum.recoverT = t;
    if (sum.peakReachedT === null && concP >= P * 0.95) sum.peakReachedT = t;
  }
  sum.storm = sum.maxAttemptRatio > 2;
  const total = fails.signin + fails.api + fails.license + fails.video + fails.cdn;
  sum.signInShare = total > 0 ? fails.signin / total : 0;
  return { samples: out, sum };
}

/** Wall-clock speed of story mode: sim seconds per real second. Slow near T0, fast in the quiet parts. */
export function speedAt(t: number) { return t < -60 ? 320 : t < 120 ? 22 : t < 600 ? 120 : 420; }
