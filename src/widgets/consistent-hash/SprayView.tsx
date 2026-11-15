import { TOP_COLORS, ease, lerp, type Spray } from "./model";

export interface Flight { id: number; o: number; s: number; p: number }
export interface Flash { hit: boolean; until: number }

interface Props {
  width: number;
  servers: number[];
  m: number;
  cap: number;
  spray: Spray;
  copies: number[];
  flights: Flight[];
  flashes: Map<number, Flash>;
  clock: number;
}

const objColor = (o: number) => (o < TOP_COLORS.length ? TOP_COLORS[o] : "var(--muted)");

/** Random spray: a copies-per-segment strip on top, then every server's cache as a card of slots. */
export default function SprayView({ width, servers, m, cap, spray, copies, flights, flashes, clock }: Props) {
  const N = servers.length;
  /* copies strip */
  const CH = 84, CT = 22;
  const bw = width / m;
  const cy = (c: number) => CT + CH - (c / N) * CH;
  /* server cards */
  const cols = Math.max(2, Math.min(N, Math.floor(width / 104), 8));
  const gap = 8;
  const cw = (width - gap * (cols - 1)) / cols;
  const pitch = 13;
  const perRow = Math.max(1, Math.floor((cw - 16) / pitch));
  const rowsInCard = Math.ceil(cap / perRow);
  const ch = 28 + rowsInCard * pitch + 6;
  const top = CT + CH + 44;
  const card = (k: number) => {
    const c = k % cols, r = Math.floor(k / cols);
    return { x: c * (cw + gap), y: top + r * (ch + gap) };
  };
  const rows = Math.ceil(N / cols);
  const H = top + rows * (ch + gap);
  const src = { x: width / 2, y: CT + CH + 30 };

  return (
    <svg className="ch-svg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img"
      aria-label={`Random spray across ${N} servers. The most popular segment is stored ${copies[0] ?? 0} times.`}>
      <text x={0} y={12} className="ch-small">{width < 460 ? "Copies per segment, hottest first" : "Copies of each segment in the PoP, most popular first"}</text>
      <g aria-hidden="true">
        {copies.map((c, i) => (
          <rect key={i} x={i * bw + (bw > 3 ? 0.5 : 0)} y={cy(c)} width={Math.max(0.8, bw - (bw > 3 ? 1 : 0.2))} height={CT + CH - cy(c)}
            style={{ fill: objColor(i), opacity: i < TOP_COLORS.length ? 1 : 0.45 }} />
        ))}
      </g>
      <line x1={0} x2={width} y1={CT + CH} y2={CT + CH} className="ch-axis" />
      <line x1={0} x2={width} y1={cy(1)} y2={cy(1)} className="ch-avg" />
      <text x={width} y={cy(1) - 5} textAnchor="end" className="ch-small">1 copy: what an owner per key gives</text>
      <text x={width} y={CT - 4} textAnchor="end" className="ch-small">{`${N} copies`}</text>

      {/* request source */}
      <g aria-hidden="true">
        <text x={src.x} y={src.y - 10} textAnchor="middle" className="ch-small">requests land on a random server</text>
      </g>

      {servers.map((s, k) => {
        const { x, y } = card(k);
        const cache = spray.caches.get(s) ?? [];
        const fl = flashes.get(s);
        const flashing = fl && fl.until > clock;
        return (
          <g key={s}>
            <rect x={x + 0.5} y={y + 0.5} width={cw - 1} height={ch - 1} rx={10}
              className={`ch-card ${flashing ? (fl!.hit ? "hit" : "miss") : ""}`} />
            <text x={x + 10} y={y + 17} className="ch-card-label">{`S${s}`}</text>
            {flashing && <text x={x + cw - 9} y={y + 17} textAnchor="end" className={`ch-card-flag ${fl!.hit ? "hit" : "miss"}`}>{fl!.hit ? "hit" : "miss"}</text>}
            {Array.from({ length: cap }, (_, j) => {
              const o = cache[j];
              const dx = x + 8 + (j % perRow) * pitch + pitch / 2;
              const dy = y + 28 + Math.floor(j / perRow) * pitch + pitch / 2;
              return o === undefined
                ? <circle key={j} cx={dx} cy={dy} r={4.2} className="ch-slot" />
                : <circle key={j} cx={dx} cy={dy} r={4.6} style={{ fill: objColor(o), opacity: o < TOP_COLORS.length ? 1 : 0.5 }} />;
            })}
          </g>
        );
      })}

      <g aria-hidden="true">
        {flights.map((f) => {
          const k = servers.indexOf(f.s);
          if (k < 0) return null;
          const { x, y } = card(k);
          const e = ease(Math.min(1, f.p));
          return <circle key={f.id} cx={lerp(src.x, x + cw / 2, e)} cy={lerp(src.y, y + 8, e)} r={4} className="ch-flight" style={{ fill: objColor(f.o) }} />;
        })}
      </g>
    </svg>
  );
}
