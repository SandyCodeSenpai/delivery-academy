/**
 * Stage geometry. Pure functions: node positions for three layouts, and the cubic
 * Bezier for every link. The packet animation follows exactly the same curves the
 * stage draws, so it never drifts off a line.
 *
 * - wide:    full lab mode, flows left to right, viewBox 920 x 500
 * - compact: lesson mode, same flow, fewer labels, viewBox 600 x 300
 * - tall:    phone width, flows top to bottom, viewBox 340 x 560
 */
import { CDNS, REGIONS, type Cdn, type NodeId, type Region } from "./model";

export type LayoutKind = "wide" | "compact" | "tall";
export interface Pt { x: number; y: number }
export interface Cubic { a: Pt; c1: Pt; c2: Pt; b: Pt }
export interface Layout {
  kind: LayoutKind;
  w: number; h: number;
  dir: "h" | "v";
  pos: Record<string, Pt>;
  r: { viewer: number; steer: number; edge: number; shield: number; origin: number };
  font: number;       // label size in viewBox units (renders at >= 12px)
  showSub: boolean;   // second label line (e.g. "Fastly-like")
  headers: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }[];
}

export function makeLayout(kind: LayoutKind): Layout {
  const pos: Record<string, Pt> = {};
  if (kind === "tall") {
    const xs = [44, 128, 212, 296];
    REGIONS.forEach((r, i) => {
      pos[`viewer:${r}`] = { x: xs[i], y: 64 };
      pos[`edge:A:${r}`] = { x: xs[i], y: 214 };
      pos[`edge:B:${r}`] = { x: xs[i], y: 264 };
    });
    pos.steer = { x: 170, y: 140 };
    pos["shield:A"] = { x: 100, y: 372 };
    pos["shield:B"] = { x: 240, y: 372 };
    pos.s3 = { x: 100, y: 486 };
    pos.gcs = { x: 240, y: 486 };
    return {
      kind, w: 340, h: 556, dir: "v", pos, font: 13, showSub: false,
      r: { viewer: 17, steer: 17, edge: 13, shield: 21, origin: 21 },
      headers: [],
    };
  }
  if (kind === "compact") {
    const ys = [50, 106, 162, 218];
    REGIONS.forEach((r, i) => {
      pos[`viewer:${r}`] = { x: 56, y: ys[i] };
      pos[`edge:A:${r}`] = { x: 262, y: ys[i] - 13.5 };
      pos[`edge:B:${r}`] = { x: 262, y: ys[i] + 13.5 };
    });
    pos.steer = { x: 160, y: 20 };
    pos["shield:A"] = { x: 410, y: 88 };
    pos["shield:B"] = { x: 410, y: 180 };
    pos.s3 = { x: 540, y: 88 };
    pos.gcs = { x: 540, y: 180 };
    return {
      kind, w: 600, h: 252, dir: "h", pos, font: 12.5, showSub: false,
      r: { viewer: 15, steer: 14, edge: 11, shield: 19, origin: 19 },
      headers: [],
    };
  }
  const ys = [150, 250, 350, 450];
  REGIONS.forEach((r, i) => {
    pos[`viewer:${r}`] = { x: 74, y: ys[i] };
    pos[`edge:A:${r}`] = { x: 420, y: ys[i] - 23 };
    pos[`edge:B:${r}`] = { x: 420, y: ys[i] + 23 };
  });
  pos.steer = { x: 250, y: 56 };
  pos["shield:A"] = { x: 640, y: 200 };
  pos["shield:B"] = { x: 640, y: 400 };
  pos.s3 = { x: 822, y: 200 };
  pos.gcs = { x: 822, y: 400 };
  return {
    kind, w: 920, h: 500, dir: "h", pos, font: 15.5, showSub: true,
    r: { viewer: 21, steer: 21, edge: 16, shield: 26, origin: 26 },
    headers: [
      { x: 74, y: 98, text: "VIEWERS", anchor: "middle" },
      { x: 420, y: 98, text: "EDGE PoPs", anchor: "middle" },
      { x: 640, y: 98, text: "SHIELDS", anchor: "middle" },
      { x: 822, y: 98, text: "ORIGIN", anchor: "middle" },
    ],
  };
}

/** Upstream order, used to draw every link in one canonical direction. */
const rank = (id: string) => (id.startsWith("viewer") ? 0 : id === "steer" ? 1 : id.startsWith("edge") ? 2 : id.startsWith("shield") ? 3 : 4);

/**
 * Cubic Bezier between two nodes. Tangents follow the layout's flow direction, which makes
 * the curve symmetric: link(a, b) reversed is exactly link(b, a). The bypass link (edge to
 * origin when a shield is down) arcs around the shield column so it never runs through it.
 */
export function link(L: Layout, from: NodeId, to: NodeId): Cubic {
  if (rank(from) > rank(to)) return reverse(link(L, to, from));
  const a = L.pos[from], b = L.pos[to];
  const bypass = from.startsWith("edge") && (to === "s3" || to === "gcs");
  if (L.dir === "h") {
    if (bypass) {
      const lift = L.kind === "wide" ? 70 : 42;
      const top = Math.min(a.y, b.y) - lift;
      return { a, c1: { x: a.x + (b.x - a.x) * 0.35, y: top }, c2: { x: b.x - (b.x - a.x) * 0.25, y: top }, b };
    }
    if (from === "steer" || to === "steer") {
      // Control plane: leave the viewer upward, arrive at steering from the side.
      return { a, c1: { x: a.x + 40, y: a.y - 30 }, c2: { x: b.x - 60, y: b.y }, b };
    }
    const dx = (b.x - a.x) / 2;
    return { a, c1: { x: a.x + dx, y: a.y }, c2: { x: b.x - dx, y: b.y }, b };
  }
  if (bypass) {
    const side = Math.min(a.x, b.x) - 46;
    return { a, c1: { x: side, y: a.y + (b.y - a.y) * 0.3 }, c2: { x: side, y: b.y - 40 }, b };
  }
  const dy = (b.y - a.y) / 2;
  return { a, c1: { x: a.x, y: a.y + dy }, c2: { x: b.x, y: b.y - dy }, b };
}

export const reverse = (c: Cubic): Cubic => ({ a: c.b, c1: c.c2, c2: c.c1, b: c.a });
export const pathD = (c: Cubic) => `M${c.a.x},${c.a.y} C${c.c1.x},${c.c1.y} ${c.c2.x},${c.c2.y} ${c.b.x},${c.b.y}`;

/** Point on a cubic at t (0..1): the Bernstein form B(t) = (1-t)^3 a + 3(1-t)^2 t c1 + 3(1-t) t^2 c2 + t^3 b. */
export function at(c: Cubic, t: number): Pt {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return { x: w0 * c.a.x + w1 * c.c1.x + w2 * c.c2.x + w3 * c.b.x, y: w0 * c.a.y + w1 * c.c1.y + w2 * c.c2.y + w3 * c.b.y };
}

/** Rough arc length by sampling; used so a packet moves at constant speed across a chain of links. */
export function length(c: Cubic, n = 16): number {
  let len = 0, prev = c.a;
  for (let i = 1; i <= n; i++) { const p = at(c, i / n); len += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
  return len;
}

/** Point at progress t (0..1) along a chain of cubics, by distance. */
export function along(chain: Cubic[], lens: number[], t: number): Pt {
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  let d = t * total;
  for (let i = 0; i < chain.length; i++) {
    if (d <= lens[i] || i === chain.length - 1) return at(chain[i], Math.min(1, lens[i] ? d / lens[i] : 1));
    d -= lens[i];
  }
  return chain[chain.length - 1].b;
}

/** All the static links on the stage (thin base lines). */
export function baseLinks(): { from: NodeId; to: NodeId; cdn?: Cdn; kind: "data" | "control" | "fallback" }[] {
  const out: { from: NodeId; to: NodeId; cdn?: Cdn; kind: "data" | "control" | "fallback" }[] = [];
  for (const r of REGIONS) {
    out.push({ from: `viewer:${r}` as NodeId, to: "steer", kind: "control" });
    for (const c of CDNS) {
      out.push({ from: `viewer:${r}` as NodeId, to: `edge:${c}:${r}` as NodeId, cdn: c, kind: "data" });
      out.push({ from: `edge:${c}:${r}` as NodeId, to: `shield:${c}` as NodeId, cdn: c, kind: "data" });
    }
  }
  for (const c of CDNS) {
    out.push({ from: `shield:${c}` as NodeId, to: "s3", cdn: c, kind: "data" });
    out.push({ from: `shield:${c}` as NodeId, to: "gcs", cdn: c, kind: "fallback" });
  }
  return out;
}

export const regionOf = (id: string): Region | null => (id.startsWith("viewer:") ? (id.slice(7) as Region) : id.startsWith("edge:") ? (id.slice(7) as Region) : null);
