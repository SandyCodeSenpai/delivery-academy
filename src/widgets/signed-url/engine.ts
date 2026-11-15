/**
 * Signed URL tamper lab: the edge's validation logic, kept free of React.
 * Signature = first 128 bits of HMAC-SHA256(secret, "path|exp|geo"), hex. Computed with WebCrypto.
 */

/** Demo issue time (unix seconds). The clock slider is relative to this. */
export const T0 = 1795000000;
export const SECRET = "demo-edge-secret-7f3a";
export const HOST = "video.example.com";
export const BASE_PATH = "/ep1234/1080p/seg_00042.m4s";
export const OTHER_EP_PATH = "/ep1235/1080p/seg_00042.m4s";
/** Token lifetime in seconds. */
export const TTL = 600;
/** Clock slider range, seconds after issue. */
export const CLOCK_MAX = 1800;

export type Country = "JP" | "US" | "BR" | "DE";
export const COUNTRIES: Country[] = ["JP", "US", "BR", "DE"];

export interface UrlParts { host: string; path: string; exp: string; geo: string; sig: string }

/** Licensing windows for ep1234, in seconds after T0 (demo values). */
export const RIGHTS: Record<Country, { from?: number; until?: number }> = {
  JP: {},
  US: {},
  BR: { until: 360 },
  DE: { from: 900 },
};

export const rel = (s: number) => {
  const sign = s < 0 ? "-" : "+";
  const a = Math.abs(Math.round(s));
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};
const dur = (s: number) => {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

export function licensed(c: Country, nowRel: number): boolean {
  const r = RIGHTS[c];
  return (r.from === undefined || nowRel >= r.from) && (r.until === undefined || nowRel < r.until);
}
export function rightsLabel(c: Country): string {
  const r = RIGHTS[c];
  if (r.from !== undefined) return `from ${rel(r.from)}`;
  if (r.until !== undefined) return `until ${rel(r.until)}`;
  return "open";
}

export const signedString = (p: { path: string; exp: string; geo: string }) => `${p.path}|${p.exp}|${p.geo}`;

export async function hmacHex(secret: string, msg: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto is not available on this page.");
  const enc = new TextEncoder();
  const key = await subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(buf).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** What the playback API would hand out at `nowRel` for a viewer in `geo`. */
export async function issue(nowRel: number, geo: Country, path = BASE_PATH): Promise<UrlParts> {
  const exp = String(T0 + nowRel + TTL);
  return { host: HOST, path, exp, geo, sig: await hmacHex(SECRET, signedString({ path, exp, geo })) };
}

/** Change one hex character so the signature is wrong by exactly one position. */
export function flipChar(sig: string, at = 9): string {
  if (!sig.length) return "0";
  const i = Math.min(at, sig.length - 1);
  const c = sig[i];
  const v = parseInt(c, 16);
  const next = Number.isNaN(v) ? "0" : ((v + 7) % 16).toString(16);
  return sig.slice(0, i) + next + sig.slice(i + 1);
}

export type StepStatus = "pass" | "fail" | "skip";
export interface StepResult { status: StepStatus; detail: string }
export interface Verdict {
  code: 200 | 403 | 410;
  reason: string;
  failAt: number | null;
  steps: StepResult[];
  cacheKey: string;
  hit: boolean;
  expected: string;
  got: string;
}

export const STEP_TITLES = [
  "Parse the URL",
  "Expired? exp vs now",
  "Recompute HMAC and compare",
  "Geo and licensing window",
  "Build the cache key",
  "Serve the segment",
];

export interface EdgeCtx { nowRel: number; viewer: Country; tokenInKey: boolean; cache: Set<string> }

export function cacheKeyOf(p: UrlParts, tokenInKey: boolean): string {
  return `${p.host}${p.path}${tokenInKey ? `?exp=${p.exp}&geo=${p.geo}&sig=${p.sig}` : ""}`;
}

/** Runs the six edge checks in order. Stops at the first failure; later steps are "skip". */
export function evaluate(p: UrlParts, ctx: EdgeCtx, expected: string): Verdict {
  const steps: StepResult[] = [];
  const got = p.sig.trim().toLowerCase();
  const out = (code: Verdict["code"], reason: string, failAt: number | null, cacheKey = "", hit = false): Verdict => {
    while (steps.length < STEP_TITLES.length) steps.push({ status: "skip", detail: "Not reached." });
    return { code, reason, failAt, steps, cacheKey, hit, expected, got };
  };

  // 1. Parse
  const missing = (["path", "exp", "geo", "sig"] as const).filter((k) => !p[k].trim());
  if (missing.length) {
    steps.push({ status: "fail", detail: `Missing ${missing.join(", ")}.` });
    return out(403, `Malformed token: missing ${missing.join(", ")}.`, 0);
  }
  if (!/^\d+$/.test(p.exp.trim())) {
    steps.push({ status: "fail", detail: `exp must be a unix time in seconds, got "${p.exp}".` });
    return out(403, "Malformed token: exp is not a number.", 0);
  }
  if (!/^[0-9a-fA-F]+$/.test(got)) {
    steps.push({ status: "fail", detail: "sig must be hex characters (0-9, a-f)." });
    return out(403, "Malformed token: sig is not hex.", 0);
  }
  steps.push({ status: "pass", detail: `Found path, exp, geo and sig. The host is not signed: it only picks the CDN.` });

  // 2. Expiry
  const now = T0 + ctx.nowRel;
  const exp = Number(p.exp);
  if (now >= exp) {
    steps.push({ status: "fail", detail: `now ${now} is past exp ${exp} by ${dur(now - exp)}.` });
    return out(410, `Token expired ${dur(now - exp)} ago. The edge never computes the HMAC.`, 1);
  }
  steps.push({ status: "pass", detail: `now ${now} < exp ${exp}. ${dur(exp - now)} left.` });

  // 3. HMAC
  if (got !== expected) {
    steps.push({ status: "fail", detail: "Recomputed signature does not match the one in the URL." });
    return out(403, "Signature mismatch: a signed field was changed, or the sig is wrong.", 2);
  }
  steps.push({ status: "pass", detail: "Recomputed signature matches, compared in constant time." });

  // 4. Geo and window
  if (ctx.viewer !== p.geo) {
    steps.push({ status: "fail", detail: `Token is for ${p.geo}. Geo-IP says the viewer is in ${ctx.viewer}.` });
    return out(403, `Territory mismatch: token is scoped to ${p.geo}, request comes from ${ctx.viewer}.`, 3);
  }
  if (!licensed(ctx.viewer, ctx.nowRel)) {
    const r = RIGHTS[ctx.viewer];
    const why = r.until !== undefined ? `window ended at ${rel(r.until)}` : `window opens at ${rel(r.from ?? 0)}`;
    steps.push({ status: "fail", detail: `${ctx.viewer} matches the token, but the ${why}.` });
    return out(403, `Not licensed in ${ctx.viewer} right now: the ${why}.`, 3);
  }
  steps.push({ status: "pass", detail: `Viewer ${ctx.viewer} = token ${p.geo}, and the title is licensed there now.` });

  // 5. Cache key
  const key = cacheKeyOf(p, ctx.tokenInKey);
  steps.push({
    status: "pass",
    detail: ctx.tokenInKey ? "Token kept in the key. This key is unique to this one viewer." : "Token checked, then stripped. All viewers share this key.",
  });

  // 6. Serve
  const hit = ctx.cache.has(key);
  steps.push({ status: "pass", detail: hit ? "Found in the edge cache. Served at once." : "Not in the edge cache. Fetched from the shield, then stored." });
  return out(200, hit ? "Served from edge cache." : "Fetched from shield and cached.", null, key, hit);
}
