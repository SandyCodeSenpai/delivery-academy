/**
 * Cache-Control lab: pure simulation (no React).
 * Semantics follow RFC 9111 as Chapter 4 explains them, plus the RFC 5861 stale extensions:
 * - A response is fresh while age < lifetime. Shared caches use s-maxage, else max-age. Browsers ignore s-maxage.
 * - no-store: nobody stores it. private: shared caches (the CDN) must not store it; a browser may.
 * - no-cache: may store, but must revalidate before every reuse (no stale serving).
 * - s-maxage carries proxy-revalidate semantics for shared caches: once stale, the CDN must revalidate,
 *   so stale-while-revalidate and stale-if-error do not apply at the CDN under a strict reading.
 * - stale-while-revalidate=N: for N seconds after going stale, serve the stored copy at once and refresh
 *   in the background. A failed background refresh does not hurt the viewer.
 * - stale-if-error=N: if revalidation fails (origin down), serve the stored copy for up to N seconds of staleness.
 * - A validator (ETag) turns a re-download into a conditional request: 304 Not Modified, no body.
 * - Vary adds request headers to the cache key, so each distinct value gets its own copy.
 */

export type ObjType = "segment" | "manifest" | "live";
export type VaryMode = "none" | "ae" | "ua";
export type Outcome = "HIT" | "MISS" | "STALE" | "REVALIDATE" | "SIE" | "ERROR";

export interface Headers {
  maxAge: number;
  sMaxage: number | null;
  swr: number;
  sie: number;
  noStore: boolean;
  priv: boolean;
  noCache: boolean;
  etag: boolean;
  immutable: boolean;
  vary: VaryMode;
  obj: ObjType;
}

export interface Req { id: number; t: number; client: number }

export interface Scenario { headers: Headers; reqs: Req[]; originDown: boolean; downFrom: number }

export interface Result {
  req: Req;
  /** 1-based position in time order. */
  n: number;
  outcome: Outcome;
  key: string;
  /** Age of the copy the CDN looked at, or null if it had none. */
  age: number | null;
  /** Requests the CDN sent to the origin for this viewer request (including failed attempts). */
  originReqs: number;
  originFailed: number;
  originBytes: number;
  /** Did the body the viewer got come from the CDN's store? */
  fromCache: boolean;
  /** Background refresh result for STALE. */
  bg?: "304" | "200" | "fail";
  /** Content version served vs. the origin's current version (live playlists change). */
  servedVersion: number | null;
  originVersion: number;
  /** Short plain-English explanation. */
  note: string;
}

export const N = 60; // timeline length in seconds

export const CLIENTS = [
  { name: "Chrome Mac", short: "Mac", ua: "Chrome/131 (Macintosh)", ae: "br" },
  { name: "iPhone", short: "iPhone", ua: "Safari/18 (iPhone)", ae: "br" },
  { name: "Android", short: "Android", ua: "ExoPlayer/2.19 (Android 14)", ae: "gzip" },
  { name: "Smart TV", short: "TV", ua: "Tizen/8.0 (SmartTV)", ae: "gzip" },
  { name: "Chrome Win", short: "Windows", ua: "Chrome/130 (Windows NT 10.0)", ae: "br" },
];

export const OBJ: Record<ObjType, { label: string; short: string; ctype: string; bytes: number; etag: string; changesEvery: number | null; path: string }> = {
  segment: { label: "VOD segment", short: "Segment", ctype: "video/mp4", bytes: 2_500_000, etag: "\"sha256-3f1a9c\"", changesEvery: null, path: "/ep123/1080p/seg_00042.m4s" },
  manifest: { label: "VOD manifest", short: "Manifest", ctype: "application/vnd.apple.mpegurl", bytes: 20_000, etag: "\"m-v7-ep123\"", changesEvery: null, path: "/ep123/master.m3u8" },
  live: { label: "Live media playlist", short: "Live playlist", ctype: "application/vnd.apple.mpegurl", bytes: 2_000, etag: "\"live-1042\"", changesEvery: 4, path: "/live/ch1/1080p.m3u8" },
};

/** A 304 carries headers only: "a few hundred bytes". */
export const NOT_MODIFIED_BYTES = 300;

/** Content version the origin holds at time t. A live playlist gets a new segment every 4 s (assumed). */
export function versionAt(obj: ObjType, t: number): number {
  const every = OBJ[obj].changesEvery;
  return every ? Math.floor(t / every) : 0;
}

export function cacheKey(h: Headers, client: number): string {
  if (h.vary === "ae") return CLIENTS[client].ae;
  if (h.vary === "ua") return CLIENTS[client].ua;
  return "*";
}

export function variantCount(h: Headers): number {
  return new Set(CLIENTS.map((_, i) => cacheKey(h, i))).size;
}

export interface Policy {
  stores: boolean;
  ttl: number;
  ttlFrom: "s-maxage" | "max-age" | "no-cache";
  swr: number;
  sie: number;
  /** Why stale serving is off even though the header asks for it, if so. */
  staleBlockedBy: "s-maxage" | "no-cache" | null;
  noStoreReason: "no-store" | "private" | null;
}

/** What the CDN (a shared cache) does with these headers. */
export function cdnPolicy(h: Headers): Policy {
  const noStoreReason = h.noStore ? "no-store" : h.priv ? "private" : null;
  const ttlFrom = h.noCache ? "no-cache" : h.sMaxage !== null ? "s-maxage" : "max-age";
  const ttl = h.noCache ? 0 : h.sMaxage ?? h.maxAge;
  const staleBlockedBy = h.noCache ? "no-cache" : h.sMaxage !== null ? "s-maxage" : null;
  return {
    stores: !noStoreReason, ttl, ttlFrom,
    swr: staleBlockedBy ? 0 : h.swr, sie: staleBlockedBy ? 0 : h.sie,
    staleBlockedBy: staleBlockedBy && (h.swr > 0 || h.sie > 0) ? staleBlockedBy : null,
    noStoreReason,
  };
}

/** What one viewer's browser (a private cache) does with these headers. */
export function browserPolicy(h: Headers): Policy {
  const ttlFrom = h.noCache ? "no-cache" : "max-age";
  return {
    stores: !h.noStore, ttl: h.noCache ? 0 : h.maxAge, ttlFrom,
    swr: h.noCache ? 0 : h.swr, sie: h.noCache ? 0 : h.sie,
    staleBlockedBy: h.noCache && (h.swr > 0 || h.sie > 0) ? "no-cache" : null,
    noStoreReason: h.noStore ? "no-store" : null,
  };
}

const ago = (s: number) => `${s} s old`;

export function simulate(s: Scenario): Result[] {
  const h = s.headers;
  const pol = cdnPolicy(h);
  const size = OBJ[h.obj].bytes;
  const store = new Map<string, { ts: number; version: number }>();
  const sorted = [...s.reqs].sort((a, b) => a.t - b.t || a.id - b.id);
  return sorted.map((req, i): Result => {
    const t = req.t;
    const up = !(s.originDown && t >= s.downFrom);
    const ver = versionAt(h.obj, t);
    const key = cacheKey(h, req.client);
    const base = { req, n: i + 1, key, originVersion: ver };
    const e = store.get(key);

    if (!pol.stores) {
      const why = pol.noStoreReason === "private" ? "private: the CDN may not store it" : "no-store: nothing may store it";
      return up
        ? { ...base, outcome: "MISS", age: null, originReqs: 1, originFailed: 0, originBytes: size, fromCache: false, servedVersion: ver, note: `${why}, so it goes to the origin again` }
        : { ...base, outcome: "ERROR", age: null, originReqs: 1, originFailed: 1, originBytes: 0, fromCache: false, servedVersion: null, note: `${why}, and the origin is down: 504` };
    }

    if (!e) {
      if (!up) return { ...base, outcome: "ERROR", age: null, originReqs: 1, originFailed: 1, originBytes: 0, fromCache: false, servedVersion: null, note: "no copy for this cache key, and the origin is down: 504" };
      store.set(key, { ts: t, version: ver });
      const first = h.vary !== "none" && store.size > 1 ? `first request with this ${h.vary === "ua" ? "User-Agent" : "Accept-Encoding"}` : "no copy yet";
      return { ...base, outcome: "MISS", age: null, originReqs: 1, originFailed: 0, originBytes: size, fromCache: false, servedVersion: ver, note: `${first}: fetched from origin and stored` };
    }

    const age = t - e.ts;
    if (age < pol.ttl) {
      return { ...base, outcome: "HIT", age, originReqs: 0, originFailed: 0, originBytes: 0, fromCache: true, servedVersion: e.version, note: `${ago(age)}, fresh for ${fmtDur(pol.ttl - age)} more` };
    }

    const staleness = age - pol.ttl;
    const same = h.etag && e.version === ver;

    if (pol.swr > 0 && staleness < pol.swr) {
      const served = e.version;
      if (up) {
        store.set(key, { ts: t, version: ver });
        const bg = same ? "304" : "200";
        return { ...base, outcome: "STALE", age, originReqs: 1, originFailed: 0, originBytes: same ? NOT_MODIFIED_BYTES : size, fromCache: true, bg, servedVersion: served,
          note: `${ago(age)}, inside the swr window: served at once; background refresh got ${bg === "304" ? "304" : "a full 200"}` };
      }
      return { ...base, outcome: "STALE", age, originReqs: 1, originFailed: 1, originBytes: 0, fromCache: true, bg: "fail", servedVersion: served,
        note: `${ago(age)}, inside the swr window: served at once; background refresh failed, viewer did not wait` };
    }

    if (up) {
      if (same) {
        store.set(key, { ts: t, version: ver });
        return { ...base, outcome: "REVALIDATE", age, originReqs: 1, originFailed: 0, originBytes: NOT_MODIFIED_BYTES, fromCache: true, servedVersion: ver,
          note: `${ago(age)}, stale: asked with If-None-Match, got 304, served the stored body` };
      }
      store.set(key, { ts: t, version: ver });
      const why = !h.etag ? "no ETag to ask with, so a full download" : "the playlist changed, so 200 with a new body";
      return { ...base, outcome: "MISS", age, originReqs: 1, originFailed: 0, originBytes: size, fromCache: false, servedVersion: ver, note: `${ago(age)}, stale: ${why}` };
    }

    if (pol.sie > 0 && staleness < pol.sie) {
      return { ...base, outcome: "SIE", age, originReqs: 1, originFailed: 1, originBytes: 0, fromCache: true, servedVersion: e.version,
        note: `${ago(age)}, stale; origin failed, so stale-if-error served the stored copy` };
    }
    const why = pol.staleBlockedBy === "s-maxage" ? "s-maxage forbids stale at the CDN" : pol.staleBlockedBy === "no-cache" ? "no-cache forbids stale" : pol.sie > 0 ? "past the stale-if-error window" : "no stale-if-error";
    return { ...base, outcome: "ERROR", age, originReqs: 1, originFailed: 1, originBytes: 0, fromCache: false, servedVersion: null, note: `${ago(age)}, stale; origin down and ${why}: 504` };
  });
}

export function fmtDur(s: number): string {
  if (s >= 31536000) return `${Math.round(s / 31536000)} yr`;
  if (s >= 86400) return `${Math.round(s / 86400)} d`;
  if (s >= 3600) return `${Math.round(s / 3600)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${s} s`;
}

export function cacheControl(h: Headers): string {
  const d: string[] = [];
  if (h.noStore) d.push("no-store");
  if (h.priv) d.push("private");
  if (h.noCache) d.push("no-cache");
  d.push(`max-age=${h.maxAge}`);
  if (h.sMaxage !== null) d.push(`s-maxage=${h.sMaxage}`);
  if (h.swr > 0) d.push(`stale-while-revalidate=${h.swr}`);
  if (h.sie > 0) d.push(`stale-if-error=${h.sie}`);
  if (h.immutable) d.push("immutable");
  return d.join(", ");
}

export function headerLines(h: Headers): { name: string; value: string }[] {
  const o = OBJ[h.obj];
  const lines = [
    { name: "content-type", value: o.ctype },
    { name: "content-length", value: String(o.bytes) },
    { name: "cache-control", value: cacheControl(h) },
  ];
  if (h.etag) lines.push({ name: "etag", value: o.etag });
  if (h.vary !== "none") lines.push({ name: "vary", value: h.vary === "ae" ? "Accept-Encoding" : "User-Agent" });
  return lines;
}

/* ---------------- presets ---------------- */

export interface Predict {
  q: string;
  /** "outcome": answer is the outcome of request number `n`. "origin": answer is the number of origin requests. */
  kind: "outcome" | "origin";
  n?: number;
  options: string[];
  explain: string;
}

export interface Preset {
  id: string;
  label: string;
  short: string;
  headers: Headers;
  times: number[];
  originDown: boolean;
  downFrom: number;
  predict: Predict;
  lesson: string;
  mistake?: boolean;
}

const GOOD_SEGMENT: Headers = { maxAge: 31536000, sMaxage: null, swr: 0, sie: 0, noStore: false, priv: false, noCache: false, etag: true, immutable: true, vary: "none", obj: "segment" };

export const PRESETS: Preset[] = [
  {
    id: "vod-segment", label: "VOD segment (long TTL, immutable)", short: "VOD segment",
    headers: GOOD_SEGMENT, times: [0, 6, 13, 21, 27, 34, 40, 47, 55], originDown: true, downFrom: 30,
    predict: {
      q: "The origin goes down at t=30 s. What does request 6 (t=34 s) get?", kind: "outcome", n: 6,
      options: ["HIT", "SIE", "ERROR"],
      explain: "The copy stored at t=0 s is fresh for a year, so the CDN never asks the origin. An origin outage is invisible to viewers.",
    },
    lesson: "Versioned, immutable segment URLs can be cached for a year. One MISS, then hits, even while the origin is down.",
  },
  {
    id: "live-playlist", label: "Live playlist (short TTL + swr)", short: "Live playlist",
    headers: { maxAge: 2, sMaxage: null, swr: 4, sie: 0, noStore: false, priv: false, noCache: false, etag: true, immutable: false, vary: "none", obj: "live" },
    times: [0, 1, 3, 6, 10, 11, 17, 24, 25, 31, 38, 41, 45, 53], originDown: true, downFrom: 40,
    predict: {
      q: "Fresh for 2 s, swr=4, and the origin dies at t=40 s. What does request 12 (t=41 s) get?", kind: "outcome", n: 12,
      options: ["STALE", "SIE", "ERROR"],
      explain: "The copy from t=38 s is 3 s old: 2 s fresh, then 1 s into the 4 s swr window. The CDN serves it at once. Its background refresh fails, but the viewer never waits for it. Request 13 (t=45 s) is past the window and gets ERROR. Add stale-if-error to ride out the outage.",
    },
    lesson: "A live playlist changes every segment (every 4 s here, assumed). A short TTL keeps it current; swr hides the origin round trip from viewers.",
  },
  {
    id: "no-store", label: "Mistake: no-store on segments", short: "no-store", mistake: true,
    headers: { ...GOOD_SEGMENT, noStore: true }, times: [0, 4, 9, 15, 22, 30, 38, 47], originDown: false, downFrom: 45,
    predict: {
      q: "Eight viewers ask for the same 2.5 MB segment. How many requests reach the origin?", kind: "origin",
      options: ["1", "4", "8"],
      explain: "no-store means no cache may keep the response, and it wins over max-age. Every request is a full 2.5 MB origin fetch. At a premiere that is the whole audience on the origin.",
    },
    lesson: "no-store beats every other directive. A framework that adds it by default turns a CDN into an expensive proxy.",
  },
  {
    id: "vary-ua", label: "Mistake: Vary: User-Agent", short: "Vary: UA", mistake: true,
    headers: { ...GOOD_SEGMENT, vary: "ua" }, times: [0, 3, 7, 12, 18, 24, 31, 39, 46, 54], originDown: false, downFrom: 45,
    predict: {
      q: "Ten requests for one segment come from five kinds of device. How many go to the origin?", kind: "origin",
      options: ["1", "5", "10"],
      explain: "Vary: User-Agent makes the User-Agent part of the cache key. Each device type needs its own copy, so the first request from each one is a MISS. Real traffic has thousands of User-Agent strings.",
    },
    lesson: "Segments are not compressed, localized or personalized. They should carry no Vary at all.",
  },
];

export function presetById(id: string | undefined): Preset | undefined {
  if (!id) return undefined;
  const k = id.toLowerCase();
  return PRESETS.find((p) => p.id === k || p.label.toLowerCase() === k || p.short.toLowerCase() === k);
}

export function presetReqs(p: Preset): Req[] {
  return p.times.map((t, i) => ({ id: i + 1, t, client: i % CLIENTS.length }));
}

export function presetScenario(p: Preset): Scenario {
  return { headers: p.headers, reqs: presetReqs(p), originDown: p.originDown, downFrom: p.downFrom };
}

/** The correct predict answer, computed from the simulation so it can never drift from the logic. */
export function predictAnswer(p: Preset, results: Result[]): string {
  if (p.predict.kind === "origin") return String(results.reduce((a, r) => a + r.originReqs, 0));
  const r = results.find((x) => x.n === p.predict.n);
  return r ? r.outcome : "";
}

export const OUTCOME_LABEL: Record<Outcome, string> = { HIT: "HIT", MISS: "MISS", STALE: "STALE", REVALIDATE: "REVALIDATE", SIE: "STALE-IF-ERROR", ERROR: "ERROR" };
export const OUTCOME_SHORT: Record<Outcome, string> = { HIT: "HIT", MISS: "MISS", STALE: "STALE", REVALIDATE: "304", SIE: "SIE", ERROR: "ERR" };
export const OUTCOME_COLOR: Record<Outcome, string> = { HIT: "var(--good)", MISS: "var(--warn)", STALE: "var(--p2)", REVALIDATE: "var(--p3)", SIE: "var(--p1)", ERROR: "var(--bad)" };
export const OUTCOME_HELP: Record<Outcome, string> = {
  HIT: "fresh copy, no origin trip",
  MISS: "full body fetched from origin",
  STALE: "stale copy served, refresh in background",
  REVALIDATE: "304 Not Modified, no body re-sent",
  SIE: "origin failed, stale copy served",
  ERROR: "nothing to serve: 504",
};
