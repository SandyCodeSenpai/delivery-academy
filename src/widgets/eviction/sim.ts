/**
 * Pure cache-eviction simulation for the "What to keep" widget.
 * No React. Everything here is deterministic for a given seed.
 *
 * Model: every object is one equal-sized slot (think "one segment" or "one episode file"),
 * so hit ratio here is a request hit ratio. With equal sizes it equals the byte hit ratio.
 */
import { rng } from "@/lib/hooks";

export type PolicyId = "lru" | "lfu" | "fifo" | "s3fifo";
export const POLICY_IDS: PolicyId[] = ["lru", "lfu", "fifo", "s3fifo"];
export const POLICY_NAME: Record<PolicyId, string> = { lru: "LRU", lfu: "LFU", fifo: "FIFO", s3fifo: "S3-FIFO" };
export const POLICY_COLOR: Record<PolicyId, string> = { lru: "var(--p2)", lfu: "var(--p6)", fifo: "var(--p4)", s3fifo: "var(--p1)" };
export const POLICY_BLURB: Record<PolicyId, string> = {
  lru: "Evicts the object untouched for longest.",
  lfu: "Evicts the object with the fewest hits.",
  fifo: "Evicts the oldest arrival. Hits change nothing.",
  s3fifo: "Small probation queue, main queue, ghost keys.",
};

/* ------------------------------------------------------------------ objects */

export type Kind = "hot" | "tail" | "sim" | "ohw";
const SIM_BASE = 100_000;
const OHW_BASE = 200_000;
/** Catalog ranks below this count as "popular" for tile color. */
export const HOT_RANKS = 20;

export function kindOf(key: number): Kind {
  if (key >= OHW_BASE) return "ohw";
  if (key >= SIM_BASE) return "sim";
  return key < HOT_RANKS ? "hot" : "tail";
}
/** Short tile label. */
export function labelOf(key: number): string {
  if (key >= OHW_BASE) return "old";
  if (key >= SIM_BASE) return `S${key - SIM_BASE + 1}`;
  return `#${key + 1}`;
}
/** Words for explanations. */
export function nameOf(key: number): string {
  if (key >= OHW_BASE) return `old episode ${key - OHW_BASE + 1} (one-hit wonder)`;
  if (key >= SIM_BASE) return `simulcast segment ${key - SIM_BASE + 1}`;
  return `catalog episode #${key + 1}`;
}

/* ------------------------------------------------------------------- stream */

export interface StreamParams { seed: number; zipf: number; ohw: number; simulcast: boolean; n: number; catalog: number }
export interface Stream {
  p: StreamParams;
  keys: Int32Array;
  /** index of the next request for the same key, or n if never again */
  next: Int32Array;
  /** [start, end) of the simulcast burst, or null */
  burst: [number, number] | null;
}

export const SIM_SEGMENTS = 30;
const SIM_SHARE = 0.5; // share of non-one-hit-wonder requests that go to the premiere during the burst

export function makeStream(p: StreamParams): Stream {
  const r = rng(p.seed * 7919 + 13);
  for (let i = 0; i < 5; i++) r();
  // Zipf CDF over the catalog: P(rank k) is proportional to 1 / (k + 1)^s
  const cdf = new Float64Array(p.catalog);
  let acc = 0;
  for (let k = 0; k < p.catalog; k++) { acc += 1 / Math.pow(k + 1, p.zipf); cdf[k] = acc; }
  const pick = () => {
    const u = r() * acc;
    let lo = 0, hi = p.catalog - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    return lo;
  };
  const burst: [number, number] | null = p.simulcast ? [Math.round(p.n * 0.25), Math.round(p.n * 0.7)] : null;
  const keys = new Int32Array(p.n);
  let ohwCount = 0;
  for (let i = 0; i < p.n; i++) {
    const u = r();
    if (u < p.ohw) { keys[i] = OHW_BASE + ohwCount++; continue; }
    if (burst && i >= burst[0] && i < burst[1] && r() < SIM_SHARE) {
      // Viewers watch the premiere roughly together: requests cluster around a moving playhead.
      const prog = (i - burst[0]) / (burst[1] - burst[0]);
      const head = prog * (SIM_SEGMENTS - 1);
      const lag = Math.floor(r() * r() * 5); // most viewers near the live edge, a few behind
      keys[i] = SIM_BASE + Math.max(0, Math.min(SIM_SEGMENTS - 1, Math.round(head) - lag));
      continue;
    }
    keys[i] = pick();
  }
  const next = new Int32Array(p.n);
  const seen = new Map<number, number>();
  for (let i = p.n - 1; i >= 0; i--) { next[i] = seen.get(keys[i]) ?? p.n; seen.set(keys[i], i); }
  return { p, keys, next, burst };
}

/* ----------------------------------------------------------------- policies */

export interface InsertResult { evicted: number; note: string }
interface Engine {
  has(k: number): boolean;
  size(): number;
  onHit(k: number, t: number): void;
  /** Insert k (not present). Evicts first if the cache is full. */
  insert(k: number, t: number): InsertResult;
  /** 0 = plain, 1 = S3-FIFO small queue, 2 = S3-FIFO main queue */
  flag(k: number): number;
  ghosts(): number;
}

const ago = (t: number, then: number) => `${t - then} request${t - then === 1 ? "" : "s"} ago`;

class LRU implements Engine {
  private m = new Map<number, number>(); // key -> last access; Map order = recency order
  constructor(private cap: number) {}
  has(k: number) { return this.m.has(k); }
  size() { return this.m.size; }
  onHit(k: number, t: number) { this.m.delete(k); this.m.set(k, t); }
  insert(k: number, t: number): InsertResult {
    let evicted = -1, note = "";
    if (this.m.size >= this.cap) {
      const [vk, vt] = this.m.entries().next().value as [number, number];
      this.m.delete(vk); evicted = vk;
      note = `Evicted ${nameOf(vk)}: last used ${ago(t, vt)}, the longest of anything in the cache.`;
    }
    this.m.set(k, t);
    return { evicted, note };
  }
  flag() { return 0; }
  ghosts() { return 0; }
}

class FIFO implements Engine {
  private m = new Map<number, { t: number; hits: number }>(); // Map order = arrival order
  constructor(private cap: number) {}
  has(k: number) { return this.m.has(k); }
  size() { return this.m.size; }
  onHit(k: number) { const e = this.m.get(k); if (e) e.hits++; }
  insert(k: number, t: number): InsertResult {
    let evicted = -1, note = "";
    if (this.m.size >= this.cap) {
      const [vk, v] = this.m.entries().next().value as [number, { t: number; hits: number }];
      this.m.delete(vk); evicted = vk;
      note = `Evicted ${nameOf(vk)}: it arrived first (${ago(t, v.t)}).` +
        (v.hits > 0 ? ` Its ${v.hits} hit${v.hits === 1 ? "" : "s"} did not save it, because FIFO ignores hits.` : "");
    }
    this.m.set(k, { t, hits: 0 });
    return { evicted, note };
  }
  flag() { return 0; }
  ghosts() { return 0; }
}

class LFU implements Engine {
  private m = new Map<number, { f: number; t: number }>();
  constructor(private cap: number) {}
  has(k: number) { return this.m.has(k); }
  size() { return this.m.size; }
  onHit(k: number, t: number) { const e = this.m.get(k); if (e) { e.f++; e.t = t; } }
  insert(k: number, t: number): InsertResult {
    let evicted = -1, note = "";
    if (this.m.size >= this.cap) {
      let vk = -1, vf = Infinity, vt = Infinity, ties = 0;
      for (const [key, e] of this.m) {
        if (e.f < vf || (e.f === vf && e.t < vt)) { vk = key; vf = e.f; vt = e.t; }
      }
      for (const e of this.m.values()) if (e.f === vf) ties++;
      this.m.delete(vk); evicted = vk;
      note = `Evicted ${nameOf(vk)}: it had the fewest requests in cache (${vf})` +
        (ties > 1 ? `, and of the ${ties} tied it was used longest ago.` : ".");
    }
    this.m.set(k, { f: 1, t });
    return { evicted, note };
  }
  flag() { return 0; }
  ghosts() { return 0; }
}

/**
 * S3-FIFO (Yang et al., SOSP 2023), simplified to unit-size objects.
 * - New objects enter the small FIFO S (10% of slots). Ghost-queue keys go straight to main FIFO M.
 * - A hit only bumps a counter capped at 3. Nothing moves on a hit.
 * - Evict from S when S holds at least its 10% share: the tail moves to M if it was hit while in S
 *   (counter cleared), otherwise its data leaves and its key goes to the ghost queue G.
 * - Evict from M otherwise: a tail with counter > 0 is reinserted at the head with counter - 1
 *   (a second chance); a tail with counter 0 leaves.
 * - G remembers as many keys as M holds slots, in FIFO order.
 */
/** Slots for the S3-FIFO small queue (10%, at least 1). The ghost queue holds cap - smallCap keys. */
export const smallCap = (cap: number) => Math.max(1, Math.round(cap * 0.1));

class S3FIFO implements Engine {
  private S: number[] = []; // index 0 = tail (oldest)
  private M: number[] = [];
  private G: number[] = [];
  private gset = new Set<number>();
  private freq = new Map<number, number>();
  private where = new Map<number, 1 | 2>();
  readonly sCap: number;
  readonly gCap: number;
  constructor(private cap: number) {
    this.sCap = smallCap(cap);
    this.gCap = cap - this.sCap;
  }
  has(k: number) { return this.where.has(k); }
  size() { return this.S.length + this.M.length; }
  onHit(k: number) { this.freq.set(k, Math.min(3, (this.freq.get(k) ?? 0) + 1)); }
  flag(k: number) { return this.where.get(k) ?? 0; }
  ghosts() { return this.G.length; }
  private ghost(k: number) {
    this.G.push(k); this.gset.add(k);
    while (this.G.length > this.gCap) this.gset.delete(this.G.shift()!);
  }
  private evictOne(): InsertResult {
    const steps: string[] = [];
    let promoted = 0, second = 0;
    for (;;) {
      if (this.S.length > 0 && (this.S.length >= this.sCap || this.M.length === 0)) {
        const v = this.S.shift()!;
        if ((this.freq.get(v) ?? 0) >= 1) {
          this.freq.set(v, 0); this.M.push(v); this.where.set(v, 2); promoted++;
          if (promoted <= 2) steps.push(`${nameOf(v)} was hit while on probation, so it moved to the main queue`);
          continue;
        }
        this.where.delete(v); this.freq.delete(v); this.ghost(v);
        const lead = steps.length ? `${steps.join("; ")}. Then ` : "";
        return { evicted: v, note: `${lead}${lead ? "e" : "E"}victed ${nameOf(v)} from the small queue: no hit since it arrived. Its key goes to the ghost queue.` };
      }
      const v = this.M.shift()!;
      const f = this.freq.get(v) ?? 0;
      if (f > 0) {
        this.freq.set(v, f - 1); this.M.push(v); second++;
        continue;
      }
      this.where.delete(v); this.freq.delete(v);
      const parts = [...steps];
      if (promoted > 2) parts.push(`${promoted - 2} more moved up`);
      if (second > 0) parts.push(`${second} main-queue object${second === 1 ? "" : "s"} with hits got a second chance (counter minus one)`);
      const lead = parts.length ? `${parts.join("; ")}. Then ` : "";
      return { evicted: v, note: `${lead}${lead ? "e" : "E"}victed ${nameOf(v)} from the main queue: its hit counter had run down to 0.` };
    }
  }
  insert(k: number): InsertResult {
    let res: InsertResult = { evicted: -1, note: "" };
    if (this.size() >= this.cap) res = this.evictOne();
    if (this.gset.has(k)) {
      this.gset.delete(k); this.G.splice(this.G.indexOf(k), 1);
      this.M.push(k); this.where.set(k, 2);
      res.note = `Its key was in the ghost queue (seen recently), so it skips probation and enters the main queue. ${res.note}`.trim();
    } else {
      this.S.push(k); this.where.set(k, 1);
    }
    this.freq.set(k, 0);
    return res;
  }
}

function makeEngine(id: PolicyId, cap: number): Engine {
  switch (id) {
    case "lru": return new LRU(cap);
    case "lfu": return new LFU(cap);
    case "fifo": return new FIFO(cap);
    case "s3fifo": return new S3FIFO(cap);
  }
}

/* -------------------------------------------------------------------- trace */

export type Outcome = "hit" | "stored" | "bypass";
export interface Trace {
  policy: PolicyId;
  cap: number;
  admit: boolean;
  /** state AFTER request i: slots[i * cap + s] = key or -1 */
  slots: Int32Array;
  /** S3-FIFO queue flag per slot, same layout */
  flags: Uint8Array;
  ghosts: Int16Array;
  /** cumulative hits after request i */
  cum: Int32Array;
  outcome: Outcome[];
  evicted: Int32Array;
  /** slot written at request i (-1 = none) */
  slotAt: Int16Array;
  note: string[];
  hitRatio: number;
}

/** Akamai-style cache-on-second-hit: two rotating "seen once" sets. */
export const ADMIT_WINDOW = 500;

export function runTrace(stream: Stream, policy: PolicyId, cap: number, admit: boolean, keepFrames = true): Trace {
  const n = stream.keys.length;
  const eng = makeEngine(policy, cap);
  const slots = new Int32Array(keepFrames ? n * cap : 0).fill(-1);
  const flags = new Uint8Array(keepFrames ? n * cap : 0);
  const ghosts = new Int16Array(n);
  const cum = new Int32Array(n);
  const outcome: Outcome[] = new Array(n);
  const evicted = new Int32Array(n).fill(-1);
  const slotAt = new Int16Array(n).fill(-1);
  const note: string[] = new Array(n);
  const cur = new Int32Array(cap).fill(-1);
  const slotOf = new Map<number, number>();
  let seenA = new Set<number>(), seenB = new Set<number>();
  let hits = 0;
  for (let i = 0; i < n; i++) {
    if (admit && i > 0 && i % ADMIT_WINDOW === 0) { seenB = seenA; seenA = new Set(); }
    const k = stream.keys[i];
    if (eng.has(k)) {
      eng.onHit(k, i); hits++; outcome[i] = "hit"; note[i] = "";
    } else if (admit && !seenA.has(k) && !seenB.has(k)) {
      seenA.add(k); outcome[i] = "bypass";
      note[i] = "First time this key is seen, so it is served from upstream but not stored. It is stored only if it comes back.";
    } else {
      const r = eng.insert(k, i);
      outcome[i] = "stored";
      let s: number;
      if (r.evicted >= 0) { s = slotOf.get(r.evicted)!; slotOf.delete(r.evicted); evicted[i] = r.evicted; }
      else s = cur.indexOf(-1);
      cur[s] = k; slotOf.set(k, s); slotAt[i] = s;
      note[i] = r.note || "The cache had a free slot, so nothing was evicted.";
      if (admit && (seenA.has(k) || seenB.has(k))) note[i] = `Second request inside the window, so it is admitted. ${note[i]}`;
    }
    cum[i] = hits;
    ghosts[i] = eng.ghosts();
    if (keepFrames) {
      const base = i * cap;
      for (let s = 0; s < cap; s++) {
        slots[base + s] = cur[s];
        if (policy === "s3fifo" && cur[s] >= 0) flags[base + s] = eng.flag(cur[s]);
      }
    }
  }
  return { policy, cap, admit, slots, flags, ghosts, cum, outcome, evicted, slotAt, note, hitRatio: n ? hits / n : 0 };
}

/** Belady's clairvoyant optimum with bypass: knows the future, evicts the object needed farthest ahead. */
export function runOptimal(stream: Stream, cap: number): Int32Array {
  const n = stream.keys.length;
  const nextOf = new Map<number, number>(); // cached key -> next request index
  const cum = new Int32Array(n);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const k = stream.keys[i], nx = stream.next[i];
    if (nextOf.has(k)) { hits++; nextOf.set(k, nx); }
    else if (nx < n) {
      if (nextOf.size < cap) nextOf.set(k, nx);
      else {
        let vk = -1, vn = -1;
        for (const [key, v] of nextOf) if (v > vn) { vn = v; vk = key; }
        if (vn > nx) { nextOf.delete(vk); nextOf.set(k, nx); }
      }
    }
    cum[i] = hits;
  }
  return cum;
}

/** Final hit ratio of every policy with and without admission, for honest predict answers. */
export function finals(stream: Stream, cap: number): Record<PolicyId, { plain: number; admit: number }> {
  const out = {} as Record<PolicyId, { plain: number; admit: number }>;
  for (const id of POLICY_IDS) {
    out[id] = { plain: runTrace(stream, id, cap, false, false).hitRatio, admit: runTrace(stream, id, cap, true, false).hitRatio };
  }
  return out;
}
