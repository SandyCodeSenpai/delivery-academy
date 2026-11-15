import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Callout, Segmented, Stage, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtNum } from "@/lib/format";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { CITIES, POPS, mapScenario, type ResolverKind } from "./data";
import { Predict } from "./Predict";

/* Coarse land boxes [lonLeft, latTop, lonRight, latBottom], sampled into a dot grid.
   Deliberately abstract: a hint of the continents, not a real map. */
const LAND: [number, number, number, number][] = [
  [-166, 71, -141, 58], [-141, 70, -62, 50], [-125, 50, -67, 30], [-88, 31, -80, 25], [-117, 32, -97, 18], [-98, 19, -78, 8],
  [-55, 76, -22, 61],
  [-80, 12, -50, 0], [-81, 0, -35, -15], [-73, -15, -40, -24], [-72, -24, -53, -38], [-75, -38, -65, -53],
  [-10, 43, 3, 36], [-5, 51, 25, 43], [-8, 58, 1, 50], [6, 70, 30, 56], [20, 60, 45, 44], [9, 45, 17, 39],
  [-17, 35, 33, 5], [32, 18, 51, 2], [9, 5, 41, -34], [43, -12, 50, -25],
  [35, 37, 58, 14], [44, 39, 70, 25],
  [45, 72, 180, 50], [45, 50, 122, 36], [75, 42, 122, 22], [125, 42, 130, 35], [68, 30, 89, 8], [92, 28, 109, 9], [99, 9, 104, 1],
  [95, 5, 141, -8], [118, 18, 126, 6], [130, 45, 145, 31],
  [114, -13, 153, -38], [131, -1, 150, -10], [167, -35, 178, -46],
];
const LON0 = -128, LON1 = 160, LAT0 = 64, LAT1 = -46;
function landDots(STEP: number) {
  const out: [number, number][] = [];
  for (let lat = LAT0 - 1; lat >= LAT1; lat -= STEP)
    for (let lon = LON0 + 1; lon <= LON1; lon += STEP)
      if (LAND.some(([l, t, r, b]) => lon >= l && lon <= r && lat <= t && lat >= b)) out.push([lat, lon]);
  return out;
}
const DOTS_WIDE = landDots(3), DOTS_NARROW = landDots(4);

function useProj(W: number) {
  const H = Math.round(Math.max(180, Math.min(400, W * 0.46)));
  const pad = 10;
  const p = (lat: number, lon: number): [number, number] => [
    pad + ((lon - LON0) / (LON1 - LON0)) * (W - 2 * pad),
    pad + ((LAT0 - lat) / (LAT0 - LAT1)) * (H - 2 * pad),
  ];
  return { H, p };
}

/** Pill label in the SVG at real pixel size. */
interface TagSpec { key: string; x: number; y: number; text: string; tone: string }
interface Rect { l: number; t: number; w: number; h: number }
const TAG_H = 20;
const tagW = (text: string) => text.length * 7 + 14;
const hit = (a: Rect, b: Rect) => a.l < b.l + b.w + 4 && b.l < a.l + a.w + 4 && a.t < b.t + b.h + 2 && b.t < a.t + a.h + 2;

/** Greedy label placement: try below, above, right, left of each anchor point; avoid earlier labels and markers. */
function placeTags(specs: TagSpec[], W: number, H: number, avoid: [number, number][]) {
  const placed: (Rect & TagSpec)[] = [];
  for (const sp of specs) {
    const w = tagW(sp.text);
    const cands: [number, number][] = [[sp.x - w / 2, sp.y + 12], [sp.x - w / 2, sp.y - 12 - TAG_H], [sp.x + 14, sp.y - TAG_H / 2], [sp.x - 14 - w, sp.y - TAG_H / 2],
      [sp.x - w / 2, sp.y + 34], [sp.x - w / 2, sp.y - 34 - TAG_H]];
    let best: Rect | null = null;
    for (const [l0, t0] of cands) {
      const r: Rect = { l: Math.max(2, Math.min(W - w - 2, l0)), t: Math.max(2, Math.min(H - TAG_H - 2, t0)), w, h: TAG_H };
      const bad = placed.some((q) => hit(q, r)) || avoid.some(([x, y]) => x > r.l - 4 && x < r.l + r.w + 4 && y > r.t - 4 && y < r.t + r.h + 4);
      if (!bad) { best = r; break; }
      if (!best) best = r;
    }
    placed.push({ ...sp, ...best! });
  }
  return placed;
}

function Tags({ tags }: { tags: (Rect & TagSpec)[] }) {
  return (
    <>
      {tags.map((g) => (
        <g key={g.key} className={`dr-tag ${g.tone}`}>
          <rect x={g.l} y={g.t} width={g.w} height={g.h} rx={10} />
          <text x={g.l + g.w / 2} y={g.t + 14} textAnchor="middle">{g.text}</text>
        </g>
      ))}
    </>
  );
}

function arc(x1: number, y1: number, x2: number, y2: number, bend: number) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * len * bend, cy = my + (dx / len) * len * bend;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

export function LocationLab({ onEcsSeen }: { full?: boolean; onEcsSeen: () => void }) {
  const [city, setCity] = useState("sao");
  const [kind, setKind] = useState<ResolverKind>("public");
  const [ecs, setEcs] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const sc = mapScenario(city, kind, ecs);

  useEffect(() => {
    if (!revealed || kind !== "public") return;
    setSeen((prev) => {
      const k = `${city}:${ecs ? 1 : 0}`;
      if (prev.has(k)) return prev;
      const next = new Set(prev); next.add(k); return next;
    });
  }, [revealed, kind, city, ecs]);
  const ecsSeen = CITIES.some((c) => seen.has(`${c.id}:0`) && seen.has(`${c.id}:1`));
  const firedRef = useRef(false);
  useEffect(() => { if (ecsSeen && !firedRef.current) { firedRef.current = true; onEcsSeen(); } }, [ecsSeen, onEcsSeen]);

  const { H, p } = useProj(Math.max(W, 1));
  const narrowMap = W < 500;
  const dotR = Math.max(1.2, Math.min(2.4, (W / ((LON1 - LON0) / (narrowMap ? 4 : 3))) * 0.3));
  const [vx, vy] = p(sc.city.lat, sc.city.lon);
  const [rx, ry] = p(sc.resolverAt.lat, sc.resolverAt.lon);
  const [px, py] = p(sc.pop.lat, sc.pop.lon);
  const tone = sc.rtt < 40 ? "good" : sc.rtt < 80 ? "warn" : "bad";
  const popFar = Math.hypot(px - vx, py - vy) > 10;
  const resFar = kind === "public";
  const scenarioKey = `${city}-${kind}-${ecs}`;

  const map = (
    <Stage className="dr-map-stage">
      <div ref={ref} className="dr-measure">
        {W > 0 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={revealed
              ? `Map. Viewer in ${sc.city.name}. Resolver in ${sc.resolverAt.name}. The CDN's DNS picks the ${sc.pop.name} PoP, round trip about ${sc.rtt} ms.`
              : `Map. Viewer in ${sc.city.name}. Resolver in ${sc.resolverAt.name}. PoP choice hidden until you predict.`}>
            <g className="dr-land">
              {(narrowMap ? DOTS_NARROW : DOTS_WIDE).map(([lat, lon], i) => { const [x, y] = p(lat, lon); return <circle key={i} cx={x} cy={y} r={dotR} />; })}
            </g>
            {POPS.map((q) => {
              const [x, y] = p(q.lat, q.lon);
              return <circle key={q.id} cx={x} cy={y} r={3.5} className="dr-pop" />;
            })}
            {CITIES.map((c) => {
              const [x, y] = p(c.lat, c.lon);
              const on = c.id === city;
              return (
                <circle key={c.id} cx={x} cy={y} r={on ? 0 : 3} className="dr-city-dot"
                  onClick={() => revealed && setCity(c.id)} style={{ cursor: revealed ? "pointer" : "default" }}>
                  <title>{c.name}</title>
                </circle>
              );
            })}
            {resFar && (
              <motion.path key={`res-${scenarioKey}-${W}`} d={arc(vx, vy, rx, ry, 0.18)} className="dr-line-dns"
                initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeInOut" }} />
            )}
            {revealed && popFar && (
              <motion.path key={`pop-${scenarioKey}-${W}`} d={arc(vx, vy, px, py, -0.22)} className={`dr-line-pop tone-${tone}`}
                initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: reduced ? 0 : 0.35, ease: "easeInOut" }} />
            )}
            {/* resolver marker */}
            <g className="dr-resolver">
              <rect x={rx - 6} y={ry - 6} width={12} height={12} rx={3} transform={`rotate(45 ${rx} ${ry})`} />
            </g>
            {/* chosen PoP */}
            {revealed && (
              <motion.g key={`pk-${scenarioKey}`} initial={reduced ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: reduced ? 0 : popFar ? 1 : 0.2 }} style={{ transformOrigin: `${px}px ${py}px` }}>
                <circle cx={px} cy={py} r={13} className={`dr-pop-halo tone-${tone}`} />
                <circle cx={px} cy={py} r={6.5} className={`dr-pop-picked tone-${tone}`} />
              </motion.g>
            )}
            {/* viewer */}
            <circle cx={vx} cy={vy} r={6} className="dr-viewer" />
            <circle cx={vx} cy={vy} r={2.4} className="dr-viewer-core" />
            {/* labels */}
            <Tags tags={placeTags([
              { key: "you", x: vx, y: vy, text: `You, ${sc.city.short}`, tone: "is-you" },
              ...(revealed ? [{ key: "pop", x: px, y: py, text: `PoP ${sc.pop.id}`, tone: `is-pop tone-${tone}` }] : []),
              ...(resFar ? [{ key: "dns", x: rx, y: ry, text: `DNS ${sc.resolverAt.name}`, tone: "is-dns" }] : []),
            ], W, H, [[vx, vy], [rx, ry], [px, py]])} />
          </svg>
        )}
      </div>
      <div className="dr-legend" aria-hidden="true">
        <span><i className="dr-lg-you" />Viewer</span>
        <span><i className="dr-lg-dns" />Resolver</span>
        <span><i className="dr-lg-pop" />CDN PoP</span>
        <span><i className="dr-lg-line" />DNS query path</span>
      </div>
    </Stage>
  );

  const sees = kind === "isp"
    ? `query from 192.0.2.53\n  = ISP resolver in ${sc.city.name}\nECS: ${ecs ? "203.0.113.0/24" : "none"}\nlooks like: ${sc.city.name}`
    : ecs
      ? `query from 192.0.2.8\n  = public resolver site, ${sc.resolverAt.name}\nECS: 203.0.113.0/24 (${sc.city.name})\nlooks like: ${sc.city.name}\nreply scope: /20`
      : `query from 192.0.2.8\n  = public resolver site, ${sc.resolverAt.name}\nECS: none\nlooks like: ${sc.resolverAt.name}`;

  const controls = (
    <>
      <Segmented label="Viewer city" value={city} disabled={!revealed}
        options={CITIES.map((c) => ({ value: c.id, label: c.name }))} onChange={setCity} />
      <Segmented label="Resolver" value={kind} disabled={!revealed}
        options={[{ value: "isp", label: "ISP, nearby" }, { value: "public", label: "Public, far" }]} onChange={(v) => setKind(v as ResolverKind)} />
      <Toggle label="EDNS Client Subnet (ECS)" hint="Resolver passes your /24 prefix to the CDN's DNS" checked={ecs} disabled={!revealed} onChange={setEcs} />
      {!revealed && <div className="dr-muted dr-small">Answer the question first, then the controls unlock.</div>}
    </>
  );

  const result = revealed ? (
    <div className="dr-col">
      <div className="dr-stats3"><StatGrid>
        <Stat label="PoP chosen" value={sc.pop.id} sub={sc.pop.name} tone={sc.wrong ? "bad" : "good"} />
        <Stat label="RTT to PoP" value={sc.rtt} unit="ms" tone={tone === "good" ? "good" : tone === "warn" ? "warn" : "bad"} sub={`${fmtNum(Math.round(sc.km / 10) * 10)} km away`} />
        <Stat label="vs nearest PoP" value={sc.wrong ? `+${sc.rtt - sc.bestRtt}` : "best"} unit={sc.wrong ? "ms" : undefined} tone={sc.wrong ? "bad" : "good"} sub={sc.wrong ? `nearest is ${sc.best.id}` : "nearest PoP"} />
      </StatGrid></div>
      <div className="dr-two-tight">
        <div className="dr-rec-wrap"><div className="dr-rec-label">What the CDN's DNS sees</div><pre className="dr-rec">{sees}</pre></div>
        <div className="dr-explain">
          {sc.wrong
            ? <Callout type="mistake">The CDN's DNS sees the resolver, not you. Your resolver is in {sc.resolverAt.name}, so a viewer in {sc.city.name} gets the {sc.pop.name} PoP, and every 4-second segment travels about {fmtNum(Math.round(sc.km / 100) * 100)} km. Turn on ECS to fix it.</Callout>
            : kind === "public" && ecs
              ? <Callout type="industry">ECS fixed the mapping. The cost: the resolver now caches one answer per client subnet, so it asks the CDN's DNS much more often. Akamai saw about 8 times more queries for this traffic. Google Public DNS sends ECS; Cloudflare's 1.1.1.1 does not.</Callout>
              : <Callout type="staff">An ISP resolver sits near its users, so the resolver's location is a good guess for yours. ECS changes little here. Now try "Public, far".</Callout>}
        </div>
      </div>
    </div>
  ) : null;

  const predict = (
    <Predict
      q={<>A viewer in <b>Sao Paulo</b> uses a public resolver. For their ISP, the nearest resolver site is in <b>Miami</b> (assumed). The resolver sends <b>no ECS</b>. Which PoP does the CDN's DNS pick?</>}
      options={["Sao Paulo (GRU), next to the viewer", "Miami (MIA), next to the resolver", "Buenos Aires (EZE), a backup"]}
      answer={1}
      explain="The CDN's authoritative DNS only sees the IP address of the resolver that asked. That resolver is in Miami, so Miami looks closest."
      onReveal={() => setRevealed(true)} />
  );

  const note = <div className="dr-muted dr-small">RTT model (assumed): 8 ms last mile plus 1.6 ms per 100 km. Resolver sites and PoPs are a generic CDN, not any vendor's real map. Click a city dot to move the viewer.</div>;

  return (
    <div className="dr-sec">
      {predict}
      <WidgetFrame stage={map} controls={controls} footer={<div className="dr-col">{result}{note}</div>} />
    </div>
  );
}
