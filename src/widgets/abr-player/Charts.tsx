import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { LineChart, type Series } from "@/ui";
import { useWidth } from "@/lib/hooks";
import { BW_MAX, BW_MIN, DURATION, LADDER, TRACE_STEP, bbaZones, type Run } from "./model";

/* LineChart geometry (see @/ui LineChart): viewBox width = measured pixel width, height = px,
   left margin 40 below 420px else 48. The overlays below mirror it exactly. */
const R = 12, T = 12, B = 30;
interface Geo { W: number; L: number; sx: (x: number) => number }
function useGeo(ref: RefObject<HTMLDivElement>): Geo {
  const w = useWidth(ref);
  const W = Math.max(240, Math.round(w || 640)), L = W < 420 ? 40 : 48;
  return { W, L, sx: (x: number) => L + (x / DURATION) * (W - L - R) };
}
const mkSy = (H: number, yMax: number) => (y: number) => T + (1 - y / yMax) * (H - T - B);
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface Player { run: Run; color: string; label: string }

function Playhead({ t, H, g }: { t: number; H: number; g: Geo }) {
  if (t <= 0) return null;
  return <line x1={g.sx(t)} x2={g.sx(t)} y1={T} y2={H - B} className="abrp-playhead" />;
}

/* ---------------- Bandwidth + selected bitrate, with a draggable bandwidth line ---------------- */

export function NetworkChart(p: {
  trace: number[]; onEdit: (next: number[]) => void; players: Player[]; t: number; H: number;
  markers?: { x: number; label: string }[]; started: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const g = useGeo(box);
  const { W, L, sx } = g;
  const drag = useRef<{ idx: number; val: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const sy = mkSy(p.H, BW_MAX);

  const series: Series[] = [
    { id: "bw", label: "Available bandwidth", color: "var(--muted)", area: true, points: p.trace.map((v, i) => [i * TRACE_STEP, v]) },
    ...p.players.map((pl, k) => ({ id: `br${k}`, label: `${pl.label} picks`, color: pl.color, points: stepPoints(pl.run, p.t) })),
  ];

  const toPoint = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const vx = ((e.clientX - r.left) * W) / r.width, vy = ((e.clientY - r.top) * p.H) / r.height;
    const idx = Math.round((((vx - L) / (W - L - R)) * DURATION) / TRACE_STEP);
    const val = BW_MAX * (1 - (vy - T) / (p.H - T - B));
    return { idx: Math.max(0, Math.min(p.trace.length - 1, idx)), val: Math.max(BW_MIN, Math.min(BW_MAX, Math.round(val * 10) / 10)) };
  };
  /** Set points from..to, interpolating from the previous drag value so fast sweeps leave no gaps. */
  const paint = (from: number, fromVal: number, to: number, val: number) => {
    const next = p.trace.slice();
    const n = Math.abs(to - from);
    for (let k = 0; k <= n; k++) {
      const i = from + Math.sign(to - from) * k;
      next[i] = n === 0 ? val : Math.round((fromVal + ((val - fromVal) * k) / n) * 10) / 10;
    }
    return next;
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const { idx, val } = toPoint(e);
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { idx, val };
    setSel(idx);
    p.onEdit(paint(idx, val, idx, val));
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const { idx, val } = toPoint(e);
    setHover(idx);
    if (!drag.current) return;
    p.onEdit(paint(drag.current.idx, drag.current.val, idx, val));
    drag.current = { idx, val };
    setSel(idx);
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const i = sel ?? 0;
    const step = e.shiftKey ? 2 : 0.5;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setSel(Math.max(0, Math.min(p.trace.length - 1, i + (e.key === "ArrowLeft" ? -1 : 1)))); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = p.trace.slice();
      next[i] = Math.max(BW_MIN, Math.min(BW_MAX, Math.round((next[i] + (e.key === "ArrowUp" ? step : -step)) * 10) / 10));
      setSel(i); p.onEdit(next);
    }
  };
  const shown = drag.current ? sel : hover ?? sel;
  const cur = sel ?? 0;

  return (
    <div className="abrp-chartwrap" ref={box}>
      <LineChart series={series} xMax={DURATION} yMax={BW_MAX} height={p.H} yLabel="Mbps" xFmt={mmss} yFmt={(v) => String(Math.round(v))} markers={p.markers} />
      <svg ref={ref} className="abrp-overlay abrp-edit" viewBox={`0 0 ${W} ${p.H}`} tabIndex={0}
        role="slider" aria-label="Network bandwidth editor. Left and right pick a moment, up and down change the bandwidth."
        aria-valuemin={BW_MIN} aria-valuemax={BW_MAX} aria-valuenow={p.trace[cur]} aria-valuetext={`${p.trace[cur].toFixed(1)} Mbps at ${mmss(cur * TRACE_STEP)}`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => { if (!drag.current) setHover(null); }}
        onKeyDown={onKey} onBlur={() => setSel(null)}>
        <rect x={L} y={T} width={W - L - R} height={p.H - T - B} className="abrp-hit" />
        <Playhead t={p.t} H={p.H} g={g} />
        {p.started && p.t > 0 && <circle cx={sx(p.t)} cy={sy(bwAtTrace(p.trace, p.t))} r={4.5} className="abrp-bwdot" />}
        {shown != null && (
          <g className="abrp-handle">
            <line x1={sx(shown * TRACE_STEP)} x2={sx(shown * TRACE_STEP)} y1={T} y2={p.H - B} />
            <circle cx={sx(shown * TRACE_STEP)} cy={sy(p.trace[shown])} r={7} />
          </g>
        )}
      </svg>
    </div>
  );
}

function bwAtTrace(trace: number[], t: number) {
  const x = t / TRACE_STEP, i = Math.min(trace.length - 2, Math.floor(x)), f = x - i;
  return trace[i] + (trace[i + 1] - trace[i]) * f;
}

function stepPoints(run: Run, t: number): [number, number][] {
  const pts: [number, number][] = [];
  const segs = run.segs.filter((s) => s.reqT <= t);
  segs.forEach((s, k) => {
    const end = k + 1 < segs.length ? segs[k + 1].reqT : t;
    const y = LADDER[s.rung].kbps / 1000;
    pts.push([s.reqT, y], [end, y]);
  });
  return pts;
}

/* ---------------- Buffer level with target, BBA zones and rebuffer markers ---------------- */

export function BufferChart(p: { players: Player[]; t: number; H: number; target: number; showBBA: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const g = useGeo(box);
  const { W, sx } = g;
  const yMax = Math.ceil((p.target + 6) / 8) * 8;
  const sy = mkSy(p.H, yMax);
  const series: Series[] = p.players.map((pl, k) => ({
    id: `buf${k}`, label: `${pl.label} buffer`, color: pl.color, area: p.players.length === 1,
    points: pl.run.samples.filter((s, i) => s.t <= p.t + 1e-9 && (i % 2 === 0 || s.t > p.t - 0.3)).map((s) => [s.t, s.buf] as [number, number]),
  }));
  const z = bbaZones(p.target);
  return (
    <div className="abrp-chartwrap" ref={box}>
      <LineChart series={series} xMax={DURATION} yMax={yMax} height={p.H} yLabel="Buffer, s" xFmt={mmss} yFmt={(v) => String(Math.round(v))}
        hLines={[{ y: p.target, label: `Target ${p.target} s`, tone: "accent" }]}
        bands={p.showBBA ? [{ y0: 0, y1: z.reservoir, tone: "warn" }, { y0: z.reservoir, y1: z.upper, tone: "accent" }] : undefined} />
      <svg className="abrp-overlay" viewBox={`0 0 ${W} ${p.H}`} aria-hidden="true">
        {p.players.map((pl, k) => pl.run.stalls.filter((s) => s.start <= p.t).map((s, i) => {
          const x0 = sx(s.start), x1 = sx(Math.min(s.end, p.t));
          return (
            <g key={`${k}-${i}`} className="abrp-stall">
              <rect x={x0} y={T} width={Math.max(2, x1 - x0)} height={p.H - T - B} />
              <path d={`M${x0 - 7},${T + k * 16} L${x0 + 7},${T + k * 16} L${x0},${T + 12 + k * 16}Z`} style={{ stroke: pl.color }} />
            </g>
          );
        }))}
        {p.players.map((pl, k) => {
          const s = pl.run.samples.find((q) => q.t >= p.t - 1e-9);
          return p.t > 0 && s ? <circle key={k} cx={sx(p.t)} cy={sy(s.buf)} r={4.5} className="abrp-bufdot" style={{ fill: pl.color }} /> : null;
        })}
        <Playhead t={p.t} H={p.H} g={g} />
      </svg>
    </div>
  );
}
