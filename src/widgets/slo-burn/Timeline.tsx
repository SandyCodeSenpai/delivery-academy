import { useRef } from "react";
import { useWidth } from "@/lib/hooks";
import { budgetLeft, dur, maxErr, pct, RULES, WINDOW_MIN, STATIC_RATE, type RuleId, type Sim } from "./model";

export interface View { t0: number; t1: number }

const L = 46, R = 12;
const LOG_MIN = -4, LOG_MAX = 0; // 0.01% .. 100%

const RULE_TONE: Record<RuleId, string> = { static: "var(--bad)", fast: "var(--bad)", slow: "var(--bad)", ticket: "var(--warn)" };

/** Nice tick step in minutes for a span, aiming for about `n` ticks. */
function tickStep(span: number, n: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320];
  return steps.find((s) => span / s <= n) ?? 4320;
}
function relLabel(m: number, step: number): string {
  if (m === 0) return "start";
  const sign = m > 0 ? "+" : "-", a = Math.abs(m);
  if (step < 60) return `${sign}${a}m`;
  if (step < 1440 || a % 1440 !== 0) return `${sign}${Number((a / 60).toFixed(1))}h`;
  return `${sign}${a / 1440}d`;
}

export default function Timeline({ sim, view, playT, compact }: { sim: Sim; view: View; playT: number; compact: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const W = Math.max(280, useWidth(ref) || 600);
  const narrow = W < 460;
  const pw = W - L - R;
  const b = 1 - sim.slo;
  const { t0, t1 } = view;
  const span = t1 - t0;
  const sx = (t: number) => L + ((t - t0) / span) * pw;
  const start = sim.inc.start, end = sim.inc.start + sim.inc.dur;
  const cut = Math.min(t1, playT);

  // ---- Panel A: error rate (log scale) ----
  const aTop = 20, aH = compact || narrow ? 136 : 176;
  const sy = (v: number) => aTop + (1 - (Math.log10(Math.max(v, 1e-4)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * aH;
  const cols = Math.max(40, Math.floor(pw / 2));
  const pts: [number, number][] = [];
  for (let c = 0; c <= cols; c++) {
    const ta = t0 + (c / cols) * span, tb = t0 + ((c + 1) / cols) * span;
    if (ta > cut) break;
    pts.push([sx(ta), sy(maxErr(sim, ta, tb))]);
  }
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const area = pts.length ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${aTop + aH}L${pts[0][0].toFixed(1)},${aTop + aH}Z` : "";
  const step = tickStep(span, narrow ? 3 : 6);
  const ticks: number[] = [];
  for (let m = Math.ceil((t0 - start) / step) * step; start + m <= t1; m += step) ticks.push(m);
  const thresholds = [
    { v: 14.4 * b, label: "14.4x", tone: "var(--bad)" },
    { v: 6 * b, label: "6x", tone: "var(--bad)" },
    { v: 1 * b, label: "1x", tone: "var(--warn)" },
  ];
  // Hide a burn label if it would sit on top of the one above it.
  // Label above the line; if that would collide with the label above it, put it below the line instead.
  let lastLabel = -99;
  const thrShown = thresholds.map((t) => {
    const y = sy(t.v);
    let ly = y - 4;
    if (ly - lastLabel < 13) ly = y + 13;
    const showLabel = ly - lastLabel >= 13 && ly <= aTop + aH - 2;
    if (showLabel) lastLabel = ly;
    return { ...t, y, ly, showLabel };
  });

  // ---- Panel B: alert lanes ----
  const bTop = aTop + aH + 26;
  const laneH = 30, groupGap = 22;
  const laneY = (i: number) => bTop + 18 + i * laneH + (i >= 1 ? groupGap : 0);
  const bBottom = laneY(RULES.length - 1) + laneH;

  // ---- Panel C: 30-day budget ----
  const cTop = bBottom + 22, cH = compact || narrow ? 64 : 80;
  const dx = (t: number) => L + (t / WINDOW_MIN) * pw;
  const samples = 360;
  const bud: [number, number][] = [];
  let minB = 1;
  for (let k = 0; k <= samples; k++) { const t = (k / samples) * WINDOW_MIN; const v = budgetLeft(sim, t); bud.push([t, v]); if (v < minB) minB = v; }
  // make sure the incident's drop is sampled exactly
  const yLo = Math.min(0, Math.floor(minB * 4) / 4), yHi = 1;
  const by = (v: number) => cTop + 16 + (1 - (v - yLo) / (yHi - yLo)) * cH;
  const solid: string[] = [], dashed: string[] = [];
  const pieces = [...bud, [start, budgetLeft(sim, start)], [Math.min(end, WINDOW_MIN), budgetLeft(sim, end)]].sort((p, q) => p[0] - q[0]) as [number, number][];
  if (cut >= t0) pieces.push([cut, budgetLeft(sim, cut)]);
  pieces.sort((p, q) => p[0] - q[0]);
  for (const [t, v] of pieces) (t <= cut ? solid : dashed).push(`${dx(t).toFixed(1)},${by(v).toFixed(1)}`);
  if (solid.length && dashed.length) dashed.unshift(solid[solid.length - 1]);
  const endLeft = budgetLeft(sim, WINDOW_MIN);
  const H = cTop + 16 + cH + 22;

  const revealed = (t: number | null) => t != null && t <= cut;
  const aria = `Timeline. Error rate peaks at ${pct(sim.inc.rate * sim.inc.share)}. ` +
    RULES.map((r) => `${r.title}: ${sim.rules[r.id].first == null ? "does not fire" : `fires after ${dur(sim.rules[r.id].first! + 1 - start)}`}`).join(". ") +
    `. Budget left at day 30: ${pct(endLeft)}.`;

  return (
    <div ref={ref} className="slo-tl">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {/* Panel A */}
        <text x={L} y={12} className="slo-axis">Error rate (log scale)</text>
        <rect x={sx(Math.max(t0, start))} y={aTop} width={Math.max(2, sx(Math.min(t1, end)) - sx(Math.max(t0, start)))} height={aH} className="slo-incband" />
        <text x={Math.min(W - R - 4, sx(Math.max(t0, start)) + 4)} y={aTop + 13} className="slo-tick slo-inclabel">incident</text>
        {[-4, -3, -2, -1, 0].map((e) => (
          <g key={e}>
            <line x1={L} x2={W - R} y1={sy(10 ** e)} y2={sy(10 ** e)} className="slo-grid" />
            <text x={L - 6} y={sy(10 ** e) + 4} textAnchor="end" className="slo-tick">{pct(10 ** e)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={sy(STATIC_RATE)} y2={sy(STATIC_RATE)} className="slo-thr" style={{ stroke: "var(--ink-2)" }} />
        {thrShown.map((t) => (
          <line key={t.label} x1={L} x2={W - R} y1={t.y} y2={t.y} className="slo-thr" style={{ stroke: t.tone }} />
        ))}
        <text x={L + 4} y={sy(STATIC_RATE) - 4} className="slo-tick slo-thrlabel" style={{ fill: "var(--ink-2)" }}>static 1%</text>
        {thrShown.map((t) => t.showLabel && (
          <text key={t.label} x={W - R - 2} y={t.ly} textAnchor="end" className="slo-tick slo-thrlabel" style={{ fill: t.tone }}>{t.label} = {pct(t.v)}</text>
        ))}
        {area && <path d={area} className="slo-errarea" />}
        {line && <path d={line} className="slo-errline" />}
        {ticks.map((m) => (
          <text key={m} x={sx(start + m)} y={aTop + aH + 16} textAnchor="middle" className="slo-tick">{relLabel(m, step)}</text>
        ))}

        {/* Panel B */}
        <text x={L} y={bTop + 8} className="slo-group">(a) Static threshold</text>
        <text x={L} y={laneY(1) - 8} className="slo-group">(b) Multi-window, multi-burn-rate</text>
        {RULES.map((r, i) => {
          const res = sim.rules[r.id];
          const y = laneY(i);
          const fired = revealed(res.first);
          const det = res.first != null ? res.first + 1 - start : null;
          return (
            <g key={r.id}>
              <text x={L} y={y + 9} className="slo-lanelabel">{r.title}</text>
              <text x={W - R} y={y + 9} textAnchor="end" className="slo-lanestate" style={{ fill: fired ? RULE_TONE[r.id] : "var(--muted)" }}>
                {fired ? `${r.kind === "page" ? "pages" : "tickets"} +${dur(det!)}` : res.first != null ? "" : "silent"}
              </text>
              <rect x={L} y={y + 14} width={pw} height={10} rx={5} className="slo-track" />
              {res.intervals.map((iv, k) => {
                if (iv.from > cut || iv.from > t1 || iv.to < t0) return null;
                const x0 = Math.min(sx(Math.max(t0, iv.from)), W - R - 10);
                const x1 = Math.min(W - R, Math.max(x0 + 10, sx(Math.min(cut, t1, iv.to))));
                return <rect key={k} x={x0} y={y + 14} width={x1 - x0} height={10} rx={5} style={{ fill: RULE_TONE[r.id] }} className="slo-fire" />;
              })}
              {fired && res.first! >= t0 && <circle cx={Math.min(W - R - 5, Math.max(L + 5, sx(res.first!)))} cy={y + 19} r={6} className="slo-dot" style={{ stroke: RULE_TONE[r.id] }} />}
            </g>
          );
        })}

        {/* Playhead */}
        {playT < t1 && playT >= t0 && <line x1={sx(playT)} x2={sx(playT)} y1={aTop} y2={bBottom} className="slo-playhead" />}

        {/* Panel C */}
        <text x={L} y={cTop + 6} className="slo-axis">{narrow ? "Budget left" : "Error budget left, 30-day window"}</text>
        <text x={W - R} y={cTop + 6} textAnchor="end" className="slo-axis" style={{ fill: endLeft < 0 ? "var(--bad)" : "var(--ink-2)" }}>
          {endLeft < 0 ? `overspent by ${pct(-endLeft)}` : `${pct(endLeft)} left at day 30`}
        </text>
        <rect x={dx(Math.max(0, t0))} y={cTop + 16} width={Math.max(3, dx(Math.min(WINDOW_MIN, t1)) - dx(Math.max(0, t0)))} height={cH} className="slo-zoomband" />
        {[yHi, 0.5, 0, ...(yLo < 0 ? [yLo] : [])].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={by(v)} y2={by(v)} className={v === 0 ? "slo-zero" : "slo-grid"} />
            <text x={L - 6} y={by(v) + 4} textAnchor="end" className="slo-tick">{pct(v)}</text>
          </g>
        ))}
        {solid.length > 1 && <polyline points={solid.join(" ")} className="slo-budline" />}
        {dashed.length > 1 && <polyline points={dashed.join(" ")} className="slo-budline proj" />}
        {[0, 10, 20, 30].map((d) => (
          <text key={d} x={dx(d * 1440)} y={cTop + 16 + cH + 16} textAnchor={d === 0 ? "start" : d === 30 ? "end" : "middle"} className="slo-tick">day {d}</text>
        ))}
      </svg>
    </div>
  );
}
