import { useId } from "react";
import { TARGET_GBPS, fmtGbps, pct } from "./model";

interface SankeyProps {
  width: number;
  edgeIn: number; // Gbps, tweened
  toShield: number; // Gbps of edge misses, tweened
  origin: number; // Gbps, tweened
  shieldOn: number; // 0..1, tweened
  pops: number;
  over: boolean; // origin over target (actual, not tweened)
  motion: boolean;
}

const MAX_GBPS = 12000;

/** One ribbon that leaves the main band and turns downward: hits that stop at this layer. */
function peelPath(x: number, y1: number, d: number, yEnd: number): string {
  const ri = 10, ro = ri + d, y0 = y1 + d, cy = y1 + ro;
  return `M${x},${y1} A${ro},${ro} 0 0 1 ${x + ro},${cy} L${x + ro},${yEnd} L${x + ri},${yEnd} L${x + ri},${cy} A${ri},${ri} 0 0 0 ${x},${y0} Z`;
}

export function Sankey(p: SankeyProps) {
  const gid = useId().replace(/:/g, "");
  const W = Math.max(300, Math.round(p.width));
  const narrow = W < 520;
  const T0 = Math.min(100, Math.max(54, W * 0.17));
  // Square-root scale so the small origin flow stays visible next to terabits at the edge.
  const s = (g: number) => (g <= 0 ? 0 : Math.max(2, T0 * Math.sqrt(g / MAX_GBPS)));
  const t0 = s(p.edgeIn), t1 = s(p.toShield), t2 = s(p.origin);
  const tT = s(TARGET_GBPS);
  const nw = 8;
  const yTop = 50;
  const xV = 0, xE = Math.round(W * 0.28), xS = Math.round(W * 0.56), xO = W - nw;
  const yEnd = yTop + T0 + 30;
  const H = yEnd + (narrow ? 62 : 46);
  const servedEdge = Math.max(0, p.edgeIn - p.toShield);
  const servedShield = Math.max(0, p.toShield - p.origin);
  const dEdge = t0 - t1, dShield = t1 - t2;
  const toneVar = p.over ? "var(--bad)" : "var(--good)";
  const shieldGhost = 1 - p.shieldOn;
  const ri = 10;

  const flow = (x1: number, x2: number, t: number, key: string) =>
    p.motion && t > 9 ? <line key={key} className="so-flow" x1={x1} x2={x2} y1={yTop + t / 2} y2={yTop + t / 2} /> : null;

  const peelLabel = (x: number, title: string, g: number, share: number) => (
    <text x={x + ri} y={yEnd + 18} className="so-t-sub">
      <tspan className="so-t-title" x={x + ri}>{title}</tspan>
      {narrow ? (
        <>
          <tspan x={x + ri} dy={16}>{fmtGbps(g)}</tspan>
          <tspan x={x + ri} dy={16}>{pct(share)}</tspan>
        </>
      ) : (
        <tspan x={x + ri} dy={17}>{fmtGbps(g)} · {pct(share)}</tspan>
      )}
    </text>
  );

  const label = `Traffic flow. Viewers request ${fmtGbps(p.edgeIn)}. Edge serves ${fmtGbps(servedEdge)}. ` +
    (p.shieldOn > 0.5 ? `Shield serves ${fmtGbps(servedShield)}. ` : "Shield is off. ") +
    `Origin serves ${fmtGbps(p.origin)}, target is under ${TARGET_GBPS} Gbps.`;

  return (
    <svg className="so-sankey" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${gid}-peel`} gradientUnits="userSpaceOnUse" x1="0" y1={yTop} x2="0" y2={yEnd}>
          <stop offset="0" style={{ stopColor: "var(--p3)", stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: "var(--p3)", stopOpacity: 0.1 }} />
        </linearGradient>
      </defs>

      {/* Column labels */}
      <text x={xV} y={18} className="so-t-title">Viewers</text>
      <text x={xV} y={35} className="so-t-sub">{fmtGbps(p.edgeIn)}</text>
      <text x={xE + nw / 2} y={18} className="so-t-title" textAnchor="middle">{narrow ? "Edge" : "Edge PoPs"}</text>
      <text x={xE + nw / 2} y={35} className="so-t-sub" textAnchor="middle">{p.pops} PoPs</text>
      <g style={{ opacity: 0.35 + 0.65 * p.shieldOn }}>
        <text x={xS + nw / 2} y={18} className="so-t-title" textAnchor="middle">Shield</text>
        <text x={xS + nw / 2} y={35} className="so-t-sub" textAnchor="middle">{p.shieldOn > 0.5 ? `${fmtGbps(p.toShield)} in` : "off"}</text>
      </g>
      <text x={W} y={18} className="so-t-title" textAnchor="end">Origin</text>
      <text x={W} y={35} className="so-t-sub so-t-strong" textAnchor="end" style={{ fill: toneVar }}>{fmtGbps(p.origin)}</text>

      {/* Peel-offs: hits that stop at a layer */}
      {dEdge > 0.5 && <path d={peelPath(xE + nw, yTop + t1, dEdge, yEnd)} style={{ fill: `url(#${gid}-peel)` }} />}
      {dShield > 0.5 && <path d={peelPath(xS + nw, yTop + t2, dShield, yEnd)} style={{ fill: `url(#${gid}-peel)`, opacity: p.shieldOn }} />}

      {/* Main bands */}
      <rect x={xV + nw} y={yTop} width={xE - xV - nw} height={t0} className="so-band" />
      <rect x={xE + nw} y={yTop} width={xS - xE - nw} height={t1} className="so-band" />
      <rect x={xS + nw} y={yTop} width={xO - xS - nw} height={t2} style={{ fill: toneVar, opacity: 0.5 }} className="so-band-origin" />
      {flow(xV + nw, xE, t0, "f0")}
      {flow(xE + nw, xS, t1, "f1")}
      {flow(xS + nw, xO, t2, "f2")}

      {/* Nodes */}
      <rect x={xV} y={yTop} width={nw} height={Math.max(4, t0)} rx={3} className="so-node" />
      <rect x={xE} y={yTop} width={nw} height={Math.max(4, t0)} rx={3} className="so-node" />
      <rect x={xS} y={yTop} width={nw} height={Math.max(4, t1)} rx={3} className="so-node" style={{ opacity: p.shieldOn }} />
      <rect x={xS + 0.5} y={yTop - 6} width={nw - 1} height={Math.max(4, t1) + 12} rx={3} className="so-node-ghost" style={{ opacity: shieldGhost }} />
      <rect x={xO} y={yTop} width={nw} height={Math.max(4, t2)} rx={3} style={{ fill: toneVar }} />

      {/* Target at the origin */}
      <line x1={xO - 34} x2={W} y1={yTop + tT} y2={yTop + tT} className="so-target" />
      <text x={W} y={yTop + Math.max(tT, t2) + 16} className="so-t-sub" textAnchor="end">limit {TARGET_GBPS} Gbps</text>

      {/* Peel labels */}
      {dEdge > 0.5 && peelLabel(xE + nw, narrow ? "From edge" : "Served from edge", servedEdge, p.edgeIn ? servedEdge / p.edgeIn : 0)}
      {p.shieldOn > 0.5 && dShield > 0.5 && peelLabel(xS + nw, narrow ? "From shield" : "Served from shield", servedShield, p.edgeIn ? servedShield / p.edgeIn : 0)}
    </svg>
  );
}
