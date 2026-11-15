import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { clamp01, ease, makeRing, ownersRing, serverColor, type Obj, type VNode } from "./model";

interface Props {
  width: number;
  objs: Obj[];
  servers: number[];
  vn: number;
  prev: { servers: number[]; vn: number } | null;
  t: number;
  compact: boolean;
  /** mark moved keys (halo + trail). Off for a virtual-node re-layout. */
  showMoved: boolean;
  onRemove: (id: number) => void;
  center: { big: string; small: string; tone?: "bad" | "good" | "warn" };
}

const TAU = Math.PI * 2;

/** Consistent hashing ring: server arcs (each arc is owned by the point at its clockwise end), keys inside. */
export default function RingView({ width, objs, servers, vn, prev, t, compact, showMoved, onRemove, center }: Props) {
  const S = Math.max(240, Math.min(width, compact ? 372 : 440));
  const cx = S / 2, cy = S / 2;
  const R = S / 2 - 42;
  const band = Math.max(14, R * 0.13);

  const ring = useMemo(() => makeRing(servers, vn), [servers, vn]);
  const own = useMemo(() => ownersRing(objs, ring), [objs, ring]);
  const prevRing = useMemo(() => (prev ? makeRing(prev.servers, prev.vn) : null), [prev]);
  const prevOwn = useMemo(() => (prevRing ? ownersRing(objs, prevRing) : null), [objs, prevRing]);

  const pt = (f: number, r: number): [number, number] => [cx + r * Math.sin(f * TAU), cy - r * Math.cos(f * TAU)];
  const arc = (f0: number, f1: number, r: number) => {
    let b = f1;
    if (b <= f0) b += 1;
    if (b - f0 >= 0.9999) {
      const [ax, ay] = pt(f0, r), [bx, by] = pt(f0 + 0.5, r);
      return `M${ax},${ay}A${r},${r} 0 1 1 ${bx},${by}A${r},${r} 0 1 1 ${ax},${ay}`;
    }
    const [x0, y0] = pt(f0, r), [x1, y1] = pt(b, r);
    return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${b - f0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  const arcs = (rg: VNode[], gaps: boolean) =>
    rg.map((n, i) => {
      const a = rg[(i - 1 + rg.length) % rg.length].pos;
      let b = n.pos;
      if (b <= a) b += 1;
      const g = gaps ? Math.min(0.0025, (b - a) * 0.18) : 0;
      return { n, key: `${n.server}-${n.v}`, d: arc(a + g, b - g, R) };
    });

  const te = ease(t);
  const animating = !!prev && t < 1;
  const moved = prevOwn && showMoved ? own.owner.map((s, i) => s !== prevOwn.owner[i]) : null;

  const key = (id: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(id); }
  };

  const inner = R - band / 2 - 6;
  const keyR = (o: Obj) => inner - o.jitter * (R * 0.2);
  const cwR = inner - R * 0.2 - 16;

  /* ---------- keys ---------- */
  const dots: ReactNode[] = [];
  const trails: ReactNode[] = [];
  const dotR = objs.length > 140 ? 2.6 : 3.1;
  objs.forEach((o, i) => {
    const rk = keyR(o);
    const [x, y] = pt(o.pos, rk);
    const nc = serverColor(own.owner[i]);
    let fill = nc;
    if (prevOwn && animating && prevOwn.owner[i] !== own.owner[i]) {
      fill = `color-mix(in srgb, ${nc} ${Math.round(te * 100)}%, ${serverColor(prevOwn.owner[i])})`;
    }
    if (moved?.[i]) {
      dots.push(<circle key={`h${o.i}`} cx={x} cy={y} r={animating ? 4.6 + 5 * (1 - te) : 5.4} className="ch-halo" style={{ opacity: animating ? 0.35 + 0.65 * te : 0.9 }} />);
      if (animating) {
        let end = ring[own.node[i]].pos;
        if (end < o.pos) end += 1;
        const head = o.pos + (end - o.pos) * ease(clamp01(t * 1.5));
        const fade = t < 0.65 ? 0.85 : 0.85 * clamp01((1 - t) / 0.35);
        if (head - o.pos > 0.0005) {
          trails.push(<path key={`t${o.i}`} d={arc(o.pos, head, rk)} className="ch-trail" style={{ opacity: fade }} />);
          const [hx, hy] = pt(head, rk);
          trails.push(<circle key={`p${o.i}`} cx={hx} cy={hy} r={2.6} className="ch-packet" style={{ opacity: fade }} />);
        }
      }
    }
    dots.push(<circle key={o.i} cx={x} cy={y} r={dotR} style={{ fill }} className="ch-rkey" />);
  });

  /* ---------- labels: push one outward when it would collide with its neighbour ---------- */
  const labelBump = new Map<number, number>();
  if (vn === 1) {
    const prim = ring.filter((n) => n.v === 0);
    const minGap = 26 / (TAU * (R + band / 2 + 13));
    prim.forEach((n, i) => {
      if (i > 0 && n.pos - prim[i - 1].pos < minGap && !labelBump.get(prim[i - 1].server)) labelBump.set(n.server, 15);
    });
    if (prim.length > 1) {
      const first = prim[0], last = prim[prim.length - 1];
      if (first.pos + 1 - last.pos < minGap && !labelBump.get(last.server) && !labelBump.get(first.server)) labelBump.set(first.server, 15);
    }
  }

  /* ---------- arcs (clickable: remove the owning server) ---------- */
  const newArcs = arcs(ring, vn === 1);
  const oldArcs = prevRing && animating ? arcs(prevRing, prev!.vn === 1) : [];
  const arcEls = newArcs.map(({ n, key: k, d }) => {
    const focusable = vn > 1 && n.v === 0;
    const added = !!prev && !prev.servers.includes(n.server);
    return (
      <g key={k} className="ch-arcg" role={focusable ? "button" : undefined} tabIndex={focusable ? 0 : undefined}
        aria-label={focusable ? `Remove server S${n.server}` : undefined} aria-hidden={focusable ? undefined : true}
        onClick={() => onRemove(n.server)} onKeyDown={focusable ? key(n.server) : undefined}>
        <path d={d} className="ch-arc-focus" style={{ strokeWidth: band + 6 }} />
        <path d={d} className="ch-arc" style={{ stroke: serverColor(n.server), strokeWidth: band, opacity: animating ? (added ? te : Math.max(te, 0.25)) : 1 }} />
      </g>
    );
  });

  /* ---------- server points ---------- */
  const nodes = (rg: VNode[], kind: "now" | "gone") =>
    rg.map((n) => {
      const gone = kind === "gone";
      if (gone && servers.includes(n.server)) return null;
      const added = !gone && !!prev && !prev.servers.includes(n.server);
      const scale = gone ? 1 - te : added ? te : 1;
      if (scale <= 0.01) return null;
      const [x, y] = pt(n.pos, R);
      if (vn > 1 || (gone && prev!.vn > 1)) {
        // virtual nodes: a thin separator across the band instead of a dot
        const [ax, ay] = pt(n.pos, R - band / 2), [bx, by] = pt(n.pos, R + band / 2);
        return <line key={`${kind}-${n.server}-${n.v}`} x1={ax} y1={ay} x2={bx} y2={by} className="ch-sep" style={{ opacity: scale }} aria-hidden="true" />;
      }
      const [lx, ly] = pt(n.pos, R + band / 2 + 13 + (labelBump.get(n.server) ?? 0));
      return (
        <g key={`${kind}-${n.server}`} className={gone ? "" : "ch-node"} role={gone ? undefined : "button"}
          tabIndex={gone ? undefined : 0} aria-label={gone ? undefined : `Remove server S${n.server}`}
          aria-hidden={gone ? true : undefined}
          onClick={gone ? undefined : () => onRemove(n.server)} onKeyDown={gone ? undefined : key(n.server)}
          style={{ opacity: gone ? 1 - te : 1 }}>
          {!gone && <circle cx={x} cy={y} r={15} className="ch-node-hit" />}
          <circle cx={x} cy={y} r={8 * scale} className="ch-node-dot" style={{ fill: serverColor(n.server) }} />
          <text x={lx} y={ly} className="ch-node-label" textAnchor="middle" dominantBaseline="central">{`S${n.server}`}</text>
        </g>
      );
    });

  return (
    <svg className="ch-svg ch-ring" width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="group"
      aria-label={`Hash ring with ${servers.length} servers${vn > 1 ? `, ${vn} points each,` : ""} and ${objs.length} keys. Each key belongs to the next server clockwise. Activate a server to remove it.`}>
      <circle cx={cx} cy={cy} r={R} className="ch-track" style={{ strokeWidth: band }} />
      <g aria-hidden="true">
        {oldArcs.map((a) => <path key={`o${a.key}`} d={a.d} className="ch-arc" style={{ stroke: serverColor(a.n.server), strokeWidth: band, opacity: 1 - te }} />)}
      </g>
      {arcEls}
      <g aria-hidden="true" className="ch-cw">
        <path d={arc(0.955, 0.045, cwR)} />
        <path d={(() => { const [x, y] = pt(0.045, cwR); return `M${x - 5},${y - 5}L${x + 1},${y + 0.5}L${x - 5},${y + 5}`; })()} />
        <text x={cx} y={cy - cwR + 18} textAnchor="middle" className="ch-small">clockwise</text>
      </g>
      <g aria-hidden="true">{trails}</g>
      <g aria-hidden="true">{dots}</g>
      {prevRing && animating && nodes(prevRing, "gone")}
      {nodes(ring, "now")}
      <g aria-live="polite">
        <text x={cx} y={cy + 4} textAnchor="middle" className={`ch-center-big ${center.tone ? `tone-${center.tone}` : ""}`}>{center.big}</text>
        <text x={cx} y={cy + 25} textAnchor="middle" className="ch-center-small">{center.small}</text>
      </g>
    </svg>
  );
}
