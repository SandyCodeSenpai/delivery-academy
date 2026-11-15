/* Flow layout: grid sizing, card text fitting, orthogonal edge routing, label placement. Pure functions. */
import type { FlowSpec, FlowNode, FlowEdge, Tone } from "@/content/types";
import { measure, wrap, widest, plain } from "./text";

export type Side = "left" | "right" | "top" | "bottom";
export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface LNode extends Box { id: string; n: FlowNode; label: string[]; sub: string[]; order: number }
export interface LLabel extends Box { lines: string[] }
export interface LEdge {
  key: string; e: FlowEdge; from: string; to: string;
  pts: Pt[]; d: string; len: number; heads: string[]; label?: LLabel;
}
export interface LGroup extends Box { id: string; label: string; tone?: Tone; lines: string[] }
export interface FlowLayout {
  w: number; h: number; style: "row" | "stack"; nodeW: number;
  nodes: LNode[]; edges: LEdge[]; groups: LGroup[];
  dir: "right" | "down"; transposed: boolean; overflow: boolean;
}

/* Type and box metrics (px). Text never goes below 12px. */
export const M = {
  label: 14, labelLH: 18, labelW: 600,
  sub: 12.5, subLH: 16,
  edge: 12, edgeLH: 15, edgeW: 500, pillPadX: 8, pillPadY: 4,
  group: 12.5, groupLH: 16,
  icon: 32, padX: 12, padY: 12, gapIcon: 10,
  minNW: 88, maxNW: 212, maxNW1: 300,
  arrow: 8, corner: 12, pad: 4,
};

const pillOf = (text: string, maxW: number, maxLines = 2) => {
  const lines = wrap(plain(text), maxW, M.edge, M.edgeW, maxLines);
  return { lines, w: widest(lines, M.edge, M.edgeW) + 2 * M.pillPadX, h: lines.length * M.edgeLH + 2 * M.pillPadY };
};

const COMFORT = 108;
export const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

export function layoutFlow(spec: FlowSpec, availW: number): FlowLayout {
  const seen = new Set<string>();
  const nodes = spec.nodes.filter((n) => !seen.has(n.id) && seen.add(n.id));
  const dir0 = spec.direction ?? "right";
  if (!nodes.length) return { w: availW, h: 0, style: "stack", nodeW: 0, nodes: [], edges: [], groups: [], dir: dir0, transposed: false, overflow: false };
  const span = (f: (n: FlowNode) => number) => Math.max(...nodes.map(f)) - Math.min(...nodes.map(f));
  const sc = span((n) => n.col), sr = span((n) => n.row);
  const tr = nodes.map((n) => ({ ...n, col: n.row, row: n.col }));
  if (dir0 === "right" && availW < 520 && sc > sr) return attempt(spec, tr, "down", availW, true);
  const a = attempt(spec, nodes, dir0, availW, false);
  // Cramped cards (or overflow) read worse than the same diagram turned on its side.
  if ((a.overflow || a.nodeW < COMFORT) && sc > sr) {
    const b = attempt(spec, tr, dir0 === "right" ? "down" : "right", availW, true);
    if ((!b.overflow && b.nodeW > a.nodeW) || (a.overflow && b.w < a.w)) return b;
  }
  return a;
}

/** Lay out, then tighten the width budget if groups or outside lanes pushed the content past the edge. */
function attempt(spec: FlowSpec, nodesIn: FlowNode[], dir: "right" | "down", availW: number, transposed: boolean): FlowLayout {
  let budget = availW, r = attemptOnce(spec, nodesIn, dir, availW, budget, transposed);
  for (let k = 0; k < 3 && r.overflow && r.nodeW > (availW < 440 ? 74 : M.minNW); k++) {
    budget -= r.w - availW + 2;
    r = attemptOnce(spec, nodesIn, dir, availW, budget, transposed);
  }
  return r;
}

function attemptOnce(spec: FlowSpec, nodesIn: FlowNode[], dir: "right" | "down", availW: number, budget: number, transposed: boolean): FlowLayout {
  const byId = new Map(nodesIn.map((n) => [n.id, n]));
  const edgesIn = spec.edges.filter((e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);
  const groupsIn = (spec.groups ?? []).filter((g) => g.nodes.some((id) => byId.has(id)));

  const c0 = Math.floor(Math.min(...nodesIn.map((n) => n.col))), c1 = Math.ceil(Math.max(...nodesIn.map((n) => n.col)));
  const r0 = Math.floor(Math.min(...nodesIn.map((n) => n.row))), r1 = Math.ceil(Math.max(...nodesIn.map((n) => n.row)));
  const nc = c1 - c0 + 1, nr = r1 - r0 + 1;
  const colOcc = Array(nc).fill(false), rowOcc = Array(nr).fill(false);
  nodesIn.forEach((n) => { colOcc[Math.round(n.col) - c0] = true; rowOcc[Math.round(n.row) - r0] = true; });

  /* ---- gaps between grid slots, widened where labels or groups need room ---- */
  const hasG = groupsIn.length > 0;
  const baseCG = (dir === "right" ? 52 : 40) + (hasG ? 12 : 0);
  const baseRG = (dir === "down" ? 46 : 40) + (hasG ? 10 : 0);
  const cg: number[] = Array(Math.max(0, nc - 1)).fill(baseCG);
  const rg: number[] = Array(Math.max(0, nr - 1)).fill(baseRG);
  const labelNeedCol: { e: FlowEdge; gap: number }[] = [];
  for (const e of edgesIn) {
    if (!e.label) continue;
    const a = byId.get(e.from)!, b = byId.get(e.to)!;
    const dc = Math.abs(a.col - b.col), dr = Math.abs(a.row - b.row);
    const p = pillOf(e.label, 132);
    if (dr < 0.5 && dc > 0.5 && dc <= 1.01) {
      const g = Math.floor(Math.min(a.col, b.col)) - c0;
      if (g >= 0 && g < cg.length) { cg[g] = Math.max(cg[g], p.w + 28); labelNeedCol.push({ e, gap: g }); }
    } else if (dc < 0.5 && dr > 0.5 && dr <= 1.01) {
      const g = Math.floor(Math.min(a.row, b.row)) - r0;
      if (g >= 0 && g < rg.length) rg[g] = Math.max(rg[g], p.h + 26);
    } else if (dr > 0.5 && dr <= 1.01) {
      const g = Math.floor(Math.min(a.row, b.row)) - r0;
      if (g >= 0 && g < rg.length) rg[g] = Math.max(rg[g], p.h + 22);
    }
  }
  for (const g of groupsIn) {
    const rows = g.nodes.filter((id) => byId.has(id)).map((id) => Math.round(byId.get(id)!.row) - r0);
    const top = Math.min(...rows);
    if (top > 0) rg[top - 1] = Math.max(rg[top - 1], baseRG) + 36;
  }

  /* ---- node width from the available width ---- */
  const colWt = colOcc.map((o) => (o ? 1 : 0.4)), rowWt = rowOcc.map((o) => (o ? 1 : 0.4));
  const sumCW = colWt.reduce((s, v) => s + v, 0);
  const inner = budget - 2 * M.pad;
  const maxNW = nc === 1 ? M.maxNW1 : M.maxNW;
  const narrow = availW < 440;
  const minNW = narrow ? 74 : M.minNW;
  const gp = availW < 480 ? 8 : 14; // group padding
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  let nw = (inner - sum(cg)) / sumCW;
  let overflow = false;
  if (nw < minNW) {
    const minG = cg.map((g) => Math.max(narrow ? 18 : 26, g * (narrow ? 0.42 : 0.6)));
    const room = inner - minNW * sumCW;
    if (room >= sum(minG)) {
      const f = (room - sum(minG)) / Math.max(1, sum(cg) - sum(minG));
      for (let i = 0; i < cg.length; i++) cg[i] = minG[i] + (cg[i] - minG[i]) * f;
    } else for (let i = 0; i < cg.length; i++) cg[i] = minG[i];
    nw = Math.max(minNW, (inner - sum(cg)) / sumCW);
    overflow = nw * sumCW + sum(cg) > inner + 1;
  } else if (nw > maxNW) {
    nw = maxNW;
    const extra = inner - nw * sumCW - sum(cg);
    if (cg.length && extra > 0) { const add = Math.min(36, extra / cg.length); for (let i = 0; i < cg.length; i++) cg[i] += add; }
  }
  nw = Math.floor(nw);

  /* ---- card text ---- */
  const style: "row" | "stack" = nw >= 150 ? "row" : "stack";
  const textW = style === "row" ? nw - 2 * M.padX - M.icon - M.gapIcon : nw - 12;
  let nh = 0;
  const texts = nodesIn.map((n) => {
    const label = wrap(plain(n.label), textW, M.label, M.labelW, 2, false);
    const sub = n.sub ? wrap(plain(n.sub), textW, M.sub, 400, 2, false) : [];
    const th = label.length * M.labelLH + (sub.length ? 2 + sub.length * M.subLH : 0);
    const h = style === "row" ? Math.max(M.icon, th) + 2 * M.padY : M.padY + M.icon + 8 + th + M.padY;
    nh = Math.max(nh, h);
    return { label, sub };
  });
  nh = Math.ceil(nh);

  /* ---- slot centers ---- */
  const slotW = colWt.map((w) => w * nw), slotH = rowWt.map((w) => w * nh);
  const cx: number[] = [M.pad + slotW[0] / 2], cy: number[] = [M.pad + slotH[0] / 2];
  for (let i = 1; i < nc; i++) cx[i] = cx[i - 1] + slotW[i - 1] / 2 + cg[i - 1] + slotW[i] / 2;
  for (let i = 1; i < nr; i++) cy[i] = cy[i - 1] + slotH[i - 1] / 2 + rg[i - 1] + slotH[i] / 2;
  const interp = (arr: number[], v: number) => {
    const i = Math.max(0, Math.min(arr.length - 1, Math.floor(v))), f = v - i;
    return f <= 0 || i + 1 >= arr.length ? arr[i] : arr[i] + (arr[i + 1] - arr[i]) * f;
  };

  // reading order for staggered entrance
  const nodes: LNode[] = nodesIn.map((n, i) => {
    const x = interp(cx, n.col - c0), y = interp(cy, n.row - r0);
    return { id: n.id, n, x: x - nw / 2, y: y - nh / 2, w: nw, h: nh, label: texts[i].label, sub: texts[i].sub, order: 0 };
  });
  [...nodes].sort((a, b) => (dir === "right" ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x)).forEach((n, i) => (n.order = i));
  const N = new Map(nodes.map((n) => [n.id, n]));

  /* ---- routing channels: the middle of every gap, plus outside lanes ---- */
  const minX = Math.min(...nodes.map((n) => n.x)), maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const minY = Math.min(...nodes.map((n) => n.y)), maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const VX: number[] = [minX - 22, maxX + 22], HY: number[] = [minY - 22, maxY + 22];
  for (let i = 0; i < nc - 1; i++) VX.push((cx[i] + slotW[i] / 2 + cx[i + 1] - slotW[i + 1] / 2) / 2);
  for (let i = 0; i < nr - 1; i++) HY.push((cy[i] + slotH[i] / 2 + cy[i + 1] - slotH[i + 1] / 2) / 2);
  colOcc.forEach((o, i) => { if (!o) VX.push(cx[i]); });
  rowOcc.forEach((o, i) => { if (!o) HY.push(cy[i]); });

  /* ---- route edges ---- */
  const keys = new Set(edgesIn.map(edgeKey));
  const routed: { pts: Pt[]; from: string; to: string }[] = [];
  const order = edgesIn.map((e, i) => ({ e, i, d: dist(N.get(e.from)!, N.get(e.to)!) })).sort((a, b) => a.d - b.d);
  const out: (LEdge | null)[] = Array(edgesIn.length).fill(null);
  // pass 1 routes short edges first; pass 2 re-routes each edge knowing where all the others went
  const slot: number[] = [];
  for (const { e, i } of order) {
    const S = N.get(e.from)!, T = N.get(e.to)!;
    const off = keys.has(`${e.to}>${e.from}`) ? (e.from < e.to ? -7 : 7) : 0;
    slot[i] = routed.length;
    routed.push({ pts: route(S, T, nodes, VX, HY, dir, routed, off), from: e.from, to: e.to });
  }
  for (const { e, i } of order) {
    const S = N.get(e.from)!, T = N.get(e.to)!;
    const off = keys.has(`${e.to}>${e.from}`) ? (e.from < e.to ? -7 : 7) : 0;
    const others = routed.filter((_, k) => k !== slot[i]);
    routed[slot[i]] = { pts: route(S, T, nodes, VX, HY, dir, others, off), from: e.from, to: e.to };
  }
  for (const { e, i } of order) {
    const pts = routed[slot[i]].pts;
    out[i] = { key: edgeKey(e), e, from: e.from, to: e.to, pts, d: "", len: 0, heads: [] };
  }
  const edges = out.filter(Boolean) as LEdge[];

  /* ---- groups ---- */
  const groups: LGroup[] = groupsIn.map((g) => {
    const ms = g.nodes.map((id) => N.get(id)).filter(Boolean) as LNode[];
    const x0 = Math.min(...ms.map((m) => m.x)) - gp, x1 = Math.max(...ms.map((m) => m.x + m.w)) + gp;
    const y1 = Math.max(...ms.map((m) => m.y + m.h)) + gp;
    const lines = wrap(plain(g.label), x1 - x0 - 24, M.group, 600, 1);
    const y0 = Math.min(...ms.map((m) => m.y)) - gp - (lines.length ? M.groupLH + 8 : 0);
    return { id: g.id, label: g.label, tone: g.tone, lines, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });

  /* ---- edge labels ---- */
  const placed: Box[] = groups.filter((g) => g.lines.length).map((g) => ({ x: g.x + 8, y: g.y + 4, w: Math.min(g.w - 16, measure(g.lines[0], M.group, 600) + 12), h: M.groupLH + 8 }));
  const labelOrder = [...edges].sort((a, b) => polyLen(a.pts) - polyLen(b.pts));
  for (const le of labelOrder) {
    if (!le.e.label) continue;
    const need = labelNeedCol.find((x) => x.e === le.e);
    const maxW = need ? Math.max(44, Math.min(132, cg[need.gap] - 16)) : 132;
    const p = pillOf(le.e.label, maxW, need && maxW < 100 ? 3 : 2);
    le.label = placeLabel(le, p, nodes, edges, placed, dir, groups, keys.has(`${le.to}>${le.from}`) ? (le.from < le.to ? -1 : 1) : 0);
    placed.push(le.label);
  }

  /* ---- fit the canvas to the content ---- */
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const eat = (b: Box) => { bx0 = Math.min(bx0, b.x); by0 = Math.min(by0, b.y); bx1 = Math.max(bx1, b.x + b.w); by1 = Math.max(by1, b.y + b.h); };
  nodes.forEach((n) => eat({ x: n.x, y: n.y - (n.n.badge ? 10 : 0), w: n.w + (n.n.badge ? 8 : 0), h: n.h + (n.n.badge ? 10 : 0) }));
  groups.forEach(eat);
  edges.forEach((e) => { e.pts.forEach((p) => eat({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 })); if (e.label) eat(e.label); });
  const P = 6;
  let w = bx1 - bx0 + 2 * P;
  const h = by1 - by0 + 2 * P;
  let dx = P - bx0;
  const dy = P - by0;
  if (w <= availW) { dx += (availW - w) / 2; w = availW; } else overflow = true;
  const mv = (b: Box) => { b.x += dx; b.y += dy; };
  nodes.forEach(mv); groups.forEach(mv);
  for (const e of edges) {
    e.pts = e.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    if (e.label) mv(e.label);
    const both = !!e.e.both;
    const pts = trimEnds(e.pts, both ? M.arrow : 0, M.arrow);
    e.d = rounded(pts, M.corner);
    e.len = polyLen(pts);
    e.heads = [arrowHead(e.pts[e.pts.length - 2], e.pts[e.pts.length - 1])];
    if (both) e.heads.push(arrowHead(e.pts[1], e.pts[0]));
  }
  return { w: Math.ceil(w), h: Math.ceil(h), style, nodeW: nw, nodes, edges, groups, dir, transposed, overflow };
}

/* ---------------- routing ---------------- */

const dist = (a: Box, b: Box) => Math.hypot(a.x - b.x, a.y - b.y);
const ccx = (b: Box) => b.x + b.w / 2, ccy = (b: Box) => b.y + b.h / 2;

function port(b: Box, s: Side, off: number): Pt {
  if (s === "right") return { x: b.x + b.w, y: ccy(b) + off };
  if (s === "left") return { x: b.x, y: ccy(b) + off };
  if (s === "top") return { x: ccx(b) + off, y: b.y };
  return { x: ccx(b) + off, y: b.y + b.h };
}

function route(S: LNode, T: LNode, nodes: LNode[], VX: number[], HY: number[], dir: "right" | "down", routed: { pts: Pt[]; from: string; to: string }[], off: number): Pt[] {
  const cands: { pts: Pt[]; kind: string }[] = [];
  const sx = ccx(S), sy = ccy(S), tx = ccx(T), ty = ccy(T);
  const dx = tx - sx, dy = ty - sy;
  const H = dx > 0 ? (["right", "left"] as const) : (["left", "right"] as const);
  const V = dy > 0 ? (["bottom", "top"] as const) : (["top", "bottom"] as const);

  // straight lines
  if (Math.abs(dy) < 1 && Math.abs(dx) > 1) cands.push({ pts: [port(S, H[0], off), port(T, H[1], off)], kind: "straight" });
  if (Math.abs(dx) < 1 && Math.abs(dy) > 1) cands.push({ pts: [port(S, V[0], off), port(T, V[1], off)], kind: "straight" });
  // H-V-H through a vertical channel between the two cards
  if (Math.abs(dx) > 1) {
    const a = port(S, H[0], off), b = port(T, H[1], off);
    for (const x of VX) {
      if ((dx > 0 && x > a.x + 8 && x < b.x - 8) || (dx < 0 && x < a.x - 8 && x > b.x + 8))
        cands.push({ pts: [a, { x, y: a.y }, { x, y: b.y }, b], kind: "hvh" });
    }
  }
  // V-H-V through a horizontal channel
  if (Math.abs(dy) > 1) {
    const a = port(S, V[0], off), b = port(T, V[1], off);
    for (const y of HY) {
      if ((dy > 0 && y > a.y + 8 && y < b.y - 8) || (dy < 0 && y < a.y - 8 && y > b.y + 8))
        cands.push({ pts: [a, { x: a.x, y }, { x: b.x, y }, b], kind: "vhv" });
    }
  }
  // L shapes
  if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
    { const a = port(S, H[0], 0), b = port(T, V[1], 0); cands.push({ pts: [a, { x: b.x, y: a.y }, b], kind: "hv" }); }
    { const a = port(S, V[0], 0), b = port(T, H[1], 0); cands.push({ pts: [a, { x: a.x, y: b.y }, b], kind: "vh" }); }
  }
  // U shapes around obstacles (same row / same column)
  for (const s of ["top", "bottom"] as const) {
    const a = port(S, s, off), b = port(T, s, off);
    for (const y of HY) if (s === "top" ? y < Math.min(a.y, b.y) - 8 : y > Math.max(a.y, b.y) + 8) cands.push({ pts: [a, { x: a.x, y }, { x: b.x, y }, b], kind: "u" });
  }
  for (const s of ["left", "right"] as const) {
    const a = port(S, s, off), b = port(T, s, off);
    for (const x of VX) if (s === "left" ? x < Math.min(a.x, b.x) - 8 : x > Math.max(a.x, b.x) + 8) cands.push({ pts: [a, { x, y: a.y }, { x, y: b.y }, b], kind: "u" });
  }

  let best = cands[0], bestScore = Infinity;
  for (const c of cands) {
    const pts = simplify(c.pts);
    let s = 0;
    // node collisions
    for (let i = 0; i < pts.length - 1; i++) {
      for (const n of nodes) {
        if ((n === S && i === 0) || (n === T && i === pts.length - 2)) continue;
        if (segHitsBox(pts[i], pts[i + 1], n, n === S || n === T ? -1 : 6)) s += 1000;
      }
    }
    s += (pts.length - 2) * 34 + polyLen(pts) * 0.12;
    // first/last segment should leave in the reading direction
    const sSide = sideOf(S, pts[0]), tSide = sideOf(T, pts[pts.length - 1]);
    const horiz = (x: Side) => x === "left" || x === "right";
    if (c.kind !== "straight") {
      if (dir === "right") { if (!horiz(sSide)) s += 22; if (!horiz(tSide)) s += 22; }
      else { if (horiz(sSide)) s += 22; if (horiz(tSide)) s += 22; }
    }
    if (c.kind === "u") s += 40;
    // interaction with already-routed edges
    for (const r of routed) {
      const share = r.from === (S.id) || r.to === T.id;
      for (let i = 0; i < pts.length - 1; i++)
        for (let j = 0; j < r.pts.length - 1; j++) {
          const k = segRelation(pts[i], pts[i + 1], r.pts[j], r.pts[j + 1]);
          if (k === "cross") s += 18;
          else if (k === "overlap" && !share) s += 70;
        }
    }
    if (s < bestScore) { bestScore = s; best = { ...c, pts }; }
  }
  return best.pts;
}

function sideOf(b: Box, p: Pt): Side {
  if (Math.abs(p.x - b.x) < 0.5) return "left";
  if (Math.abs(p.x - (b.x + b.w)) < 0.5) return "right";
  if (Math.abs(p.y - b.y) < 0.5) return "top";
  return "bottom";
}

function simplify(pts: Pt[]): Pt[] {
  const o: Pt[] = [];
  for (const p of pts) {
    const l = o[o.length - 1];
    if (l && Math.abs(l.x - p.x) < 0.5 && Math.abs(l.y - p.y) < 0.5) continue;
    o.push(p);
  }
  for (let i = o.length - 2; i > 0; i--) {
    const a = o[i - 1], b = o[i], c = o[i + 1];
    if ((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5)) o.splice(i, 1);
  }
  return o;
}

function segHitsBox(a: Pt, b: Pt, r: Box, infl: number): boolean {
  const x0 = r.x - infl, x1 = r.x + r.w + infl, y0 = r.y - infl, y1 = r.y + r.h + infl;
  const sx0 = Math.min(a.x, b.x), sx1 = Math.max(a.x, b.x), sy0 = Math.min(a.y, b.y), sy1 = Math.max(a.y, b.y);
  return sx1 > x0 && sx0 < x1 && sy1 > y0 && sy0 < y1;
}

function segRelation(a: Pt, b: Pt, c: Pt, d: Pt): "none" | "cross" | "overlap" {
  const h1 = Math.abs(a.y - b.y) < 0.5, h2 = Math.abs(c.y - d.y) < 0.5;
  if (h1 === h2) {
    if (h1 && Math.abs(a.y - c.y) < 3) return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 4 ? "overlap" : "none";
    if (!h1 && Math.abs(a.x - c.x) < 3) return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 4 ? "overlap" : "none";
    return "none";
  }
  const [hA, hB, vA, vB] = h1 ? [a, b, c, d] : [c, d, a, b];
  const x = vA.x, y = hA.y;
  const inH = x > Math.min(hA.x, hB.x) + 1 && x < Math.max(hA.x, hB.x) - 1;
  const inV = y > Math.min(vA.y, vB.y) + 1 && y < Math.max(vA.y, vB.y) - 1;
  return inH && inV ? "cross" : "none";
}

export function polyLen(pts: Pt[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

function trimEnds(pts: Pt[], a: number, b: number): Pt[] {
  const o = pts.map((p) => ({ ...p }));
  const mvTo = (p: Pt, q: Pt, d: number) => { const L = Math.hypot(q.x - p.x, q.y - p.y) || 1; const k = Math.min(d, L - 0.5) / L; p.x += (q.x - p.x) * k; p.y += (q.y - p.y) * k; };
  if (a) mvTo(o[0], o[1], a - 1);
  if (b) mvTo(o[o.length - 1], o[o.length - 2], b - 1);
  return o;
}

/** Polyline with rounded elbows. */
export function rounded(pts: Pt[], r: number): string {
  if (pts.length < 2) return "";
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const l1 = Math.hypot(c.x - p.x, c.y - p.y), l2 = Math.hypot(n.x - c.x, n.y - c.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = { x: c.x - ((c.x - p.x) / (l1 || 1)) * rr, y: c.y - ((c.y - p.y) / (l1 || 1)) * rr };
    const b = { x: c.x + ((n.x - c.x) / (l2 || 1)) * rr, y: c.y + ((n.y - c.y) / (l2 || 1)) * rr };
    d += `L${f(a.x)},${f(a.y)}Q${f(c.x)},${f(c.y)} ${f(b.x)},${f(b.y)}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${f(l.x)},${f(l.y)}`;
}

/** Filled chevron arrowhead with its tip on `tip`, pointing from `from`. */
export function arrowHead(from: Pt, tip: Pt, len = 8.5, half = 4.6): string {
  const L = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / L, uy = (tip.y - from.y) / L, nx = -uy, ny = ux;
  const bx = tip.x - ux * len, by = tip.y - uy * len;
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(bx + nx * half)},${f(by + ny * half)}L${f(tip.x)},${f(tip.y)}L${f(bx - nx * half)},${f(by - ny * half)}L${f(bx + ux * 2.4)},${f(by + uy * 2.4)}Z`;
}

/* ---------------- label placement ---------------- */

function crossesBorder(a: Box, g: Box) {
  const inside = a.x >= g.x && a.y >= g.y && a.x + a.w <= g.x + g.w && a.y + a.h <= g.y + g.h;
  return !inside && overlap(a, g, 0) > 0;
}

function placeLabel(le: LEdge, p: { lines: string[]; w: number; h: number }, nodes: LNode[], edges: LEdge[], placed: Box[], dir: "right" | "down", groupBoxes: Box[], side: number): LLabel {
  const pts = le.pts;
  let best: LLabel | null = null, bestS = Infinity;
  const nSeg = pts.length - 1;
  for (let i = 0; i < nSeg; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 6) continue;
    const ts = [0.5, 0.38, 0.62, 0.26, 0.74];
    const horiz = Math.abs(a.y - b.y) < 0.5;
    for (const t of ts) {
      let cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      // a request/response pair: each label sits on the outer side of its own line
      if (side) { if (horiz) cy += side * (p.h / 2 + 1); else cx += side * (p.w / 2 + 1); }
      const box: LLabel = { x: cx - p.w / 2, y: cy - p.h / 2, w: p.w, h: p.h, lines: p.lines };
      let s = 0;
      for (const n of nodes) s += overlap(box, n, 4) * 60;
      for (const q of placed) s += overlap(box, q, 4) * 40;
      for (const g of groupBoxes) if (crossesBorder(box, g)) s += 30;
      for (const o of edges) {
        if (o === le) continue;
        for (let j = 0; j < o.pts.length - 1; j++) {
          if (segHitsBox(o.pts[j], o.pts[j + 1], box, 1)) {
            const rel = segRelation(a, b, o.pts[j], o.pts[j + 1]);
            s += rel === "overlap" ? 140 : 26;
          }
        }
      }
      // a label is easier to read on the edge's own (unshared) segment, near the middle
      s += Math.abs(i - (nSeg - 1) / 2) * 6 + Math.abs(t - 0.5) * 24;
      // keep the pill on its own segment
      const along = horiz ? p.w : p.h;
      if (L * Math.min(t, 1 - t) < along / 2 - 2) s += 10;
      if (!horiz) s += dir === "right" ? 8 : 0; else s += dir === "down" ? 4 : 0;
      if (L < (horiz ? p.w : p.h) + 6) s += 14;
      s -= Math.min(L, 200) * 0.04;
      if (s < bestS) { bestS = s; best = box; }
    }
  }
  if (!best) {
    const m = pts[Math.floor(pts.length / 2)];
    best = { x: m.x - p.w / 2, y: m.y - p.h / 2, w: p.w, h: p.h, lines: p.lines };
  }
  return best;
}

function overlap(a: Box, b: Box, infl: number) {
  const w = Math.min(a.x + a.w, b.x + b.w + infl) - Math.max(a.x, b.x - infl);
  const h = Math.min(a.y + a.h, b.y + b.h + infl) - Math.max(a.y, b.y - infl);
  return w > 0 && h > 0 ? w * h : 0;
}

export { measure };
