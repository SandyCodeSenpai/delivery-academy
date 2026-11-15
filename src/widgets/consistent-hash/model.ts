import { rng } from "@/lib/hooks";
import { hash32, U32 } from "./hash";

export type Mode = "random" | "mod" | "ring";
export const MIN_SERVERS = 3;
export const MAX_SERVERS = 16;

/* ---------- objects (cache keys) ---------- */
export interface Obj {
  /** popularity rank: 0 is the hottest segment */
  i: number;
  key: string;
  h: number;
  /** position on the ring, 0..1 */
  pos: number;
  /** 0..1, used only to spread dots across the ring's inner band */
  jitter: number;
}

export function keyName(i: number): string {
  const ep = 1001 + Math.floor(i / 6);
  return `/ep${ep}/1080p/seg_${String((i % 6) + 1).padStart(3, "0")}.m4s`;
}

export function makeObjects(m: number): Obj[] {
  return Array.from({ length: m }, (_, i) => {
    const key = keyName(i);
    const h = hash32(key);
    return { i, key, h, pos: h / U32, jitter: hash32(`${key}#band`) / U32 };
  });
}

/* ---------- mod N ---------- */
export const ownersMod = (objs: Obj[], servers: number[]): number[] => objs.map((o) => servers[o.h % servers.length]);

/* ---------- consistent hashing ring ---------- */
/** Server names hashed onto the ring, e.g. "dfw-edge-3#0". Chosen so the default (10 servers, 120 keys)
 *  shows a typical ring, not a lucky or extreme one. */
export const SERVER_PREFIX = "dfw-edge-";

export interface VNode { server: number; v: number; pos: number }

export function makeRing(servers: number[], vn: number): VNode[] {
  const out: VNode[] = [];
  for (const s of servers) for (let v = 0; v < vn; v++) out.push({ server: s, v, pos: hash32(`${SERVER_PREFIX}${s}#${v}`) / U32 });
  return out.sort((a, b) => a.pos - b.pos);
}

/** Index of the first ring point clockwise from pos (wrapping). */
export function ringLookup(ring: VNode[], pos: number): number {
  let lo = 0, hi = ring.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ring[mid].pos < pos) lo = mid + 1; else hi = mid;
  }
  return lo === ring.length ? 0 : lo;
}

export function ownersRing(objs: Obj[], ring: VNode[]): { owner: number[]; node: number[] } {
  const node = objs.map((o) => ringLookup(ring, o.pos));
  return { owner: node.map((n) => ring[n].server), node };
}

/* ---------- load ---------- */
export function loadOf(owner: number[], servers: number[]): Map<number, number> {
  const m = new Map<number, number>(servers.map((s) => [s, 0]));
  for (const s of owner) m.set(s, (m.get(s) ?? 0) + 1);
  return m;
}

export function imbalanceOf(load: Map<number, number>): { ratio: number; max: number; maxId: number; avg: number } {
  let max = -1, maxId = 0, sum = 0;
  for (const [id, v] of load) { sum += v; if (v > max) { max = v; maxId = id; } }
  const avg = load.size ? sum / load.size : 0;
  return { ratio: avg > 0 ? max / avg : 1, max, maxId, avg };
}

export const countMoved = (a: number[], b: number[]) => a.reduce((n, s, i) => n + (s !== b[i] ? 1 : 0), 0);

/* ---------- random spray simulation ---------- */
/** Per-server cache size in objects. Independent of N on purpose: adding servers adds capacity. */
export const capacityFor = (m: number) => Math.min(12, Math.max(2, Math.round(m / 20)));

export function zipfCdf(m: number, s = 1.0): number[] {
  const w = Array.from({ length: m }, (_, i) => 1 / Math.pow(i + 1, s));
  const tot = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => (acc += x / tot));
}

export function sampleCdf(cdf: number[], r: number): number {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < r) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export interface Spray {
  /** each server's cache: its C most-requested segments, most requested first */
  caches: Map<number, number[]>;
  /** per-server request counts per segment (what the server has seen) */
  seen: Map<number, Int32Array>;
  reqs: Map<number, number>;
  /** PoP hit ratio with random spray (expected, from true popularity) */
  hitRatio: number;
  /** same catalog, but each key always goes to its owner (hash mod N) */
  ownedHitRatio: number;
}

/** A frequency cache: keep the `cap` segments this server has seen most often. */
export function topK(counts: Int32Array, cap: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] > 0) idx.push(i);
  idx.sort((a, b) => counts[b] - counts[a] || a - b);
  return idx.slice(0, cap);
}

const probs = (cdf: number[]) => cdf.map((c, i) => c - (i ? cdf[i - 1] : 0));

export function warmSpray(servers: number[], objs: Obj[], cap: number, cdf: number[], seed = 7): Spray {
  const r = rng(seed);
  const m = objs.length;
  const seen = new Map<number, Int32Array>(servers.map((s) => [s, new Int32Array(m)]));
  const reqs = new Map<number, number>(servers.map((s) => [s, 0]));
  const total = 400 * servers.length;
  for (let i = 0; i < total; i++) {
    const o = sampleCdf(cdf, r());
    const s = servers[Math.floor(r() * servers.length)];
    seen.get(s)![o]++;
    reqs.set(s, reqs.get(s)! + 1);
  }
  const caches = new Map<number, number[]>(servers.map((s) => [s, topK(seen.get(s)!, cap)]));
  const p = probs(cdf);
  let hit = 0;
  for (const c of caches.values()) hit += c.reduce((a, o) => a + p[o], 0);
  // owner per key: each owner keeps the `cap` most popular keys it owns
  const owner = ownersMod(objs, servers);
  const byOwner = new Map<number, number[]>(servers.map((s) => [s, []]));
  for (let o = 0; o < m; o++) byOwner.get(owner[o])!.push(o); // already in popularity order
  let own = 0;
  for (const list of byOwner.values()) own += list.slice(0, cap).reduce((a, o) => a + p[o], 0);
  return { caches, seen, reqs, hitRatio: hit / servers.length, ownedHitRatio: own };
}

/** One live request on server s. Returns true on a hit. */
export function sprayRequest(sp: Spray, s: number, o: number, cap: number): boolean | null {
  const seen = sp.seen.get(s), cache = sp.caches.get(s);
  if (!seen || !cache) return null;
  const hit = cache.includes(o);
  seen[o]++;
  sp.reqs.set(s, (sp.reqs.get(s) ?? 0) + 1);
  sp.caches.set(s, topK(seen, cap));
  return hit;
}

export function copiesOf(spray: Spray, m: number): number[] {
  const c = new Array<number>(m).fill(0);
  for (const cache of spray.caches.values()) for (const o of cache) c[o]++;
  return c;
}

/* ---------- colors (tokens only) ---------- */
const HUES = ["--p3", "--p2", "--p1", "--p4", "--p5", "--p6"];
/** Stable color per server id (1..16): six part hues, then deeper and paler bands. */
export function serverColor(id: number): string {
  const v = `var(${HUES[(id - 1) % 6]})`;
  const band = Math.floor((id - 1) / 6) % 3;
  if (band === 0) return v;
  if (band === 1) return `color-mix(in srgb, ${v} 58%, var(--ink))`;
  return `color-mix(in srgb, ${v} 55%, var(--surface))`;
}
/** Colors for the six hottest segments in random mode. */
export const TOP_COLORS = HUES.map((h) => `var(${h})`);

/* ---------- motion helpers ---------- */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
