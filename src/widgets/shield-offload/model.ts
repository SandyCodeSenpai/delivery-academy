/**
 * Offload math for the shield-offload widget (book Chapter 6.2 and 6.10, Chapter 16.7).
 *
 * Misses multiply across tiers: origin share = edge miss x shield miss.
 * Monthly bytes scale from the book's assumed model: 8 Tbps peak <-> about 540 PB delivered a month.
 */

export const TARGET_GBPS = 100;
export const REF_PEAK_TBPS = 8;
export const MONTHLY_TB_AT_REF = 540_000; // 540 PB a month at 8 Tbps peak (assumed model)
export const REF_POPS = 100;
/** Simplification: edge misses grow as (PoPs / 100) ^ POP_ALPHA. */
export const POP_ALPHA = 0.3;

export interface PricePreset { id: string; perGB: number; short: string; label: string; note: string }
/** Origin egress prices from the book. Only the S3 rows are list prices. */
export const PRICES: PricePreset[] = [
  { id: "s3-first", perGB: 0.09, short: "$0.09", label: "S3 to internet, first 10 TB (list)", note: "S3 internet egress list price, us-east-1, first 10 TB a month (Ch. 16.7)." },
  { id: "s3-top", perGB: 0.05, short: "$0.05", label: "S3 to internet, top tier (list)", note: "S3's top internet egress tier on AWS's published table (Ch. 16.7). A third-party CDN pulling from S3 pays this at list." },
  { id: "blended", perGB: 0.03, short: "$0.03", label: "Blended contract rate (assumed)", note: "The book's assumed blended price for non-paired CDN pulls (Ch. 6.10). Use your real contract number." },
  { id: "paired", perGB: 0, short: "$0", label: "CloudFront pulling from S3 (paired)", note: "CloudFront fetches from any AWS origin with no data-transfer charge (Ch. 16.7). Shield request fees still apply." },
];

export interface OffloadInput {
  peakTbps: number;
  edgeHit: number; // 0..1, byte hit ratio at the reference PoP count
  shieldOn: boolean;
  shieldHit: number; // 0..1, of edge misses
  pops: number;
  pricePerGB: number;
  objectMB: number;
}

export interface OffloadResult {
  edgeInGbps: number;
  edgeMissRatio: number; // effective, after the PoP factor
  servedEdgeGbps: number;
  toShieldGbps: number; // edge misses (to shield, or to origin when the shield is off)
  servedShieldGbps: number;
  shieldHitEff: number;
  originGbps: number;
  offload: number;
  originRps: number;
  monthlyTB: number;
  monthlyCost: number;
  popFactor: number;
}

export function popFactor(pops: number): number {
  return Math.pow(pops / REF_POPS, POP_ALPHA);
}

export function computeOffload(i: OffloadInput): OffloadResult {
  const edgeInGbps = i.peakTbps * 1000;
  const baseMiss = 1 - i.edgeHit;
  const pf = popFactor(i.pops);
  const edgeMissRatio = Math.min(1, baseMiss * pf);
  const toShieldGbps = edgeInGbps * edgeMissRatio;
  const servedEdgeGbps = edgeInGbps - toShieldGbps;

  let originGbps = toShieldGbps;
  if (i.shieldOn) {
    // Extra misses from spreading the audience over more PoPs are repeat fetches of objects
    // another PoP already pulled, so the shield already holds them. Fewer PoPs remove misses evenly.
    originGbps = edgeInGbps * baseMiss * Math.min(1, pf) * (1 - i.shieldHit);
  }
  const servedShieldGbps = toShieldGbps - originGbps;
  const shieldHitEff = toShieldGbps > 0 ? servedShieldGbps / toShieldGbps : 0;
  const share = edgeInGbps > 0 ? originGbps / edgeInGbps : 0;
  const offload = 1 - share;
  const originRps = (originGbps * 1e9) / (i.objectMB * 8e6);
  const monthlyTB = MONTHLY_TB_AT_REF * (i.peakTbps / REF_PEAK_TBPS) * share;
  const monthlyCost = monthlyTB * 1000 * i.pricePerGB;
  return { edgeInGbps, edgeMissRatio, servedEdgeGbps, toShieldGbps, servedShieldGbps, shieldHitEff, originGbps, offload, originRps, monthlyTB, monthlyCost, popFactor: pf };
}

/** Gbps with a sensible unit: "80 Gbps", "7.6 Tbps". */
export function fmtGbps(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10000 ? 0 : 1)} Tbps`;
  if (g >= 100) return `${Math.round(g)} Gbps`;
  if (g >= 10) return `${g.toFixed(0)} Gbps`;
  return `${g.toFixed(1)} Gbps`;
}

export const pct = (v: number) => {
  const p = v * 100;
  return `${p.toFixed(p >= 100 || p <= 0 ? 0 : p >= 99 ? 2 : 1)}%`;
};
