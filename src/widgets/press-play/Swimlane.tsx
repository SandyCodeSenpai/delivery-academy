import { useId } from "react";
import { motion } from "framer-motion";
import { STEPS, type Plane } from "./model";

/** Lanes, left to right. Control plane in the middle, data plane on the right. */
const LANES = [
  { long: "Player", short: "Player" },
  { long: "Playback API", short: "API" },
  { long: "Steering", short: "Steer" },
  { long: "DRM license", short: "DRM" },
  { long: "CDN edge", short: "Edge" },
  { long: "Shield", short: "Shield" },
  { long: "Origin", short: "Origin" },
];
const P = 0, API = 1, STEER = 2, DRM = 3, EDGE = 4, SHIELD = 5, ORIGIN = 6;

const GUTTER = 30, TOP = 64, BAND = 42, REQ = 16, REP = 30;
export const swimlaneHeight = TOP + STEPS.length * BAND + 6;

interface Seg { from: number; to: number; y: "req" | "rep"; dashed?: boolean }

function segsFor(i: number, miss: boolean): Seg[] {
  switch (STEPS[i].id) {
    case "api": return [{ from: P, to: API, y: "req" }];
    case "steer": return [{ from: API, to: STEER, y: "req" }, { from: STEER, to: P, y: "rep", dashed: true }];
    case "manifest": return [{ from: P, to: EDGE, y: "req" }, { from: EDGE, to: P, y: "rep", dashed: true }];
    case "drm": return [{ from: P, to: DRM, y: "req" }, { from: DRM, to: P, y: "rep", dashed: true }];
    case "segments": {
      const end = miss ? ORIGIN : EDGE;
      return [{ from: P, to: end, y: "req" }, { from: end, to: P, y: "rep", dashed: true }];
    }
    default: return [];
  }
}

const planeClass = (p: Plane) => (p === "control" ? "pp-ctl" : p === "data" ? "pp-data" : "pp-player");

export function Swimlane(props: { width: number; pos: number; animKey: number; miss: boolean; reduced: boolean; durFor: (i: number) => number }) {
  const { width, pos, animKey, miss, reduced, durFor } = props;
  const uid = "pp" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = Math.max(300, width);
  const H = swimlaneHeight;
  const spacing = (W - GUTTER) / LANES.length;
  const wide = spacing >= 84;
  const lx = (i: number) => GUTTER + spacing * (i + 0.5);
  const half = spacing / 2;

  const group = (from: number, to: number, label: string, cls: string) => (
    <g className={cls}>
      <rect x={lx(from) - half + 3} y={2} width={lx(to) - lx(from) + spacing - 6} height={20} rx={10} className="pp-group-bg" />
      <text x={(lx(from) + lx(to)) / 2} y={16} textAnchor="middle" className="pp-group-text">{label}</text>
    </g>
  );

  return (
    <svg className={`pp-swim ${pos >= STEPS.length ? "pp-done" : ""}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Sequence of the six startup steps. ${pos} of 6 done.`}>
      {group(API, DRM, wide ? "Control plane · cloud" : "Control plane", "pp-ctl")}
      {group(EDGE, ORIGIN, wide ? "Data plane · CDN" : "Data plane", "pp-data")}

      {LANES.map((l, i) => (
        <g key={l.long}>
          <text x={lx(i)} y={44} textAnchor="middle" className="pp-lane-label">{wide ? l.long : l.short}</text>
          <line x1={lx(i)} x2={lx(i)} y1={52} y2={H - 4} className="pp-lifeline" />
        </g>
      ))}

      {STEPS.map((s, i) => {
        const top = TOP + i * BAND;
        const state = i < pos - 1 ? "past" : i === pos - 1 ? "current" : "ghost";
        const animate = state === "current" && !reduced;
        const segs = segsFor(i, s.id === "segments" && miss);
        const dur = durFor(i) / 1000;
        const yOf = (y: "req" | "rep") => top + (y === "req" ? REQ : REP);
        const lens = segs.map((g) => Math.abs(lx(g.to) - lx(g.from)));
        const total = lens.reduce((a, b) => a + b, 0) || 1;
        let acc = 0;
        const timing = lens.map((len) => { const d = { delay: (acc / total) * dur, duration: (len / total) * dur }; acc += len; return d; });
        const k = `${i}-${state === "current" ? animKey : "s"}`;
        const pc = planeClass(s.plane);

        return (
          <g key={k} className={`pp-step pp-${state} ${pc}`}>
            <circle cx={13} cy={top + 23} r={10} className="pp-num-bg" />
            <text x={13} y={top + 27} textAnchor="middle" className="pp-num">{i + 1}</text>

            {segs.map((g, j) => {
              const y = yOf(g.y);
              const dir = Math.sign(lx(g.to) - lx(g.from));
              const x0 = lx(g.from), x1 = lx(g.to) - dir * 6; // stop short of the node on the lifeline
              const d = `M${x0 + dir * 2},${y} H${x1 - dir * 6}`;
              const head = `M${x1},${y} L${x1 - dir * 7},${y - 4.5} L${x1 - dir * 7},${y + 4.5} Z`;
              const xa = Math.min(x0, x1) - 8, xb = Math.max(x0, x1) + 8;
              const cid = `${uid}-c${i}-${j}`;
              const body = (
                <>
                  <path d={d} className="pp-arrow" strokeDasharray={g.dashed ? "5 4" : undefined} />
                  <path d={head} className="pp-head" />
                </>
              );
              if (!animate) return <g key={j}>{body}</g>;
              // Wipe the arrow in with a growing clip rect, in the direction of travel. Keeps dashes intact.
              return (
                <g key={j}>
                  <clipPath id={cid}>
                    <motion.rect y={y - 8} height={16}
                      initial={{ attrX: dir > 0 ? xa : xb, width: 0 }} animate={{ attrX: xa, width: xb - xa }}
                      transition={{ ...timing[j], ease: "easeInOut" }} />
                  </clipPath>
                  <g clipPath={`url(#${cid})`}>{body}</g>
                </g>
              );
            })}

            {s.id === "api" && <circle cx={lx(API)} cy={yOf("req")} r={4} className="pp-node" />}
            {s.id === "steer" && <circle cx={lx(STEER)} cy={yOf("req")} r={4} className="pp-node" />}
            {s.id === "drm" && <circle cx={lx(DRM)} cy={yOf("req")} r={4} className="pp-node" />}
            {s.id === "manifest" && <CacheMark x={lx(EDGE)} y={yOf("req")} hit />}
            {s.id === "segments" && (miss ? (
              <>
                <CacheMark x={lx(EDGE)} y={yOf("req")} hit={false} />
                <CacheMark x={lx(SHIELD)} y={yOf("req")} hit={false} />
                <circle cx={lx(ORIGIN)} cy={yOf("req")} r={4} className="pp-node" />
              </>
            ) : <CacheMark x={lx(EDGE)} y={yOf("req")} hit />)}

            {s.id === "frame" && (
              <g>
                <rect x={lx(P) - 13} y={top + 14} width={26} height={17} rx={4} className="pp-screen" />
                {state !== "ghost" && <path d={`M${lx(P) - 3},${top + 18.5} L${lx(P) + 4},${top + 22.5} L${lx(P) - 3},${top + 26.5} Z`} className="pp-screen-play" />}
                {state === "current" && !reduced && (
                  <motion.rect x={lx(P) - 13} y={top + 14} width={26} height={17} rx={4} className="pp-screen-glow"
                    initial={{ opacity: 0.7, scale: 1 }} animate={{ opacity: 0, scale: 1.9 }}
                    transition={{ duration: 1.1, ease: "easeOut" }} />
                )}
                <text x={lx(P) + 20} y={top + 27} className="pp-frame-label">{state === "ghost" ? "first frame" : "First frame on screen"}</text>
              </g>
            )}

            {animate && segs.length > 0 && <Dot segs={segs} lx={lx} yOf={yOf} dur={dur} />}
          </g>
        );
      })}
    </svg>
  );
}

function CacheMark({ x, y, hit }: { x: number; y: number; hit: boolean }) {
  return (
    <g className={hit ? "pp-hit" : "pp-miss"}>
      <circle cx={x} cy={y} r={4.5} className="pp-cache-dot" />
      <text x={x} y={y - 7} textAnchor="middle" className="pp-cache-text">{hit ? "HIT" : "MISS"}</text>
    </g>
  );
}

function Dot({ segs, lx, yOf, dur }: { segs: Seg[]; lx: (i: number) => number; yOf: (y: "req" | "rep") => number; dur: number }) {
  const xs: number[] = [], ys: number[] = [], lens: number[] = [];
  segs.forEach((g, j) => {
    const a = { x: lx(g.from), y: yOf(g.y) }, b = { x: lx(g.to), y: yOf(g.y) };
    if (j === 0) { xs.push(a.x); ys.push(a.y); }
    else { const px = xs[xs.length - 1], py = ys[ys.length - 1]; lens.push(Math.hypot(a.x - px, a.y - py)); xs.push(a.x); ys.push(a.y); }
    lens.push(Math.abs(b.x - a.x)); xs.push(b.x); ys.push(b.y);
  });
  const total = lens.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  const times = [0, ...lens.map((l) => (acc += l) / total)];
  const op = times.map((_, i) => (i === times.length - 1 ? 0 : 1));
  return (
    <motion.circle r={5} className="pp-dot" initial={{ cx: xs[0], cy: ys[0], opacity: 0 }}
      animate={{ cx: xs, cy: ys, opacity: op }} transition={{ duration: dur, times, ease: "linear" }} />
  );
}
