/**
 * Delivery Playground: the simulation model.
 *
 * Pure functions only. No React, no DOM. Everything the stage draws and every
 * number the stats show comes from `simulateRequest` (one viewer, hop by hop) or
 * `simulateTraffic` (many viewers, steady flow).
 *
 * Every constant below is an ASSUMPTION in the spirit of the book's traffic model
 * (Chapter 1, Chapter 18.4). Nothing here is a published Crunchyroll number.
 */

export type Region = "tokyo" | "saopaulo" | "frankfurt" | "la";
export type Cdn = "A" | "B";
export type Content = "premiere" | "popular" | "longtail";
export type SteerMode = "performance" | "cost" | "manual";
export type Layer = "edge" | "shield";

export interface Faults {
  cdnAOutage: boolean;   // every CDN A edge returns errors (like Fastly, June 2021)
  shieldADown: boolean;  // CDN A's shield location is gone; A's edges go straight to origin
  awsDown: boolean;      // S3 us-west-2 is unreachable; shields fail over to GCS us-central1
  replLag: boolean;      // the new episode has not been copied to GCS yet
  slowOrigin: boolean;   // S3 answers, but slowly (about 1.2 s to first byte)
}

export interface PgState {
  region: Region;
  content: Content;
  edgeWarm: boolean;
  shieldWarm: boolean;
  /** Cache keys filled by requests the reader played ("edge:A:tokyo:popular", "shield:A:popular"). */
  filled: string[];
  faults: Faults;
  steer: SteerMode;
  /** Manual mode only: share of sessions sent to CDN A, 0..1. */
  splitA: number;
  /** Viewers slider position, log10(viewers), 0..log10(2M). */
  viewersLog: number;
  /** Segment duration in seconds (the book uses 4 to 6). */
  segSec: 4 | 6;
}

export const NO_FAULTS: Faults = { cdnAOutage: false, shieldADown: false, awsDown: false, replLag: false, slowOrigin: false };

export const MAX_VIEWERS = 2_000_000;
export const MAX_LOG = Math.log10(MAX_VIEWERS);
export const viewersFromLog = (l: number) => Math.round(Math.pow(10, l));
export const logFromViewers = (v: number) => Math.log10(Math.max(1, v));

export const INITIAL: PgState = {
  region: "tokyo", content: "popular", edgeWarm: true, shieldWarm: true, filled: [],
  faults: NO_FAULTS, steer: "performance", splitA: 0.5, viewersLog: logFromViewers(1_000_000), segSec: 4,
};

/* ------------------------------------------------------------------ */
/* Assumptions (all labelled "assumed" in the UI)                       */
/* ------------------------------------------------------------------ */

export const BITRATE_BPS = 4e6;          // average stream ~4 Mbps (book model)
export const POPS_PER_REGION = 20;       // each PoP dot on the stage stands for ~20 PoPs per CDN in that region
export const CDN_CAPACITY_BPS = 6e12;    // reserved capacity per CDN: 6 Tbps (so 2M viewers = 8 Tbps does NOT fit on one)
export const S3_PREFIX_RPS = 5_500;      // S3 GETs per second per prefix before "503 Slow Down"
export const ORIGIN_TIMEOUT_MS = 2_000;  // shield's connect timeout before origin failover (book 18.6.12)
export const WARM_SHARE = 0.1;           // minimum share that keeps a CDN's caches warm (book 18.6.5)
export const T0_OBJECTS = 25;            // objects every player needs in the first seconds of a premiere (book 6.5.4)
export const NEG_CACHE_S = 10;           // a 404 is cached for ~10 s (book 18.6.5), so each object is re-asked at most every 10 s

export const REGIONS: Region[] = ["tokyo", "saopaulo", "frankfurt", "la"];
export const CDNS: Cdn[] = ["A", "B"];

export const REGION_NAME: Record<Region, string> = { tokyo: "Tokyo", saopaulo: "Sao Paulo", frankfurt: "Frankfurt", la: "Los Angeles" };
export const REGION_SHORT: Record<Region, string> = { tokyo: "Tokyo", saopaulo: "Sao Paulo", frankfurt: "Frankfurt", la: "LA" };
/** Where the viewers are (assumed). */
export const REGION_MIX: Record<Region, number> = { tokyo: 0.15, saopaulo: 0.2, frankfurt: 0.25, la: 0.4 };

export const CDN_NAME: Record<Cdn, string> = { A: "CDN A", B: "CDN B" };
export const CDN_LIKE: Record<Cdn, string> = { A: "Fastly-like", B: "CloudFront-like" };
/** Delivery price per GB (assumed; the book's blended range is $0.002 to $0.006). */
export const PRICE_GB: Record<Cdn, number> = { A: 0.005, B: 0.0035 };
/** Request fee per 10,000 requests (assumed, book 18.11). */
export const PRICE_10K_REQ = 0.0075;
/** Origin egress per GB. CloudFront-like B pulls from S3 for free (AWS pairing, book 18.11). */
export const EGRESS_GB = { s3ToA: 0.03, s3ToB: 0, gcs: 0.03 };

/** Viewer to edge round trip (ms, assumed). A is faster in 3 regions, B in Sao Paulo. */
export const RTT_EDGE: Record<Region, Record<Cdn, number>> = {
  tokyo: { A: 14, B: 22 }, saopaulo: { A: 31, B: 20 }, frankfurt: { A: 11, B: 16 }, la: { A: 9, B: 13 },
};
/** Edge to shield round trip. Both shields sit near the origin in Oregon (assumed). */
export const RTT_SHIELD: Record<Region, number> = { tokyo: 105, saopaulo: 165, frankfurt: 145, la: 28 };
const EDGE_WORK = 4;        // cache lookup and token check, ms
const SHIELD_WORK = 4;
const S3_RTT = 8, S3_FIRST_BYTE = 70, S3_SLOW_FIRST_BYTE = 1_200; // shield in Oregon to S3 us-west-2
const GCS_RTT = 38, GCS_FIRST_BYTE = 80;                           // Oregon to us-central1
const STEER_MS = 40;        // Playback API call with in-process steering; once per session

export interface ContentInfo {
  label: string; short: string;
  /** Distinct segment objects viewers of this content touch (sets how fast caches fill). */
  objects: number;
  /** Hit ratio a fully warm layer reaches for this content (assumed, Chapter 6 numbers). */
  ceiling: Record<Layer, number>;
  /** Is this object in a "warm" layer? Long-tail episodes get evicted from busy edges. */
  inWarm: Record<Layer, boolean>;
  /** How many S3 prefixes the requests spread over (a premiere is one hot prefix). */
  prefixes: number;
}
export const CONTENT: Record<Content, ContentInfo> = {
  premiere: { label: "New simulcast episode", short: "New episode", objects: 2_000, ceiling: { edge: 0.99, shield: 0.97 }, inWarm: { edge: true, shield: true }, prefixes: 1 },
  popular: { label: "Popular show", short: "Popular", objects: 40_000, ceiling: { edge: 0.96, shield: 0.85 }, inWarm: { edge: true, shield: true }, prefixes: 24 },
  longtail: { label: "Old long-tail episode", short: "Long tail", objects: 3_000_000, ceiling: { edge: 0.6, shield: 0.8 }, inWarm: { edge: false, shield: true }, prefixes: 400 },
};

/* ------------------------------------------------------------------ */
/* Steering                                                            */
/* ------------------------------------------------------------------ */

/**
 * Share of each region's sessions sent to CDN A *before* health gates.
 * - performance: the CDN with the lower round trip in that region gets 75%, the other 25%
 *   (shares, not winner-take-all, so both stay warm; book 9.9.4)
 * - cost: the cheaper CDN (B) gets 90%; A keeps the 10% minimum warm share
 * - manual: the slider, everywhere
 */
export function plannedShareA(s: Pick<PgState, "steer" | "splitA">, r: Region): number {
  if (s.steer === "manual") return s.splitA;
  if (s.steer === "cost") return PRICE_GB.A <= PRICE_GB.B ? 0.9 : WARM_SHARE;
  return RTT_EDGE[r].A <= RTT_EDGE[r].B ? 0.75 : 0.25;
}

/** Share after the health gate: a drained CDN gets 0 (availability is a gate, not a score). */
export function liveShareA(s: PgState, r: Region): number {
  return s.faults.cdnAOutage ? 0 : plannedShareA(s, r);
}

/** Which CDN one session lands on: the larger share wins (ties go to A). */
export function pickCdn(s: PgState, r: Region): Cdn {
  return plannedShareA(s, r) >= 0.5 ? "A" : "B";
}

/* ------------------------------------------------------------------ */
/* Cache state                                                         */
/* ------------------------------------------------------------------ */

export const edgeKey = (c: Cdn, r: Region, k: Content) => `edge:${c}:${r}:${k}`;
export const shieldKey = (c: Cdn, k: Content) => `shield:${c}:${k}`;

/** A CDN that carried less than the warm share before a failover has cold caches. */
function starvedEdge(s: PgState, c: Cdn, r: Region) {
  const a = plannedShareA(s, r);
  return (c === "A" ? a : 1 - a) < WARM_SHARE - 1e-9;
}
function starvedShield(s: PgState, c: Cdn) {
  return REGIONS.every((r) => starvedEdge(s, c, r));
}

export type ColdWhy = "purged" | "evicted" | "starved" | null;
/** Is `content` cached at this edge? Returns the reason when it is not. */
export function edgeHas(s: PgState, c: Cdn, r: Region, k: Content): { hit: boolean; why: ColdWhy } {
  if (s.filled.includes(edgeKey(c, r, k))) return { hit: true, why: null };
  if (!s.edgeWarm) return { hit: false, why: "purged" };
  if (starvedEdge(s, c, r)) return { hit: false, why: "starved" };
  if (!CONTENT[k].inWarm.edge) return { hit: false, why: "evicted" };
  return { hit: true, why: null };
}
export function shieldHas(s: PgState, c: Cdn, k: Content): { hit: boolean; why: ColdWhy } {
  if (s.filled.includes(shieldKey(c, k))) return { hit: true, why: null };
  if (!s.shieldWarm) return { hit: false, why: "purged" };
  if (starvedShield(s, c)) return { hit: false, why: "starved" };
  return { hit: true, why: null };
}
/** Is the layer warm for drawing (solid ring) at this node? */
export function nodeWarm(s: PgState, layer: Layer, c: Cdn, r?: Region): boolean {
  if (layer === "edge" && r) return edgeHas(s, c, r, s.content).hit || (s.edgeWarm && !starvedEdge(s, c, r));
  return shieldHas(s, c, s.content).hit;
}

/* ------------------------------------------------------------------ */
/* One request, hop by hop                                             */
/* ------------------------------------------------------------------ */

export type NodeId =
  | `viewer:${Region}` | "steer" | `edge:${Cdn}:${Region}` | `shield:${Cdn}` | "s3" | "gcs";

export type HopResult = "ok" | "hit" | "miss" | "fail" | "timeout" | "404" | "bypass";
export interface Hop {
  from: NodeId; to: NodeId;
  /** Badge shown on `to` when the packet arrives. */
  result: HopResult;
  badge: string;
  /** Milliseconds this hop adds to time to first byte (steering is counted separately). */
  ms: number;
  controlPlane?: boolean;
  title: string;
  text: string;
  /** Return trip of the bytes: animate the reverse of these nodes back to the viewer. */
  returnPath?: NodeId[];
}
export interface RequestTrace {
  hops: Hop[];
  cdn: Cdn;
  ttfbMs: number;
  startMs: number;
  ok: boolean;
  servedBy: "edge" | "shield" | "s3" | "gcs" | "none";
  /** Cache keys to add when the animation finishes (caches keep a copy on the way back). */
  fills: string[];
  /** Number of origin fetches the shields would make for each brand-new T0 object (premiere herd). */
  summary: string;
}

const ms = (v: number) => `${Math.round(v).toLocaleString("en-US")} ms`;

export function simulateRequest(s: PgState): RequestTrace {
  const r = s.region, k = s.content, f = s.faults;
  const hops: Hop[] = [];
  const viewer: NodeId = `viewer:${r}`;
  const where = REGION_NAME[r];
  let cdn = pickCdn(s, r);
  const shareA = plannedShareA(s, r);
  const pct = Math.round((cdn === "A" ? shareA : 1 - shareA) * 100);
  const reason = s.steer === "performance"
    ? `it is faster here (${RTT_EDGE[r][cdn]} ms vs ${RTT_EDGE[r][cdn === "A" ? "B" : "A"]} ms)`
    : s.steer === "cost" ? (cdn === "B" ? "it is cheaper per GB, and pulls from S3 for free" : "it holds the larger share")
      : "you set the split by hand";

  hops.push({
    from: viewer, to: "steer", result: "ok", badge: cdn, ms: STEER_MS, controlPlane: true,
    title: `Steering picks ${CDN_NAME[cdn]}`,
    text: `The Playback API ranks the CDNs for ${where}. ${pct}% of sessions here go to ${CDN_NAME[cdn]} because ${reason}. This session lands there.`
      + (f.cdnAOutage && cdn === "A" ? " The health controller has not drained CDN A yet: that takes 2 bad windows (1 to 3 minutes)." : ""),
  });
  hops.push({ from: "steer", to: viewer, result: "ok", badge: "URLs", ms: 0, controlPlane: true, title: "Signed URLs come back", text: "The player gets a ranked list of manifest URLs, one per CDN, signed for this session. Steering is done; from now on the player talks to the CDN directly." });

  let t = 0;
  // Data plane. Layer 3 of steering: the player retries on the next CDN when an edge fails.
  if (cdn === "A" && f.cdnAOutage) {
    t += 30 + 250;
    hops.push({ from: viewer, to: `edge:A:${r}`, result: "fail", badge: "503", ms: 280, title: `Edge ${where} (CDN A) fails`, text: "CDN A answers 503 in about 30 ms. The player waits 250 ms (backoff), then moves to the next CDN in its list. This is player failover, the fastest steering layer." });
    cdn = "B";
  }
  const edge: NodeId = `edge:${cdn}:${r}`;
  const shield: NodeId = `shield:${cdn}`;
  const fills: string[] = [];
  const e = edgeHas(s, cdn, r, k);
  t += RTT_EDGE[r][cdn] + EDGE_WORK;

  const finish = (servedBy: RequestTrace["servedBy"], path: NodeId[], ok: boolean, summary: string): RequestTrace => {
    hops.push({
      from: path[0], to: viewer, result: ok ? "ok" : "fail", badge: ok ? "200" : "Error", ms: 0, returnPath: path,
      title: ok ? `First byte after ${ms(t)}` : "The viewer sees an error",
      text: ok ? (servedBy === "edge" ? "The bytes go straight back. The origin never hears about this request."
        : "The bytes flow back. Each cache on the way keeps a copy, so the next viewer here gets a hit.")
        : "The player gets an error for this segment. If it keeps failing, playback stops.",
    });
    return { hops, cdn, ttfbMs: t, startMs: STEER_MS, ok, servedBy, fills: ok ? fills : [], summary };
  };

  if (e.hit) {
    hops.push({ from: viewer, to: edge, result: "hit", badge: "HIT", ms: RTT_EDGE[r][cdn] + EDGE_WORK, title: `Edge ${where} HIT`, text: `${CDN_NAME[cdn]}'s PoP near ${where} already has this segment, because another viewer nearby pulled it earlier. It answers from its own disk and memory.` });
    return finish("edge", [edge], true, `Served by the ${where} edge in ${ms(t)}.`);
  }
  const missWhy = e.why === "evicted" ? "this old episode is watched so rarely that the PoP evicted it to make room for popular shows."
    : e.why === "starved" ? `${CDN_NAME[cdn]} carried less than ${WARM_SHARE * 100}% of traffic here, so its cache is cold. This is why every CDN keeps a minimum warm share.`
      : "first viewer for this segment in this PoP since the cache was emptied.";
  hops.push({ from: viewer, to: edge, result: "miss", badge: "MISS", ms: RTT_EDGE[r][cdn] + EDGE_WORK, title: `Edge ${where} MISS`, text: `${missWhy[0].toUpperCase()}${missWhy.slice(1)} The edge asks the next layer.` });
  fills.push(edgeKey(cdn, r, k));

  // Shield layer (or bypass when CDN A's shield is down).
  const shieldUp = !(cdn === "A" && f.shieldADown);
  let from: NodeId = edge;
  const back: NodeId[] = [edge];
  if (shieldUp) {
    const sh = shieldHas(s, cdn, k);
    t += RTT_SHIELD[r] + SHIELD_WORK;
    if (sh.hit) {
      hops.push({ from: edge, to: shield, result: "hit", badge: "HIT", ms: RTT_SHIELD[r] + SHIELD_WORK, title: `Shield ${cdn} HIT`, text: `Another PoP of ${CDN_NAME[cdn]} asked for this segment earlier. The shield collects the misses of every PoP, so it catches what one PoP never saw. Origin stays quiet.` });
      return finish("shield", [shield, edge], true, `Edge missed, shield ${cdn} caught it: ${ms(t)}.`);
    }
    hops.push({
      from: edge, to: shield, result: "miss", badge: "MISS", ms: RTT_SHIELD[r] + SHIELD_WORK, title: `Shield ${cdn} MISS`,
      text: sh.why === "starved" ? `${CDN_NAME[cdn]}'s shield is cold because the CDN carried almost no traffic before. It must go to origin.`
        : "No PoP of this CDN has asked for this segment yet. The shield fetches it from origin once; request collapsing makes everyone else who asks meanwhile wait for that one fetch.",
    });
    fills.push(shieldKey(cdn, k));
    from = shield; back.unshift(shield);
  } else {
    t += RTT_SHIELD[r];
    hops.push({ from: edge, to: shield, result: "bypass", badge: "DOWN", ms: 0, title: "Shield A is down", text: "CDN A's shield location is gone, so this edge goes straight to the origin. It still works, but now every PoP's misses hit the origin directly." });
  }

  // Origin: S3 primary, GCS replica.
  if (!f.awsDown) {
    const fb = f.slowOrigin ? S3_SLOW_FIRST_BYTE : S3_FIRST_BYTE;
    t += S3_RTT + fb;
    hops.push({ from, to: "s3", result: "ok", badge: "200", ms: S3_RTT + fb, title: f.slowOrigin ? "S3 us-west-2 answers, slowly" : "S3 us-west-2 answers", text: f.slowOrigin ? `The origin is overloaded and takes ${ms(fb)} to the first byte. Only misses feel this, which is why hit ratio protects start time.` : "The primary origin returns the segment. Only CDNs may read this bucket (origin cloaking)." });
    return finish("s3", ["s3", ...back], true, `Went all the way to S3: ${ms(t)}.`);
  }
  t += ORIGIN_TIMEOUT_MS;
  hops.push({ from, to: "s3", result: "timeout", badge: "TIMEOUT", ms: ORIGIN_TIMEOUT_MS, title: "S3 us-west-2 does not answer", text: "The AWS region is down. The shield waits 2 s (its connect timeout), then its origin group fails over to the replica. A 30 s default timeout here would empty the player's buffer first." });
  t += GCS_RTT + GCS_FIRST_BYTE;
  if (f.replLag && k === "premiere") {
    hops.push({ from, to: "gcs", result: "404", badge: "404", ms: GCS_RTT + GCS_FIRST_BYTE, title: "GCS us-central1: 404 Not Found", text: "Replication is behind: the new episode is not in GCS yet. The failover origin has nothing to give. A publish gate in the Playback API would have held this episode until it was in two origins." });
    return finish("none", ["gcs", ...back], false, "S3 down and the episode is missing from GCS: error.");
  }
  hops.push({ from, to: "gcs", result: "ok", badge: "200", ms: GCS_RTT + GCS_FIRST_BYTE, title: "GCS us-central1 answers", text: f.replLag ? "Replication is behind, but only for the newest episode. This older object was copied long ago, so the replica has it." : "The replica has the object, because replication copied it within seconds. Multi-cloud origin works." });
  return finish("gcs", ["gcs", ...back], true, `Failed over to GCS: ${ms(t)}.`);
}

/* ------------------------------------------------------------------ */
/* Many viewers: aggregate traffic                                     */
/* ------------------------------------------------------------------ */

/**
 * fill(x): share of requests that hit in a cache that started empty, when each of its N
 * objects is requested R*T/N times during the window T (x = R*T/N).
 * For an object requested at Poisson rate λ, the first request in the window misses and
 * the rest hit: expected misses = 1 - e^(-λT), requests = λT, so
 *   hit = 1 - (1 - e^-x) / x.
 * Small x (few viewers, many objects): almost every request is the first one, hit ≈ 0.
 * Large x (many viewers, few objects): hit → 1. This is why popular content warms itself
 * and the long tail never does.
 */
export function fill(x: number): number {
  if (x <= 1e-9) return 0;
  return 1 - (1 - Math.exp(-x)) / x;
}

/** Window used for cold caches: "the first minute after T0 / after a purge". */
const COLD_WINDOW_S = 60;

export interface LinkFlow { from: NodeId; to: NodeId; bps: number; failed?: boolean; dashed?: boolean }
export type Tone = "neutral" | "good" | "bad" | "warn" | "accent";
export interface TrafficStats {
  viewers: number;
  edgeBps: number;
  edgeHit: number;
  shieldHit: number | null;
  originRps: number;
  originBurst: number;    // origin fetches per brand-new object at T0 (premiere, cold)
  originBps: number;
  p95Ms: number;
  firstTryFail: number;   // share of requests whose first try failed (player retries)
  errorRate: number;      // share that still failed after retries
  costHour: number;
  costPerGbEff: number;
  loadA: number; loadB: number;
  phase: "steady" | "cold";
  notes: { tone: Tone; text: string }[];
}
export interface TrafficResult { links: LinkFlow[]; stats: TrafficStats }

/**
 * Latency spread inside one outcome bucket. A single "edge hit = 15 ms" would make p95
 * jump in steps; real latencies spread, so each bucket is split into three points.
 */
const SPREAD: [number, number][] = [[0.75, 0.35], [1, 0.45], [1.8, 0.2]];

export function simulateTraffic(s: PgState): TrafficResult {
  const V = viewersFromLog(s.viewersLog);
  const f = s.faults, k = s.content, info = CONTENT[k];
  const reqPerViewer = 2 / s.segSec;               // one video + one audio segment per segment duration
  const links: LinkFlow[] = [];
  const notes: TrafficStats["notes"] = [];
  const cold = !s.edgeWarm || !s.shieldWarm;
  const latency: [number, number][] = [];         // [ms, weight] for p95
  let totalReq = 0, hitReq = 0, shieldIn = 0, shieldHitReq = 0;
  let originReq = 0, originBytes = 0, failedFirst = 0, failedFinal = 0;
  let costDelivery = 0, costReq = 0, costEgress = 0;
  const load: Record<Cdn, number> = { A: 0, B: 0 };
  const shieldReq: Record<Cdn, number> = { A: 0, B: 0 };
  const shieldBytesIn: Record<Cdn, number> = { A: 0, B: 0 };
  const bypassReq: Record<Region, number> = { tokyo: 0, saopaulo: 0, frankfurt: 0, la: 0 };
  const bypassBytes: Record<Region, number> = { tokyo: 0, saopaulo: 0, frankfurt: 0, la: 0 };

  // Origin choice for misses: S3 unless AWS is down (health checks mark it sick, GCS takes over).
  const originMs = f.awsDown ? GCS_RTT + GCS_FIRST_BYTE : S3_RTT + (f.slowOrigin ? S3_SLOW_FIRST_BYTE : S3_FIRST_BYTE);
  const originMissing = f.awsDown && f.replLag && k === "premiere";  // GCS answers 404

  /**
   * Hit ratio for a layer. Warm: the content's ceiling (Chapter 6 numbers).
   * Cold: ceiling × fill(R·T/N) over the first minute, R = request rate reaching ONE cache.
   * A cold cache can only fill if the layer behind it can answer. If the origin returns 404
   * and nothing above it holds the object, the cache stays empty and every request fails.
   */
  const hitRatio = (layer: Layer, warm: boolean, ratePerCache: number, canFill: boolean) => {
    if (warm) return info.ceiling[layer];
    if (!canFill) return 0;
    return info.ceiling[layer] * fill((ratePerCache * COLD_WINDOW_S) / info.objects);
  };
  const shieldWarmFor = (c: Cdn) => !(c === "A" && f.shieldADown) && s.shieldWarm && !starvedShield(s, c);

  // Pass 1: edges. CDN A's first tries fail during an outage; those sessions retry on B,
  // so the live flows below use the drained shares (A = 0).
  totalReq = V * reqPerViewer;
  if (f.cdnAOutage) for (const r of REGIONS) {
    const a = plannedShareA(s, r);
    if (a <= 0) continue;
    failedFirst += V * REGION_MIX[r] * a * reqPerViewer;
    links.push({ from: `viewer:${r}`, to: `edge:A:${r}`, bps: 0, failed: true });
  }
  const edgeHitBy: Record<string, number> = {}, edgeMsBy: Record<string, number> = {};
  for (const r of REGIONS) {
    const a = liveShareA(s, r);
    for (const c of CDNS) {
      const share = c === "A" ? a : 1 - a;
      const v = V * REGION_MIX[r] * share;
      if (v <= 0) continue;
      const R = v * reqPerViewer;       // requests per second from this region to this CDN
      const bps = v * BITRATE_BPS;      // bytes delivered: viewers × 4 Mbps
      load[c] += bps;
      const warmEdge = s.edgeWarm && !starvedEdge(s, c, r);
      const he = hitRatio("edge", warmEdge, R / POPS_PER_REGION, !originMissing || shieldWarmFor(c));
      const eMs = RTT_EDGE[r][c] + EDGE_WORK;
      edgeHitBy[`${c}:${r}`] = he; edgeMsBy[`${c}:${r}`] = eMs;
      hitReq += R * he;
      links.push({ from: `viewer:${r}`, to: `edge:${c}:${r}`, bps });
      const missR = R * (1 - he), missB = bps * (1 - he);
      if (c === "A" && f.shieldADown) { bypassReq[r] += missR; bypassBytes[r] += missB; }
      else { shieldReq[c] += missR; shieldBytesIn[c] += missB; links.push({ from: `edge:${c}:${r}`, to: `shield:${c}`, bps: missB }); }
      // Cost: delivered GB × price, plus request fees.
      costDelivery += (bps * 3600) / 8 / 1e9 * PRICE_GB[c];
      costReq += (R * 3600) / 1e4 * PRICE_10K_REQ;
      latency.push([eMs, R * he]);
    }
  }

  // Pass 2: shields, then origin.
  const shieldHitBy: Record<Cdn, number> = { A: 0, B: 0 };
  for (const c of CDNS) {
    if (shieldReq[c] <= 0) continue;
    const warmShield = s.shieldWarm && !starvedShield(s, c);
    const hs = hitRatio("shield", warmShield, shieldReq[c], !originMissing);
    shieldHitBy[c] = hs;
    shieldIn += shieldReq[c];
    shieldHitReq += shieldReq[c] * hs;
    let oR = shieldReq[c] * (1 - hs), oB = shieldBytesIn[c] * (1 - hs);
    // 404s carry no video bytes, and negative caching means each object is asked again at most every 10 s.
    if (originMissing) { oR = Math.min(oR, info.objects / NEG_CACHE_S); oB = 0; }
    originReq += oR; originBytes += oB;
    const target: NodeId = f.awsDown ? "gcs" : "s3";
    links.push({ from: `shield:${c}`, to: target, bps: oB });
    costEgress += (oB * 3600) / 8 / 1e9 * (f.awsDown ? EGRESS_GB.gcs : c === "A" ? EGRESS_GB.s3ToA : EGRESS_GB.s3ToB);
  }
  for (const r of REGIONS) {
    if (bypassReq[r] <= 0) continue;
    if (originMissing) { bypassReq[r] = Math.min(bypassReq[r], (POPS_PER_REGION * info.objects) / NEG_CACHE_S); bypassBytes[r] = 0; }
    originReq += bypassReq[r]; originBytes += bypassBytes[r];
    links.push({ from: `edge:A:${r}`, to: f.awsDown ? "gcs" : "s3", bps: bypassBytes[r], dashed: true });
    costEgress += (bypassBytes[r] * 3600) / 8 / 1e9 * (f.awsDown ? EGRESS_GB.gcs : EGRESS_GB.s3ToA);
  }

  // Latency points for shield hits and origin fetches, per (CDN, region).
  for (const r of REGIONS) {
    const a = liveShareA(s, r);
    for (const c of CDNS) {
      const share = c === "A" ? a : 1 - a;
      if (share <= 0) continue;
      const R = V * REGION_MIX[r] * share * reqPerViewer;
      const he = edgeHitBy[`${c}:${r}`], eMs = edgeMsBy[`${c}:${r}`];
      const miss = R * (1 - he);
      const bypass = c === "A" && f.shieldADown;
      const hs = bypass ? 0 : shieldHitBy[c];
      const sMs = eMs + RTT_SHIELD[r] + SHIELD_WORK;
      if (!bypass) latency.push([sMs, miss * hs]);
      const oMs = (bypass ? eMs + RTT_SHIELD[r] : sMs) + originMs;
      if (originMissing) failedFinal += miss * (1 - hs);
      else latency.push([oMs, miss * (1 - hs)]);
    }
  }

  // Premiere herd at T0: origin fetches per brand-new object. With a shield and request
  // collapsing, each CDN fetches each object once. Without a shield, every PoP does.
  let burstPerObject = 0;
  for (const c of CDNS) {
    const regionsUsing = REGIONS.filter((r) => (c === "A" ? liveShareA(s, r) : 1 - liveShareA(s, r)) > 0);
    if (!regionsUsing.length) continue;
    if (c === "A" && f.shieldADown) burstPerObject += regionsUsing.length * POPS_PER_REGION;
    else burstPerObject += 1;
  }
  const herd = k === "premiere" && cold && V >= 1000;
  // During the first seconds the T0 objects are fetched by all fetchers at once (~2 s window).
  const burstRps = herd ? (T0_OBJECTS * burstPerObject) / 2 : 0;
  const originRps = originReq + burstRps;

  // S3 per-prefix throttling: a new episode lives under one prefix.
  const prefixCap = S3_PREFIX_RPS * info.prefixes;
  let throttled = 0;
  if (!f.awsDown && originRps > prefixCap) {
    throttled = (originRps - prefixCap) / originRps * originReq;
    failedFinal += throttled;
    notes.push({ tone: "bad", text: `Origin gets ${Math.round(originRps).toLocaleString("en-US")} requests per second on one prefix. S3 starts answering "503 Slow Down" above about ${prefixCap.toLocaleString("en-US")}.` });
  }

  // Capacity: retried sessions from a dead CDN A land on B. Beyond reserved capacity, requests fail.
  for (const c of CDNS) {
    if (load[c] > CDN_CAPACITY_BPS) {
      const over = (load[c] - CDN_CAPACITY_BPS) / load[c];
      const reqC = REGIONS.reduce((sum, r) => sum + V * REGION_MIX[r] * (c === "A" ? liveShareA(s, r) : 1 - liveShareA(s, r)) * reqPerViewer, 0);
      failedFinal += over * reqC;
      notes.push({ tone: "bad", text: `${CDN_NAME[c]} must carry ${fmtT(load[c])}, above its reserved ${fmtT(CDN_CAPACITY_BPS)}. Reservations should be sized for "N minus one CDN".` });
    }
  }

  // p95 of time to first byte over all successful requests.
  const pts: [number, number][] = [];
  for (const [m, w] of latency) for (const [mul, sw] of SPREAD) if (w > 0) pts.push([m * mul, w * sw]);
  pts.sort((x, y) => x[0] - y[0]);
  const totalW = pts.reduce((sum, p) => sum + p[1], 0);
  let acc = 0, p95 = totalW > 0 ? 0 : NaN;   // NaN: no request succeeded
  for (const [m, w] of pts) { acc += w; p95 = m; if (acc >= 0.95 * totalW) break; }

  if (f.cdnAOutage) notes.push({ tone: "warn", text: `CDN A is down. First tries on A fail, players retry on B within a second, and steering drains A in 1 to 3 minutes. ${starvedAny(s, "B") ? "CDN B was kept below 10%, so it starts cold." : "CDN B was already warm, thanks to its share."}` });
  if (f.shieldADown) notes.push({ tone: "warn", text: "Shield A is down: every CDN A PoP sends its misses straight to the origin." });
  if (f.awsDown) notes.push({ tone: originMissing ? "bad" : "warn", text: originMissing ? "AWS is down and the new episode never reached GCS: every cache miss becomes a 404." : "AWS us-west-2 is down. Health checks moved origin fetches to GCS; the first requests waited 2 s for a timeout." });
  else if (f.replLag) notes.push({ tone: "warn", text: "Replication is behind. Nothing breaks while S3 is up, but the failover origin is missing the newest episode." });
  if (f.slowOrigin && !f.awsDown) notes.push({ tone: "warn", text: "Origin is slow. Only misses feel it, so p95 moves only when more than 5% of requests miss." });
  if (herd) notes.push({ tone: burstPerObject > 4 ? "bad" : "neutral", text: `T0 herd: each brand-new segment is fetched from origin ${burstPerObject} time${burstPerObject === 1 ? "" : "s"} (${burstPerObject <= 2 ? "one per CDN shield, thanks to request collapsing" : "once per PoP, because a shield is missing"}).` });

  const totalBytes = load.A + load.B;
  // Failed requests deliver no video bytes, so they add no delivery cost.
  const errorRate = totalReq ? Math.min(1, failedFinal / totalReq) : 0;
  const costHour = costDelivery * (1 - errorRate) + costReq + costEgress;
  const gbHour = (totalBytes * 3600) / 8 / 1e9;
  return {
    links,
    stats: {
      viewers: V, edgeBps: totalBytes,
      edgeHit: totalReq ? hitReq / totalReq : 0,
      shieldHit: shieldIn > 0 ? shieldHitReq / shieldIn : null,
      originRps, originBurst: burstPerObject, originBps: originBytes,
      p95Ms: p95,
      firstTryFail: totalReq ? failedFirst / totalReq : 0,
      errorRate,
      costHour, costPerGbEff: gbHour > 0 ? costHour / gbHour : 0,
      loadA: load.A, loadB: load.B,
      phase: cold ? "cold" : "steady",
      notes,
    },
  };
}

function starvedAny(s: PgState, c: Cdn) { return REGIONS.some((r) => starvedEdge(s, c, r)); }
function fmtT(bps: number) { return `${(bps / 1e12).toFixed(1)} Tbps`; }

/* ------------------------------------------------------------------ */
/* Tones for the stat tiles                                            */
/* ------------------------------------------------------------------ */
export const toneHit = (h: number, good: number, warn: number): Tone => (h >= good ? "good" : h >= warn ? "warn" : "bad");
export const toneLow = (v: number, good: number, warn: number): Tone => (v <= good ? "good" : v <= warn ? "warn" : "bad");
