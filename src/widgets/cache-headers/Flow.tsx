import { CLIENTS, N, OUTCOME_COLOR, fmtDur, type Policy, type Result } from "./sim";

/** Replay timing (real seconds). The 60 s timeline plays in about 6.5 s. */
export const SPEED = N / 6.5;
export const LEG = 0.3;

export const legsOf = (r: Result) => (r.outcome === "HIT" || r.outcome === "STALE" ? 2 : 4);
export const startOf = (r: Result) => r.req.t / SPEED;
export const revealOf = (r: Result) => startOf(r) + legsOf(r) * LEG;
export const endOf = (results: Result[]) => Math.max(N / SPEED, ...results.map((r) => revealOf(r) + (r.bg ? LEG : 0))) + 0.25;

type P = [number, number];
const lerp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

interface Packet { key: string; at: P; r: number; color: string; hollow?: boolean }

export function Flow(p: {
  width: number; results: Result[]; el: number | null; clock: number; pol: Policy;
  originDown: boolean; downFrom: number; originCount: number; originFailed: number; copies: number; state: { text: string; tone: "good" | "warn" | "bad" | "" };
}) {
  const W = Math.max(280, p.width);
  const narrow = W < 460;
  const H = 150;
  const vx = 2, vw = narrow ? 70 : 104;
  const rowY = (i: number) => 22 + i * 26;
  const cw = narrow ? 104 : 150, ch = 96, cx = Math.round(vw + (W - vw - (narrow ? 82 : 128)) / 2 + 4), cy = H / 2;
  const ow = narrow ? 78 : 118, ox = W - ow - 1;
  const down = p.originDown && p.clock >= p.downFrom;
  const Cl: P = [cx - cw / 2, cy], Cr: P = [cx + cw / 2, cy], Ol: P = [ox, cy];

  const packets: Packet[] = [];
  if (p.el !== null) {
    for (const r of p.results) {
      const s = (p.el - startOf(r)) / LEG;
      const V: P = [vx + vw + 6, rowY(r.req.client)];
      const color = OUTCOME_COLOR[r.outcome];
      const resp = r.originFailed ? "var(--bad)" : r.originBytes <= 300 ? "var(--p3)" : "var(--warn)";
      const legs: { a: P; b: P; color: string; r: number }[] = legsOf(r) === 2
        ? [{ a: V, b: Cl, color: "var(--ink-2)", r: 4 }, { a: Cl, b: V, color, r: 6 }]
        : [{ a: V, b: Cl, color: "var(--ink-2)", r: 4 }, { a: Cr, b: Ol, color: "var(--ink-2)", r: 4 },
           { a: Ol, b: Cr, color: resp, r: r.originBytes > 300 ? 6 : 3.5 }, { a: Cl, b: V, color, r: r.outcome === "ERROR" ? 4 : 6 }];
      if (s >= 0 && s < legs.length) {
        const L = legs[Math.floor(s)];
        packets.push({ key: `m${r.req.id}`, at: lerp(L.a, L.b, ease(s - Math.floor(s))), r: L.r, color: L.color });
      }
      if (r.bg) {
        const b = s - 1; // background refresh leaves the CDN once the request arrives
        const bl = [{ a: Cr, b: Ol, c: "var(--ink-2)", r: 3.5 }, { a: Ol, b: Cr, c: r.bg === "fail" ? "var(--bad)" : r.bg === "304" ? "var(--p3)" : "var(--warn)", r: r.bg === "200" ? 5.5 : 3.5 }];
        if (b >= 0 && b < 2) {
          const L = bl[Math.floor(b)];
          packets.push({ key: `b${r.req.id}`, at: lerp(L.a, L.b, ease(b - Math.floor(b))), r: L.r, color: L.c, hollow: true });
        }
      }
    }
  }

  const label = `Viewers send requests to the CDN edge, which goes to the origin on a miss. ${p.originCount} origin requests so far.${down ? " The origin is down." : ""}`;
  return (
    <svg className="ch-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      {CLIENTS.map((c, i) => (
        <g key={c.name}>
          <line className="ch-wire" x1={vx + vw + 6} y1={rowY(i)} x2={Cl[0]} y2={cy} />
          <circle className="ch-client-dot" cx={vx + 5} cy={rowY(i)} r={4} />
          <text className="ch-client" x={vx + 14} y={rowY(i) + 4}>{narrow ? c.short : c.name}</text>
        </g>
      ))}
      <line className={`ch-wire ${down ? "down" : ""}`} x1={Cr[0]} y1={cy} x2={Ol[0]} y2={cy} />

      <rect className="ch-node-box cdn" x={cx - cw / 2} y={cy - ch / 2} width={cw} height={ch} rx={14} />
      <text className="ch-node-title" x={cx} y={cy - 22} textAnchor="middle">CDN edge</text>
      <text className={`ch-node-sub ${p.state.tone}`} x={cx} y={cy - 2} textAnchor="middle">{p.state.text}</text>
      <text className="ch-node-sub" x={cx} y={cy + 18} textAnchor="middle">
        {p.pol.stores ? `${p.copies} ${p.copies === 1 ? "copy" : "copies"}` : "stores nothing"}
      </text>
      <text className="ch-node-sub" x={cx} y={cy + 36} textAnchor="middle">{p.pol.stores ? `TTL ${fmtDur(p.pol.ttl)}` : p.pol.noStoreReason}</text>

      <rect className={`ch-node-box ${down ? "down" : ""}`} x={ox} y={cy - 40} width={ow} height={80} rx={14} />
      <text className="ch-node-title" x={ox + ow / 2} y={cy - 18} textAnchor="middle">Origin</text>
      <text className={`ch-node-sub ${down ? "bad" : "good"}`} x={ox + ow / 2} y={cy} textAnchor="middle">{down ? "down" : "up"}</text>
      <text className="ch-count" x={ox + ow / 2} y={cy + 18} textAnchor="middle">{p.originCount} {narrow ? "req" : p.originCount === 1 ? "request" : "requests"}</text>
      {p.originFailed > 0 && <text className="ch-node-sub bad" x={ox + ow / 2} y={cy + 33} textAnchor="middle">{p.originFailed} failed</text>}

      {packets.map((k) => (
        <circle key={k.key} cx={k.at[0]} cy={k.at[1]} r={k.r}
          style={k.hollow ? { fill: "var(--surface)", stroke: k.color, strokeWidth: 2 } : { fill: k.color }} />
      ))}
    </svg>
  );
}
