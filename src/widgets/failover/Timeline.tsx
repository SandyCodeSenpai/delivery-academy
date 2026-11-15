import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { DURATION, fmtClock, type SimResult } from "./sim";

interface Props {
  W: number;
  sim: SimResult;
  t: number;
  onScrub: (t: number) => void;
  faultLabel: string;
}

const PL = 6, PR = 6;
// Row layout (y positions in px).
const R = {
  pLabel: 12, pDots: 25, pHealth: 34,
  sLabel: 58, sDots: 71, sHealth: 80,
  trLabel: 104, trTop: 110, trH: 38,
  erLabel: 166, erTop: 172, erH: 30,
  axis: 220, H: 226,
};

const niceMax = (v: number) => [0.05, 0.1, 0.25, 0.5, 1].find((m) => v <= m) ?? 1;

/** 10-minute timeline: probe dot strips, health bars, traffic shares and errors, with a scrubbable playhead. */
export default function Timeline({ W, sim, t, onScrub, faultLabel }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const plotW = W - PL - PR;
  const x = (s: number) => PL + (s / DURATION) * plotW;

  const paths = useMemo(() => {
    const n = sim.ticks.length;
    const yTr = (v: number) => R.trTop + (1 - v) * R.trH;
    const errMax = niceMax(Math.max(0.001, ...sim.ticks.map((k) => k.err)));
    const yEr = (v: number) => R.erTop + (1 - Math.min(1, v / errMax)) * R.erH;
    const xs = (i: number) => (PL + ((i + 0.5) / DURATION) * plotW).toFixed(1);
    const area = (top: (i: number) => number, bot: (i: number) => number) => {
      let d = "";
      for (let i = 0; i < n; i++) d += `${i ? "L" : "M"}${xs(i)},${top(i).toFixed(1)}`;
      for (let i = n - 1; i >= 0; i--) d += `L${xs(i)},${bot(i).toFixed(1)}`;
      return d + "Z";
    };
    const k = sim.ticks;
    const prim = area((i) => yTr(k[i].shareP), () => yTr(0));
    const sec = area((i) => yTr(k[i].shareP + k[i].shareS), (i) => yTr(k[i].shareP));
    const drop = area(() => yTr(1), (i) => yTr(k[i].shareP + k[i].shareS));
    const err = area((i) => yEr(k[i].err), () => yEr(0));
    let errLine = "";
    for (let i = 0; i < n; i++) errLine += `${i ? "L" : "M"}${xs(i)},${yEr(k[i].err).toFixed(1)}`;
    // Health segments.
    const segs = (key: "upP" | "upS") => {
      const out: { a: number; b: number; up: boolean }[] = [];
      let a = 0;
      for (let i = 1; i <= n; i++) {
        if (i === n || k[i][key] !== k[a][key]) { out.push({ a, b: i, up: k[a][key] }); a = i; }
      }
      return out;
    };
    return { prim, sec, drop, err, errLine, errMax, hp: segs("upP"), hs: segs("upS"), hasDrop: k.some((q) => q.drop > 0.01) };
  }, [sim, plotW]);

  const scrubAt = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const s = ((e.clientX - r.left - PL) / plotW) * DURATION;
    onScrub(Math.max(0, Math.min(DURATION, s)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 60 : 10;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") onScrub(Math.min(DURATION, t + step));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onScrub(Math.max(0, t - step));
    else if (e.key === "Home") onScrub(0);
    else if (e.key === "End") onScrub(DURATION);
    else return;
    e.preventDefault();
  };

  const spacing = plotW / sim.probes.filter((p) => p.target === 0).length;
  const r = Math.max(1.6, Math.min(4, spacing * 0.36));
  const narrow = W < 460;
  const ph = x(t);

  return (
    <svg ref={ref} width={W} height={R.H} viewBox={`0 0 ${W} ${R.H}`} className="fo-svg fo-tl" tabIndex={0} role="slider"
      aria-label="Timeline. Use arrow keys to move through the 10 minutes." aria-valuemin={0} aria-valuemax={DURATION} aria-valuenow={Math.round(t)} aria-valuetext={fmtClock(t)}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); scrubAt(e); }}
      onPointerMove={(e) => { if (e.buttons & 1) scrubAt(e); }} onKeyDown={onKey}>
      {/* Fault windows */}
      {sim.faults.map(([a, b], i) => (
        <rect key={i} x={x(a)} y={16} width={x(Math.min(b, DURATION)) - x(a)} height={R.erTop + R.erH - 16} className="fo-fault" />
      ))}

      {/* Probe dots */}
      {sim.probes.map((p, i) => (
        <circle key={i} cx={x(p.send)} cy={p.target === 0 ? R.pDots : R.sDots} r={r} style={{ fill: p.ok ? "var(--good)" : "var(--bad)" }} />
      ))}
      {/* Health bars */}
      {paths.hp.map((s, i) => <rect key={`p${i}`} x={x(s.a)} y={R.pHealth} width={x(s.b) - x(s.a)} height={5} rx={1} style={{ fill: s.up ? "var(--good)" : "var(--bad)", opacity: 0.55 }} />)}
      {paths.hs.map((s, i) => <rect key={`s${i}`} x={x(s.a)} y={R.sHealth} width={x(s.b) - x(s.a)} height={5} rx={1} style={{ fill: s.up ? "var(--good)" : "var(--bad)", opacity: 0.55 }} />)}

      {/* Traffic and errors */}
      <rect x={PL} y={R.trTop} width={plotW} height={R.trH} className="fo-plot-bg" />
      <path d={paths.prim} style={{ fill: "var(--p5)", opacity: 0.8 }} />
      <path d={paths.sec} style={{ fill: "var(--p2)", opacity: 0.8 }} />
      {paths.hasDrop && <path d={paths.drop} style={{ fill: "var(--bad)", opacity: 0.7 }} />}
      <rect x={PL} y={R.erTop} width={plotW} height={R.erH} className="fo-plot-bg" />
      <path d={paths.err} style={{ fill: "var(--bad)", opacity: 0.2 }} />
      <path d={paths.errLine} fill="none" style={{ stroke: "var(--bad)" }} strokeWidth={1.5} strokeLinejoin="round" />

      {/* Future is dimmed; playhead */}
      {t < DURATION && <rect x={ph} y={14} width={W - PR - ph} height={R.erTop + R.erH - 12} className="fo-future" />}
      <line x1={ph} x2={ph} y1={15} y2={R.erTop + R.erH + 2} className="fo-playhead" />
      <circle cx={ph} cy={15} r={4.5} className="fo-playhead-knob" />

      {/* Labels and legend */}
      <text x={PL} y={R.pLabel} className="fo-t-label">Primary checks</text>
      <g className="fo-t-small" transform={`translate(${W - PR - 12},${R.pLabel})`}>
        <text textAnchor="end">
          <tspan style={{ fill: "var(--good)" }}>●</tspan> pass{"  "}
          <tspan style={{ fill: "var(--bad)" }}>●</tspan> fail{"  "}
          <tspan className="fo-fault-key">■</tspan> {narrow ? "fault" : faultLabel}
        </text>
      </g>
      <text x={PL} y={R.sLabel} className="fo-t-label">Secondary checks</text>
      <text x={PL} y={R.trLabel} className="fo-t-label">
        Traffic on <tspan style={{ fill: "var(--p5)" }}>primary</tspan> and <tspan style={{ fill: "var(--p2)" }}>secondary</tspan>
        {paths.hasDrop && <tspan style={{ fill: "var(--bad)" }}> / no answer</tspan>}
      </text>
      <text x={PL} y={R.erLabel} className="fo-t-label">Errors served to viewers</text>
      <text x={W - PR} y={R.erLabel} textAnchor="end" className="fo-t-small">scale 0 to {Math.round(paths.errMax * 100)}%</text>

      {/* Axis */}
      {[0, 2, 4, 6, 8, 10].map((m) => (
        <text key={m} x={x(m * 60)} y={R.axis} textAnchor={m === 0 ? "start" : m === 10 ? "end" : "middle"} className="fo-t-small">
          {m === 10 ? "10 min" : `${m}:00`}
        </text>
      ))}
    </svg>
  );
}
