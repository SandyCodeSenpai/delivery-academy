/**
 * Delivery bill model for Chapter 16 ("The Economics of Delivery").
 * Every price here is copied from the chapter, with its year and source type:
 *   "list, 2026"  = a published list price the book quotes (accessed November 2026)
 *   "survey"      = Dan Rayburn's 2019 / 2020 negotiated-price surveys, as quoted in the book
 *   "illustrative" / "assumed" = the book's own illustrative numbers, never market quotes
 */

export type RegionId = "na" | "eu" | "latam" | "apac" | "india";
export type PriceModel = "list" | "negotiated";
export type Billing = "gb" | "p95";
export type OriginPath = "cf" | "s3" | "gcs";
export type Packaging = "hlsdash" | "cmaf" | "jit";

/** CloudFront pay-as-you-go tiers (list, 2026), $/GB. Tier sizes in GB: first 1 TB free, next 9 TB, 40 TB, 350 TB, 4 PB, then over 5 PB. */
const TIER_GB = [1_000, 9_000, 40_000, 350_000, 4_000_000, Infinity];
type Column = readonly [number, number, number, number, number, number];
const COL = {
  us: [0, 0.085, 0.08, 0.04, 0.025, 0.02],
  europe: [0, 0.085, 0.08, 0.04, 0.025, 0.02],
  southAmerica: [0, 0.11, 0.105, 0.08, 0.05, 0.04],
  japan: [0, 0.114, 0.089, 0.084, 0.07, 0.06],
  australia: [0, 0.114, 0.098, 0.092, 0.085, 0.08],
  india: [0, 0.109, 0.085, 0.08, 0.075, 0.072],
} satisfies Record<string, Column>;

/** Cost of `gb` gigabytes on one CloudFront tier column. Tiers apply per region per month. */
export function tieredCost(gb: number, col: Column): number {
  let left = gb, cost = 0;
  for (let i = 0; i < TIER_GB.length && left > 0; i++) {
    const take = Math.min(left, TIER_GB[i]);
    cost += take * col[i];
    left -= take;
  }
  return cost;
}

/**
 * The five sliders group the book's eight-region worked mix (Section 16.11.1).
 * Each slider region is made of book sub-regions with a fixed inner split, each priced on a CloudFront column.
 *  - APAC: SE Asia and Hong Kong (5), Australia and NZ (2), Japan (1). Section 16.6 puts SE Asia, HK and Japan
 *    in one $0.060 top-tier group, so both use the Japan column.
 *  - EU: Europe (20) plus Middle East and Africa (4). The book's MEA effective rate ($0.043 at 21.6 PB) equals
 *    the South America column at that volume, so MEA uses it.
 * Request fees (list, 2026): $0.0100 per 10,000 in North America, $0.0220 in South America. The book gives only
 * this range, so other regions use $0.0100 and MEA uses the South America rate (assumed).
 */
export interface Region { id: RegionId; name: string; short: string; parts: { w: number; col: Column; req: number; label: string }[] }
export const REGIONS: Region[] = [
  { id: "na", name: "North America", short: "NA", parts: [{ w: 1, col: COL.us, req: 0.01, label: "US, Mexico, Canada" }] },
  { id: "eu", name: "Europe, Middle East, Africa", short: "EU", parts: [
    { w: 20 / 24, col: COL.europe, req: 0.01, label: "Europe" },
    { w: 4 / 24, col: COL.southAmerica, req: 0.022, label: "Middle East and Africa" }] },
  { id: "latam", name: "Latin America", short: "LatAm", parts: [{ w: 1, col: COL.southAmerica, req: 0.022, label: "South America" }] },
  { id: "apac", name: "Asia Pacific", short: "APAC", parts: [
    { w: 6 / 8, col: COL.japan, req: 0.01, label: "SE Asia, HK, Japan" },
    { w: 2 / 8, col: COL.australia, req: 0.01, label: "Australia, NZ" }] },
  { id: "india", name: "India", short: "India", parts: [{ w: 1, col: COL.india, req: 0.01, label: "India" }] },
];
/** Book's assumed mix (Section 16.11.1), regrouped: 45 / 20+4 / 20 / 5+2+1 / 3. */
export const BOOK_MIX: Record<RegionId, number> = { na: 45, eu: 24, latam: 20, apac: 8, india: 3 };

/** Constants from the book. */
export const K = {
  segmentMB: 3,                // 6 s segment at 4 Mbps
  reqPerSegment: 2,            // video + separate audio
  shieldCatch: 0.8,            // shield catches 80% of edge misses (assumed)
  shieldFeePer10k: 0.0075,     // CloudFront Origin Shield, US, list 2026
  gbPerHour: 1.8,              // 4 Mbps for one hour
  gbPerMbpsMonth: 324,         // 1 Mbps flat out for 30 days
  originRate: { cf: 0, s3: 0.05, gcs: 0.08 } as Record<OriginPath, number>,
  jitPerGB: 0.05,              // AWS Elemental MediaPackage VOD, list 2026
  storageStd: 0.022,           // S3 Standard blended at this size, list 2026 (book's figure)
  storageGlacierIR: 0.004,     // S3 Glacier Instant Retrieval, list 2026
  gbPerEpisodeCopy: 4.3,       // H.264 ladder + 4 dubs, one packaging
  gbMezzanine: 27,             // 150 Mbps x 24 min
  extraLadderTB: 75,           // per extra codec ladder for popular titles (book: 100-200 TB for both; assumed)
  clouds: 2,                   // AWS + GCP multi-origin
  codecSaving: { hevc: 0.2, av1: 0.3 }, // vs H.264 at equal quality (assumed; AV1 30% is the book's illustration)
  codecMax: 60,                // max share in %, limited by device support (assumed)
};

/** Survey points the book quotes for negotiated per-GB prices. */
export const SURVEY = [
  { rate: 0.0006, label: "2020: biggest OTT deals" },
  { rate: 0.001, label: "2019: very large deals" },
  { rate: 0.003, label: "2019: other customers, low end" },
  { rate: 0.005, label: "2019 high end; 2020 ~40 PB/month" },
  { rate: 0.007, label: "2020: 20+ PB/month" },
];

export interface State {
  volumePB: number;                     // viewing volume in PB per month, measured as if all H.264
  mix: Record<RegionId, number>;        // percentages, sum 100
  price: PriceModel;
  negRate: number;                      // survey $/GB for negotiated per-GB
  override: Partial<Record<RegionId, number>>; // per-region $/GB override
  billing: Billing;
  loadFactor: number;
  perMbps: number;                      // $ per Mbps per month (illustrative)
  commitPB: number;                     // per-GB commit, PB/month (0 = none)
  commitTbps: number;                   // 95th commit, Tbps (0 = none)
  overagePct: number;                   // overage premium above contract rate, %
  hit: number;                          // edge hit ratio by bytes, 0..1
  origin: OriginPath;
  episodes: number;
  packaging: Packaging;
  mezzCold: boolean;
  hevc: number;                         // % of viewing on HEVC
  av1: number;                          // % of viewing on AV1
}

export const BOOK_STATE: State = {
  volumePB: 540, mix: { ...BOOK_MIX }, price: "list", negRate: 0.002, override: {}, billing: "gb", loadFactor: 0.42,
  perMbps: 0.2, commitPB: 0, commitTbps: 0, overagePct: 20, hit: 0.95, origin: "cf", episodes: 50_000,
  packaging: "hlsdash", mezzCold: true, hevc: 0, av1: 0,
};
export const NEGOTIATED_STATE: State = { ...BOOK_STATE, price: "negotiated", negRate: 0.002 };
/** A realistic but messy month: survey-range contract with a third-party CDN, S3 origin, managed JIT, 90% hit ratio. */
export const CHALLENGE_STATE: State = {
  ...BOOK_STATE, price: "negotiated", negRate: 0.003, commitPB: 450, overagePct: 20, hit: 0.9, origin: "s3",
  packaging: "jit", mezzCold: false,
};

export interface RegionLine { id: RegionId; pb: number; rate: number; cost: number; src: "list" | "survey" | "override" | "p95" }
export interface Bill {
  deliveredPB: number; hours: number; fillsPB: number;
  regions: RegionLine[];
  bytesCost: number; requestCost: number; commitWaste: number; overageCost: number;
  delivery: number; origin: number; storage: number; packaging: number; total: number;
  blendedPerGB: number; perHour: number;
  billedTbps: number; effPerGB95: number;
  storageTB: { packaged: number; mezz: number };
}

export function codecFactor(s: Pick<State, "hevc" | "av1">) {
  return 1 - (s.hevc / 100) * K.codecSaving.hevc - (s.av1 / 100) * K.codecSaving.av1;
}

export function listRate(r: Region, gb: number) {
  if (gb <= 0) return r.parts.reduce((a, p) => a + p.w * p.col[5], 0);
  return r.parts.reduce((a, p) => a + tieredCost(gb * p.w, p.col), 0) / gb;
}

export function compute(s: State): Bill {
  const deliveredPB = s.volumePB * codecFactor(s);
  const deliveredGB = deliveredPB * 1e6;
  const hours = (s.volumePB * 1e6) / K.gbPerHour;
  const sum = Object.values(s.mix).reduce((a, b) => a + b, 0) || 1;

  // Delivery bytes per region (before commit).
  const p95 = s.price === "negotiated" && s.billing === "p95";
  const effPerGB95 = s.perMbps / (K.gbPerMbpsMonth * s.loadFactor);
  const regions: RegionLine[] = REGIONS.map((r) => {
    const gb = deliveredGB * (s.mix[r.id] / sum);
    const ov = s.override[r.id];
    let rate: number, src: RegionLine["src"];
    if (p95) { rate = effPerGB95; src = "p95"; }
    else if (ov !== undefined && ov >= 0) { rate = ov; src = "override"; }
    else if (s.price === "list") { rate = listRate(r, gb); src = "list"; }
    else { rate = s.negRate; src = "survey"; }
    return { id: r.id, pb: gb / 1e6, rate, cost: gb * rate, src };
  });
  const rawBytes = regions.reduce((a, r) => a + r.cost, 0);
  const blendedRate = deliveredGB > 0 ? rawBytes / deliveredGB : 0;

  // Commit and overage (negotiated only). Unused commit is still paid; traffic above it pays the overage premium.
  let bytesCost = rawBytes, commitWaste = 0, overageCost = 0;
  const billedTbps = deliveredGB / (K.gbPerMbpsMonth * s.loadFactor) / 1e6;
  if (s.price === "negotiated") {
    const q = p95 ? billedTbps : deliveredPB;
    const c = p95 ? s.commitTbps : s.commitPB;
    const unitCost = p95 ? s.perMbps * 1e6 : blendedRate * 1e6; // $ per Tbps-month or per PB
    if (c > 0) {
      if (q <= c) { bytesCost = c * unitCost; commitWaste = (c - q) * unitCost; }
      else { overageCost = (q - c) * unitCost * (1 + s.overagePct / 100); bytesCost = c * unitCost + overageCost; }
    }
  }

  // Requests: list price per region; in negotiated contracts they are often negotiated down or bundled (assumed $0).
  let requestCost = 0;
  if (s.price === "list") {
    const reqTotal = (deliveredGB * 1000) / K.segmentMB * K.reqPerSegment;
    for (const r of REGIONS) {
      const share = s.mix[r.id] / sum;
      for (const p of r.parts) requestCost += (reqTotal * share * p.w / 10_000) * p.req;
    }
  }
  const delivery = bytesCost + requestCost;

  // Origin: edge misses, 80% caught by shield, the rest leave the origin.
  const missGB = deliveredGB * (1 - s.hit);
  const fillsGB = missGB * (1 - K.shieldCatch);
  const shieldFee = s.price === "list" && s.origin === "cf" ? ((missGB * 1000) / K.segmentMB * K.reqPerSegment / 10_000) * K.shieldFeePer10k : 0;
  const origin = fillsGB * K.originRate[s.origin] + shieldFee;

  // Packaging: managed JIT charges per GB packaged; every origin fill passes through it.
  const packaging = s.packaging === "jit" ? fillsGB * K.jitPerGB : 0;

  // Storage per cloud, two clouds; mezzanine stored once.
  const copies = s.packaging === "hlsdash" ? 2 : 1;
  const extra = (s.hevc > 0 ? K.extraLadderTB : 0) + (s.av1 > 0 ? K.extraLadderTB : 0);
  const packagedTB = (s.episodes * K.gbPerEpisodeCopy * copies) / 1000 + extra;
  const mezzTB = (s.episodes * K.gbMezzanine) / 1000;
  const storage = packagedTB * 1000 * K.clouds * K.storageStd + mezzTB * 1000 * (s.mezzCold ? K.storageGlacierIR : K.storageStd);

  const total = delivery + origin + packaging + storage;
  return {
    deliveredPB, hours, fillsPB: fillsGB / 1e6, regions, bytesCost, requestCost, commitWaste, overageCost,
    delivery, origin, storage, packaging, total,
    blendedPerGB: deliveredGB > 0 ? total / deliveredGB : 0, perHour: hours > 0 ? total / hours : 0,
    billedTbps, effPerGB95, storageTB: { packaged: packagedTB, mezz: mezzTB },
  };
}

/** Move `pts` points of viewing from H.264 to a codec, capped by device support and by the H.264 share left. */
export function shiftCodec(s: State, codec: "hevc" | "av1", pts: number): State {
  const h264 = 100 - s.hevc - s.av1;
  const add = Math.max(0, Math.min(pts, h264, K.codecMax - s[codec]));
  return { ...s, [codec]: s[codec] + add };
}

export interface Lever { id: string; label: string; detail: string; kind: "eng" | "contract"; next: State; saving: number; available: boolean }

/** Each lever is one sensible step from the current state, priced by running the model again. */
export function levers(s: State, base: Bill, locked: boolean): Lever[] {
  const mk = (id: string, label: string, detail: string, kind: Lever["kind"], next: State | null): Lever => {
    const ok = next !== null && !(locked && kind === "contract");
    const n = next ?? s;
    return { id, label, detail, kind, next: n, saving: ok ? base.total - compute(n).total : 0, available: ok };
  };
  const out: Lever[] = [];
  out.push(mk("hit", "+3 points of edge hit ratio", s.hit >= 0.995 ? "Already at the cap" : `${fmtP(s.hit)} to ${fmtP(Math.min(0.995, s.hit + 0.03))}`, "eng",
    s.hit >= 0.995 ? null : { ...s, hit: Math.min(0.995, s.hit + 0.03) }));
  const av1 = shiftCodec(s, "av1", 10);
  out.push(mk("av1", "+10 points of viewing on AV1", av1.av1 === s.av1 ? "No H.264 left or device cap reached" : `AV1 ${s.av1}% to ${av1.av1}%`, "eng", av1.av1 === s.av1 ? null : av1));
  const hevc = shiftCodec(s, "hevc", 10);
  out.push(mk("hevc", "+10 points of viewing on HEVC", hevc.hevc === s.hevc ? "No H.264 left or device cap reached" : `HEVC ${s.hevc}% to ${hevc.hevc}%`, "eng", hevc.hevc === s.hevc ? null : hevc));
  out.push(mk("cmaf", "One CMAF copy (static, cbcs)", s.packaging === "cmaf" ? "Already on CMAF" : s.packaging === "jit" ? "Drop the managed JIT fee" : "Stop storing HLS and DASH twice", "eng",
    s.packaging === "cmaf" ? null : { ...s, packaging: "cmaf" }));
  out.push(mk("pair", "Fill from a CDN-paired origin", s.origin === "cf" ? "Fills are already free" : "S3 to CloudFront fills cost $0", "contract", s.origin === "cf" ? null : { ...s, origin: "cf" }));
  out.push(mk("mezz", "Mezzanines to Glacier IR", s.mezzCold ? "Already cold" : "Masters are read only on re-encode", "eng", s.mezzCold ? null : { ...s, mezzCold: true }));
  if (s.price === "list") {
    out.push(mk("neg", "Sign a contract at a survey rate", "List is a ceiling; survey midpoint $0.003/GB", "contract", { ...s, price: "negotiated", negRate: 0.003, billing: "gb" }));
  } else if (s.billing === "p95") {
    out.push(mk("lf", "Flatter traffic: load factor +0.05", "e.g. prefetch off-peak", "eng", s.loadFactor >= 0.85 ? null : { ...s, loadFactor: Math.min(0.85, s.loadFactor + 0.05) }));
  } else {
    out.push(mk("rate", "Negotiate 10% off the rate", "Competition between CDNs", "contract", { ...s, negRate: s.negRate * 0.9, override: Object.fromEntries(Object.entries(s.override).map(([k, v]) => [k, (v ?? 0) * 0.9])) }));
  }
  const b = compute(s);
  if (b.commitWaste > 0) out.push(mk("commit", "Lower the commit to actual traffic", "You pay for unused commit", "contract",
    s.billing === "p95" ? { ...s, commitTbps: b.billedTbps } : { ...s, commitPB: b.deliveredPB }));
  return out.sort((a, z) => (z.available ? z.saving : -1) - (a.available ? a.saving : -1));
}

const fmtP = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
