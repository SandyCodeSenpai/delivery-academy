import { useMemo, type KeyboardEvent } from "react";
import { clamp01, ease, lerp, ownersMod, type Obj } from "./model";

interface Props {
  width: number;
  objs: Obj[];
  servers: number[];
  /** servers before the last change in this mode (null = no animation) */
  prev: number[] | null;
  t: number;
  compact: boolean;
  onRemove: (id: number) => void;
}

const PADX = 4;
const TOP = 22;

function pickPitch(cw: number, maxLoad: number, h: number): number {
  for (let p = 16; p >= 4; p -= 0.5) {
    const k = Math.max(1, Math.floor((cw - 6) / p));
    if (Math.ceil(maxLoad / k) * p <= h) return p;
  }
  return 4;
}

const loads = (svs: number[], own: number[]) => {
  const m = new Map<number, number>(svs.map((s) => [s, 0]));
  for (const s of own) m.set(s, (m.get(s) ?? 0) + 1);
  return m;
};

/** hash mod N: one column per server, owned keys stacked from the bottom (so column height = load). */
export default function ModView({ width, objs, servers, prev, t, compact, onRemove }: Props) {
  const HMAX = compact ? 196 : 236;
  const cur = useMemo(() => ownersMod(objs, servers), [objs, servers]);
  const old = useMemo(() => (prev ? ownersMod(objs, prev) : null), [objs, prev]);

  const inner = width - PADX * 2;
  const cw1 = inner / servers.length;
  const l1 = loads(servers, cur);
  const max1 = Math.max(...l1.values());
  const cw0 = prev ? inner / prev.length : cw1;
  const max0 = prev && old ? Math.max(...loads(prev, old).values()) : 0;
  let pitch = pickPitch(cw1, max1, HMAX);
  if (prev && old) pitch = Math.min(pitch, pickPitch(cw0, max0, HMAX));
  const rowsOf = (cw: number, mx: number) => Math.ceil(mx / Math.max(1, Math.floor((cw - 6) / pitch)));
  /* fit the chart to its tallest column (before or after the change), with headroom */
  const H = Math.min(HMAX, Math.max(110, Math.max(rowsOf(cw1, max1), prev && old ? rowsOf(cw0, max0) : 0) * pitch + 40));
  const baseY = TOP + H;

  const place = (svs: number[], own: number[], cw: number) => {
    const k = Math.max(1, Math.floor((cw - 6) / pitch));
    const colX = new Map<number, number>(svs.map((s, i) => [s, PADX + i * cw]));
    const fill = new Map<number, number>(svs.map((s) => [s, 0]));
    const pos = own.map((s) => {
      const j = fill.get(s)!;
      fill.set(s, j + 1);
      const row = Math.floor(j / k), c = j % k;
      const x0 = colX.get(s)! + (cw - k * pitch) / 2;
      return [x0 + c * pitch + pitch / 2, baseY - 4 - row * pitch - pitch / 2] as const;
    });
    return { k, colX, pos };
  };
  const L1 = place(servers, cur, cw1);
  const L0 = prev && old ? place(prev, old, cw0) : null;

  const moved: number[] = old ? cur.map((s, i) => (s !== old[i] ? i : -1)).filter((i) => i >= 0) : [];
  const movedRank = new Map<number, number>(moved.map((i, r) => [i, r]));
  const te = ease(t);
  const r = Math.max(1.6, pitch * 0.36);
  const avg = objs.length / servers.length;
  const avgY = baseY - 4 - (avg / L1.k) * pitch;
  const lift = Math.min(46, H * 0.22);

  const key = (id: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(id); }
  };

  const removedCols = prev ? prev.filter((s) => !servers.includes(s)) : [];
  const labelFor = (s: number, cw: number) => (cw >= 30 ? `S${s}` : `${s}`);

  return (
    <svg className="ch-svg" width={width} height={baseY + 26} viewBox={`0 0 ${width} ${baseY + 26}`} role="img"
      aria-label={`hash mod ${servers.length}: ${servers.length} columns, one per server. ${moved.length} keys moved on the last change.`}>
      {/* columns */}
      {servers.map((s) => {
        const was = L0?.colX.get(s);
        const x = was !== undefined ? lerp(was, L1.colX.get(s)!, te) : L1.colX.get(s)!;
        const w = lerp(L0 && was !== undefined ? cw0 : cw1, cw1, te);
        const added = !!prev && !prev.includes(s);
        return (
          <g key={s} className="ch-col" role="button" tabIndex={0} aria-label={`Remove server S${s}`}
            onClick={() => onRemove(s)} onKeyDown={key(s)} style={{ opacity: added ? te : 1 }}>
            <rect className="ch-col-bg" x={x + 1.5} y={TOP} width={Math.max(2, w - 3)} height={H} rx={Math.min(8, w / 3)} />
            <text className="ch-col-label" x={x + w / 2} y={baseY + 17} textAnchor="middle">{labelFor(s, w)}</text>
          </g>
        );
      })}
      {L0 && removedCols.map((s) => {
        const x = L0.colX.get(s)!;
        return (
          <g key={`gone-${s}`} style={{ opacity: 1 - te }} aria-hidden="true">
            <rect className="ch-col-bg gone" x={x + 1.5} y={TOP} width={cw0 - 3} height={H} rx={Math.min(8, cw0 / 3)} />
            <text className="ch-col-label" x={x + cw0 / 2} y={baseY + 17} textAnchor="middle">{labelFor(s, cw0)}</text>
          </g>
        );
      })}

      {/* average line */}
      <line x1={PADX} x2={width - PADX} y1={avgY} y2={avgY} className="ch-avg" />

      {/* keys */}
      <g aria-hidden="true">
        {objs.map((o, i) => {
          const [x1, y1] = L1.pos[i];
          const mr = movedRank.get(i);
          if (!L0) return <circle key={o.i} cx={x1} cy={y1} r={r} className="ch-key" />;
          const [x0, y0] = L0.pos[i];
          if (mr === undefined) {
            return <circle key={o.i} cx={lerp(x0, x1, te)} cy={lerp(y0, y1, te)} r={r} className="ch-key" />;
          }
          const d = moved.length > 1 ? (mr / (moved.length - 1)) * 0.4 : 0;
          const ti = clamp01((t - d) / 0.6);
          const e = ease(ti);
          const y = lerp(y0, y1, e) - Math.sin(Math.PI * ti) * lift;
          return <circle key={o.i} cx={lerp(x0, x1, e)} cy={y} r={r * (1 + Math.sin(Math.PI * ti) * 0.35)} className="ch-key moved" />;
        })}
      </g>
      <text x={PADX + 2} y={13} className="ch-small">{width < 420 ? "Keys per server (tap to remove)" : "Keys per server (tap a column to remove it)"}</text>
      <text x={width - PADX - 2} y={13} textAnchor="end" className="ch-small">dashed = average</text>
    </svg>
  );
}
