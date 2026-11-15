import { serverColor } from "./model";

/** Keys per server as small vertical bars, with the average as a dashed line. */
export default function LoadBars({ width, servers, load }: { width: number; servers: number[]; load: Map<number, number> }) {
  const H = 58, TOP = 18, LAB = 18;
  const vals = servers.map((s) => load.get(s) ?? 0);
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const top = Math.max(avg * 2.2, ...vals, 1);
  const gap = 4;
  const bw = (width - gap * (servers.length - 1)) / servers.length;
  const y = (v: number) => TOP + H - (v / top) * H;
  return (
    <svg className="ch-svg" width={width} height={TOP + H + LAB} viewBox={`0 0 ${width} ${TOP + H + LAB}`} role="img"
      aria-label={`Keys per server: ${servers.map((s, i) => `S${s} ${vals[i]}`).join(", ")}. Average ${avg.toFixed(1)}.`}>
      <text x={0} y={12} className="ch-small">Keys per server</text>
      {servers.map((s, i) => {
        const x = i * (bw + gap);
        const v = vals[i];
        return (
          <g key={s}>
            <rect x={x} y={TOP} width={bw} height={H} rx={Math.min(5, bw / 3)} className="ch-bar-bg" />
            <rect x={x} y={y(v)} width={bw} height={Math.max(0, TOP + H - y(v))} rx={Math.min(5, bw / 3)} style={{ fill: serverColor(s) }} className="ch-bar" />
            {bw >= 14 && <text x={x + bw / 2} y={TOP + H + 14} textAnchor="middle" className="ch-tick">{bw >= 26 ? `S${s}` : s}</text>}
          </g>
        );
      })}
      <line x1={0} x2={width} y1={y(avg)} y2={y(avg)} className="ch-avg" />
      <text x={width} y={12} textAnchor="end" className="ch-small">dashed = average</text>
    </svg>
  );
}
