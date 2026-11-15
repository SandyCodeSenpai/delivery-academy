import { fmtPct } from "@/lib/format";
import type { Probe, ScenarioId, Settings, Tick } from "./sim";

interface Props {
  W: number;
  tick: Tick;
  t: number;
  probes: Probe[]; // sorted by done time
  settings: Settings;
  scenario: ScenarioId;
  flowing: boolean;
}

const PRIMARY = "var(--p5)";
const SECONDARY = "var(--p2)";

/** Viewers on the left, primary and secondary on the right, traffic as two bands, health checker on top. */
export default function Diagram({ W, tick, t, probes, settings, scenario, flowing }: Props) {
  const narrow = W < 460;
  const vw = narrow ? 76 : 100, vh = 58;
  const tw = narrow ? 134 : 184, nh = 66;
  const tx = W - tw - 12;
  const pY = 36, sY = pY + nh + 20;
  const H = sY + nh + 4;
  const vy = (pY + sY + nh) / 2 - vh / 2;
  const maxBand = narrow ? 22 : 30;
  const cut = scenario === "checker" && t >= 180 && t < 420;

  const band = (share: number, y1: number, off: number) => {
    const x0 = vw, y0 = vy + vh / 2 + off, x1 = tx, dx = (x1 - x0) / 2;
    return { d: `M${x0},${y0} C${x0 + dx},${y0} ${x1 - dx},${y1} ${x1},${y1}`, w: 2 + share * maxBand };
  };
  const bP = band(tick.shareP, pY + nh / 2, -8);
  const bS = band(tick.shareS, sY + nh / 2, 8);
  const viewerErr = tick.err;

  const lastChecks = (k: 0 | 1) => {
    const done = probes.filter((p) => p.target === k && p.done <= t);
    return done.slice(-(narrow ? 4 : 6));
  };

  const node = (k: 0 | 1, y: number) => {
    const isP = k === 0;
    const up = isP ? tick.upP : tick.upS;
    const cf = isP ? tick.cfP : tick.cfS, cs = isP ? tick.csP : tick.csS;
    const load = isP ? tick.loadP : tick.loadS, cap = isP ? tick.capP : tick.capS;
    const ratio = cap > 0 ? load / cap : 0;
    const chip = up ? (narrow ? "Up" : "Healthy") : (narrow ? "Down" : "Unhealthy");
    const chipW = narrow ? 46 : 80;
    const checks = lastChecks(k);
    const counter = up ? `fails ${Math.min(cf, settings.failN)}/${settings.failN}` : `passes ${Math.min(cs, settings.passM)}/${settings.passM}`;
    const barX = 46, barW = tw - barX - 12;
    const loadTone = ratio >= 1 ? "var(--bad)" : ratio > 0.85 ? "var(--warn)" : "var(--good)";
    return (
      <g transform={`translate(${tx},${y})`} className="fo-node">
        <rect width={tw} height={nh} rx={14} className="fo-node-box" style={{ stroke: isP ? PRIMARY : SECONDARY }} />
        <text x={12} y={21} className="fo-t-name">{isP ? "Primary" : "Secondary"}</text>
        <g transform={`translate(${tw - chipW - 8},8)`}>
          <rect width={chipW} height={20} rx={10} style={{ fill: up ? "var(--good-soft)" : "var(--bad-soft)" }} />
          <text x={chipW / 2} y={14} textAnchor="middle" className="fo-t-chip" style={{ fill: up ? "var(--good)" : "var(--bad)" }}>{chip}</text>
        </g>
        {checks.map((p, i) => (
          <circle key={`${p.send}`} cx={16 + i * 11} cy={38} r={4} style={{ fill: p.ok ? "var(--good)" : "var(--bad)" }} />
        ))}
        <text x={tw - 12} y={42} textAnchor="end" className="fo-t-small">{counter}</text>
        <text x={12} y={58} className="fo-t-small">load</text>
        <rect x={barX} y={51} width={barW} height={6} rx={3} style={{ fill: "var(--surface-3)" }} />
        <rect x={barX} y={51} width={Math.max(0, Math.min(1, ratio)) * barW} height={6} rx={3} style={{ fill: loadTone }} className="fo-bar" />
      </g>
    );
  };

  const pillW = narrow ? 128 : 210;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="fo-svg" role="img"
      aria-label={`Traffic: ${fmtPct(tick.shareP)} on primary, ${fmtPct(tick.shareS)} on secondary. Primary is ${tick.upP ? "healthy" : "unhealthy"}, secondary is ${tick.upS ? "healthy" : "unhealthy"}. Viewers see ${fmtPct(viewerErr, 1)} errors.`}>
      {/* Health checker and its links to both targets */}
      <path d={`M${W - 4},24 V${sY + nh / 2} M${W - 4},${pY + nh / 2} H${W - 12} M${W - 4},${sY + nh / 2} H${W - 12}`}
        className="fo-check-line" style={{ stroke: cut ? "var(--bad)" : "var(--muted)" }} />
      <g transform={`translate(${W - pillW},0)`}>
        <rect width={pillW} height={24} rx={12} className="fo-pill" style={{ stroke: cut ? "var(--bad)" : "var(--line)" }} />
        <circle cx={14} cy={12} r={4} style={{ fill: cut ? "var(--bad)" : "var(--good)" }} className={flowing && !cut ? "fo-pulse" : undefined} />
        <text x={24} y={16} className="fo-t-small" style={{ fill: cut ? "var(--bad)" : "var(--ink-2)" }}>
          {cut ? (narrow ? "Checker cut off" : "Health checker: cut off") : narrow ? `Checker, ${settings.interval} s` : `Health checker, every ${settings.interval} s`}
        </text>
      </g>

      {/* Bands: base track, traffic, failing core, flow dashes */}
      {[{ b: bP, share: tick.shareP, err: tick.errP, c: PRIMARY }, { b: bS, share: tick.shareS, err: tick.errS, c: SECONDARY }].map(({ b, share, err, c }, i) => (
        <g key={i}>
          <path d={b.d} className="fo-track" />
          <path d={b.d} className="fo-band" style={{ stroke: c, strokeWidth: b.w, opacity: share > 0.01 ? 0.85 : 0.18 }} />
          {share * err > 0.004 && <path d={b.d} className="fo-band" style={{ stroke: "var(--bad)", strokeWidth: Math.max(2, share * err * maxBand) }} />}
          {share > 0.05 && <path d={b.d} className="fo-flow" />}
        </g>
      ))}

      {/* Viewers */}
      <g transform={`translate(0,${vy})`}>
        <rect width={vw} height={vh} rx={14} className="fo-node-box" />
        <text x={vw / 2} y={23} textAnchor="middle" className="fo-t-name">Viewers</text>
        <text x={vw / 2} y={42} textAnchor="middle" className="fo-t-small" style={{ fill: viewerErr > 0.01 ? "var(--bad)" : "var(--muted)", fontWeight: 700 }}>
          {tick.drop > 0.02 ? `${fmtPct(tick.drop)} lost` : `${fmtPct(viewerErr, viewerErr < 0.1 && viewerErr > 0 ? 1 : 0)} fail`}
        </text>
      </g>

      {node(0, pY)}
      {node(1, sY)}
    </svg>
  );
}
