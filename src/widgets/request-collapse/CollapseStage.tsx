import { useEffect, useMemo, useRef, useState } from "react";
import { useRaf, useWidth } from "@/lib/hooks";
import { fmtNum, clamp } from "@/lib/format";
import { DT, NT, ORIGIN_RATE, type Config, type Result } from "./sim";

export type Phase = "idle" | "running" | "done";

export const fmtShort = (n: number) => {
  const v = Math.round(n);
  if (v < 1000) return String(v);
  if (v < 10000) return `${fmtNum(v / 1000, 1)}k`;
  if (v < 1e6) return `${fmtNum(v / 1000, 0)}k`;
  return `${fmtNum(v / 1e6, 1)}M`;
};

/* ---------- particle pool (structure of arrays, ring buffer) ---------- */
const MAXP = 2400;
const K_REQ = 0, K_UP = 1, K_OK = 2, K_ERR = 3, K_SERVED = 4, K_SERVED_ERR = 5, K_ONE = 6;
const COLOR_VARS = ["--p3", "--p3", "--good", "--bad", "--good", "--bad", "--p3"];
const RADIUS = [1.7, 2.8, 2.6, 2.6, 1.5, 1.5, 3.4];
const ALPHA = [0.55, 0.95, 0.95, 0.95, 0.4, 0.45, 1];

interface Pool { x0: Float32Array; y0: Float32Array; x1: Float32Array; y1: Float32Array; t0: Float32Array; dur: Float32Array; bend: Float32Array; kind: Uint8Array; n: number }
const makePool = (): Pool => ({ x0: new Float32Array(MAXP), y0: new Float32Array(MAXP), x1: new Float32Array(MAXP), y1: new Float32Array(MAXP), t0: new Float32Array(MAXP).fill(-99), dur: new Float32Array(MAXP), bend: new Float32Array(MAXP), kind: new Uint8Array(MAXP), n: 0 });

interface Layout { w: number; h: number; narrow: boolean; popX: number; popYs: number[]; popR: number; vx0: number; vx1: number; vy0: number; vy1: number; shieldX: number; shieldY: number; originX: number; originY: number; originW: number; originH: number }

function layout(w: number, P: number): Layout {
  const narrow = w < 480;
  const h = narrow ? Math.max(240, P * 22 + 76) : Math.max(270, P * 25 + 84);
  const top = 46, bottom = h - 16;
  const popYs = Array.from({ length: P }, (_, i) => (P === 1 ? (top + bottom) / 2 : top + ((bottom - top) * i) / (P - 1)));
  const originW = narrow ? 34 : 44, originH = narrow ? 76 : 96;
  return {
    w, h, narrow, popYs, popR: narrow ? 8 : 10,
    vx0: 10, vx1: w * (narrow ? 0.17 : 0.19), vy0: top - 6, vy1: bottom + 6,
    popX: w * (narrow ? 0.42 : 0.44),
    shieldX: w * (narrow ? 0.68 : 0.7), shieldY: (top + bottom) / 2,
    originX: w - originW / 2 - (narrow ? 6 : 26), originY: (top + bottom) / 2, originW, originH,
  };
}

export default function CollapseStage({ cfg, result, phase, reduced, skip, onFinished }: {
  cfg: Config; result: Result | null; phase: Phase; reduced: boolean; skip: number; onFinished: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = useWidth(wrapRef);
  const w = Math.max(280, width || 600);
  const L = useMemo(() => layout(w, cfg.pops), [w, cfg.pops]);

  const [simT, setSimT] = useState(0);
  const simRef = useRef(0);
  const realRef = useRef(0);
  const warpRef = useRef(1);
  const poolRef = useRef<Pool>(makePool());
  const colorsRef = useRef<string[]>([]);
  const colorAge = useRef(99);
  const seed = useRef(1);
  const rand = () => { seed.current = (seed.current * 1664525 + 1013904223) >>> 0; return seed.current / 4294967296; };

  const endT = result?.endT ?? 0;
  const displayDur = clamp(endT * 1.4, 4.5, 9);
  const speed = endT > 0 ? endT / displayDur : 1; // sim seconds per real second

  // reset on new run / idle
  useEffect(() => {
    simRef.current = phase === "done" && result ? result.endT : 0;
    realRef.current = 0;
    poolRef.current = makePool();
    setSimT(simRef.current);
    clearCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, phase === "idle"]);

  // skip to the end
  useEffect(() => {
    if (!skip || !result) return;
    simRef.current = result.endT; setSimT(result.endT); poolRef.current = makePool(); clearCanvas(); onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  // canvas size
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(L.w * dpr); c.height = Math.round(L.h * dpr);
    c.style.width = `${L.w}px`; c.style.height = `${L.h}px`;
    const ctx = c.getContext("2d"); ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [L.w, L.h]);

  function clearCanvas() { const c = canvasRef.current; const ctx = c?.getContext("2d"); if (c && ctx) ctx.clearRect(0, 0, c.width, c.height); }

  function spawn(kind: number, x0: number, y0: number, x1: number, y1: number, t0: number, dur: number) {
    const P = poolRef.current, i = P.n; P.n = (P.n + 1) % MAXP;
    P.x0[i] = x0; P.y0[i] = y0; P.x1[i] = x1; P.y1[i] = y1; P.t0[i] = t0; P.dur[i] = dur; P.kind[i] = kind; P.bend[i] = (rand() - 0.5) * 10;
  }
  const sround = (x: number) => { const f = Math.floor(x); return f + (rand() < x - f ? 1 : 0); };

  const running = phase === "running" && !!result && !reduced;
  useRaf((rawDt) => {
    if (!result) return;
    const dt = Math.max(0, rawDt); // the first frame can report a slightly negative dt
    const rec = result.rec, N = result.cfg.burst;
    const real = (realRef.current += dt);
    const s0 = simRef.current;
    // slow motion at T0, where the herd forms; normal pace afterwards
    const warp = clamp(0.3 + s0 / 1.5, 0.3, 1), v = speed * warp;
    warpRef.current = v;
    const s1 = Math.min(result.endT + 0.6 * speed, s0 + dt * v);
    simRef.current = s1;
    // particle scale: ~14 viewer particles per 10 ms tick at the peak of the burst
    const sV = Math.min(1, 14 / (N * 0.0092));
    const i0 = Math.floor(s0 / DT), i1 = Math.min(NT, Math.floor(s1 / DT));
    const upX = cfg.shield ? L.shieldX - 22 : L.originX - L.originW / 2;
    const upY = (i: number) => (cfg.shield ? L.shieldY + (i % 5 - 2) * 3 : L.originY + (rand() - 0.5) * L.originH * 0.7);
    for (let i = i0; i < i1; i++) {
      const tReal = real - (s1 - i * DT) / v;
      for (let p = 0; p < cfg.pops; p++) {
        const py = L.popYs[p], px = L.popX;
        const a = sround(rec.arrivals[p][i] * sV);
        for (let j = 0; j < a; j++) spawn(K_REQ, L.vx0 + rand() * (L.vx1 - L.vx0), L.vy0 + rand() * (L.vy1 - L.vy0), px - L.popR, py, tReal, 0.55);
        const u = rec.edgeUp[p][i];
        if (u > 0) { const n = Math.max(1, sround(u * sV)); for (let j = 0; j < n; j++) spawn(u === 1 ? K_ONE : K_UP, px + L.popR, py, upX, upY(p), tReal, 0.5); }
        const b = rec.edgeBack[p][i], be = rec.edgeBackErr[p][i];
        if (b > 0) { const n = Math.max(1, sround(b * sV)); for (let j = 0; j < n; j++) spawn(K_OK, upX, upY(p), px + L.popR, py, tReal, 0.45); }
        if (be > 0) { const n = Math.max(1, sround(be * sV)); for (let j = 0; j < n; j++) spawn(K_ERR, upX, upY(p), px + L.popR, py, tReal, 0.45); }
        const sv = sround(rec.served[p][i] * sV * 0.6), se = sround(rec.servedErr[p][i] * sV * 0.6);
        for (let j = 0; j < sv; j++) spawn(K_SERVED, px - L.popR, py, L.vx0 + rand() * (L.vx1 - L.vx0), L.vy0 + rand() * (L.vy1 - L.vy0), tReal, 0.5);
        for (let j = 0; j < se; j++) spawn(K_SERVED_ERR, px - L.popR, py, L.vx0 + rand() * (L.vx1 - L.vx0), L.vy0 + rand() * (L.vy1 - L.vy0), tReal, 0.5);
      }
      if (cfg.shield) {
        const ox = L.originX - L.originW / 2, sx = L.shieldX + 22;
        const u = rec.shieldUp[i];
        if (u > 0) { const n = Math.max(1, sround(u * sV)); for (let j = 0; j < n; j++) spawn(u === 1 ? K_ONE : K_UP, sx, L.shieldY, ox, L.originY + (rand() - 0.5) * L.originH * 0.6, tReal, 0.4); }
        const b = rec.shieldBack[i], be = rec.shieldBackErr[i];
        if (b > 0) { const n = Math.max(1, sround(b * sV)); for (let j = 0; j < n; j++) spawn(K_OK, ox, L.originY, sx, L.shieldY, tReal, 0.4); }
        if (be > 0) { const n = Math.max(1, sround(be * sV)); for (let j = 0; j < n; j++) spawn(K_ERR, ox, L.originY, sx, L.shieldY, tReal, 0.4); }
      }
    }
    draw(real);
    setSimT(Math.min(s1, result.endT));
    if (s1 >= result.endT + 0.6 * speed) { clearCanvas(); onFinished(); }
  }, running);

  function draw(now: number) {
    const c = canvasRef.current, ctx = c?.getContext("2d"); if (!c || !ctx) return;
    if (colorAge.current++ > 30 || !colorsRef.current.length) {
      const cs = getComputedStyle(c); colorsRef.current = COLOR_VARS.map((v) => cs.getPropertyValue(v).trim() || "#888"); colorAge.current = 0;
    }
    ctx.clearRect(0, 0, L.w, L.h);
    const P = poolRef.current;
    for (let k = 0; k <= K_ONE; k++) {
      ctx.fillStyle = colorsRef.current[k]; ctx.globalAlpha = ALPHA[k];
      ctx.beginPath();
      const r = RADIUS[k];
      for (let i = 0; i < MAXP; i++) {
        if (P.kind[i] !== k) continue;
        const q = (now - P.t0[i]) / P.dur[i];
        if (q < 0 || q > 1) continue;
        const e = q * q * (3 - 2 * q);
        const dx = P.x1[i] - P.x0[i], dy = P.y1[i] - P.y0[i], len = Math.hypot(dx, dy) || 1;
        const bow = Math.sin(Math.PI * e) * P.bend[i];
        const x = P.x0[i] + dx * e - (dy / len) * bow, y = P.y0[i] + dy * e + (dx / len) * bow;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      if (k === K_ONE) { // halo: the single collapsed request
        ctx.globalAlpha = 0.18; ctx.beginPath();
        for (let i = 0; i < MAXP; i++) {
          if (P.kind[i] !== k) continue;
          const q = (now - P.t0[i]) / P.dur[i]; if (q < 0 || q > 1) continue;
          const e = q * q * (3 - 2 * q);
          const x = P.x0[i] + (P.x1[i] - P.x0[i]) * e, y = P.y0[i] + (P.y1[i] - P.y0[i]) * e;
          ctx.moveTo(x + 8, y); ctx.arc(x, y, 8, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- live values for the SVG ---------- */
  const ti = clamp(Math.floor(simT / DT), 0, NT - 1);
  const rec = result?.rec;
  const live = phase !== "idle" && !!rec;
  const waiting = cfg.pops ? Array.from({ length: cfg.pops }, (_, p) => (live && rec ? Math.max(0, rec.waiting[p]?.[ti] ?? 0) : 0)) : [];
  const ups = Array.from({ length: cfg.pops }, (_, p) => (live && rec ? rec.upCum[p]?.[ti] ?? 0 : 0));
  const cached = Array.from({ length: cfg.pops }, (_, p) => live && rec ? simT >= (rec.cachedAt[p] ?? Infinity) : false);
  const shieldCached = live && rec ? simT >= rec.shieldCachedAt : false;
  const rps = live && rec ? rec.originRps[ti] : 0;
  const originTotal = live && rec ? rec.originCum[ti] : 0;
  const totalWaiting = waiting.reduce((a, b) => a + b, 0);
  const load = Math.min(1, rps / ORIGIN_RATE);
  const over = rps > ORIGIN_RATE;

  const viewerDots = useMemo(() => {
    let s = 3; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = L.narrow ? 46 : 70;
    return Array.from({ length: n }, () => [L.vx0 + 4 + r() * (L.vx1 - L.vx0 - 8), L.vy0 + 6 + r() * (L.vy1 - L.vy0 - 12)] as const);
  }, [L]);

  const upTargetX = cfg.shield ? L.shieldX - 22 : L.originX - L.originW / 2;
  const upTargetY = cfg.shield ? L.shieldY : L.originY;
  const status = phase === "idle"
    ? "Cold caches: segment 1 is in no PoP yet."
    : phase === "running"
      ? `${fmtShort(totalWaiting)} viewers waiting · ${fmtShort(originTotal)} request${Math.round(originTotal) === 1 ? "" : "s"} at origin`
      : `${fmtNum(result?.originRequests ?? 0)} request${result?.originRequests === 1 ? "" : "s"} reached the origin.`;

  return (
    <div className="rc-stage" ref={wrapRef}>
      <div className="rc-stage-canvas" style={{ height: L.h }}>
        <svg viewBox={`0 0 ${L.w} ${L.h}`} width={L.w} height={L.h} role="img"
          aria-label={`Request flow: viewers, ${cfg.pops} edge PoPs${cfg.shield ? ", a shield" : ""}, and the origin. ${status}`}>
          {/* column headers */}
          <g className="rc-colhead">
            <text x={(L.vx0 + L.vx1) / 2} y={20} textAnchor="middle">Viewers</text>
            <text x={L.popX} y={20} textAnchor="middle">Edge PoPs</text>
            <text x={L.shieldX} y={20} textAnchor="middle" className={cfg.shield ? "" : "rc-off"}>{cfg.shield ? "Shield" : "No shield"}</text>
            <text x={L.originX + (L.narrow ? -2 : 0)} y={20} textAnchor="middle">Origin</text>
          </g>
          {/* links */}
          <g className="rc-links">
            {L.popYs.map((y, p) => <line key={`v${p}`} x1={L.vx1} y1={(L.vy0 + L.vy1) / 2 + (y - (L.vy0 + L.vy1) / 2) * 0.55} x2={L.popX - L.popR} y2={y} className="rc-link-faint" />)}
            {L.popYs.map((y, p) => <line key={`u${p}`} x1={L.popX + L.popR} y1={y} x2={upTargetX} y2={upTargetY} />)}
            {cfg.shield && <line x1={L.shieldX + 22} y1={L.shieldY} x2={L.originX - L.originW / 2} y2={L.originY} />}
          </g>
          {/* viewers */}
          <g className="rc-viewers">{viewerDots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} />)}</g>
          {/* PoPs */}
          {L.popYs.map((y, p) => {
            const wt = waiting[p], halo = wt > 0.5 ? L.popR + 3 + 7 * Math.min(1, Math.log10(wt + 1) / 4.5) : 0;
            return (
              <g key={p} className={`rc-pop ${cached[p] ? "is-cached" : ""} ${wt > 0.5 ? "is-waiting" : ""}`}>
                {halo > 0 && <circle cx={L.popX} cy={y} r={halo} className="rc-halo" />}
                <circle cx={L.popX} cy={y} r={L.popR} className="rc-pop-node" />
                {cached[p] && <path d={`M${L.popX - 3.5} ${y + 0.2} l2.4 2.4 l4.6 -4.8`} className="rc-check" />}
                {ups[p] > 0 && <text x={L.popX + L.popR + (halo ? halo - L.popR + 3 : 5)} y={y - 3} className="rc-up">{fmtShort(ups[p])}↑</text>}
              </g>
            );
          })}
          {/* shield */}
          <g className={`rc-shield ${cfg.shield ? "" : "is-off"} ${shieldCached ? "is-cached" : ""}`}>
            <rect x={L.shieldX - 22} y={L.shieldY - 18} width={44} height={36} rx={10} />
            <path d={`M${L.shieldX} ${L.shieldY - 9} l7 3 v5 c0 4 -3 7 -7 8 c-4 -1 -7 -4 -7 -8 v-5 z`} className="rc-shield-icon" />
          </g>
          {/* origin */}
          <g className={`rc-origin ${over ? "is-over" : ""}`}>
            <rect x={L.originX - L.originW / 2} y={L.originY - L.originH / 2} width={L.originW} height={L.originH} rx={10} className="rc-origin-box" />
            <rect x={L.originX - L.originW / 2 + 6} width={L.originW - 12} rx={4}
              y={L.originY + L.originH / 2 - 6 - (L.originH - 12) * load} height={(L.originH - 12) * load} className="rc-origin-meter" />
            <text x={L.originX} y={L.originY + L.originH / 2 + 16} textAnchor="middle" className="rc-origin-num">{fmtShort(originTotal)}</text>
            <text x={L.originX} y={L.originY + L.originH / 2 + 30} textAnchor="middle" className="rc-origin-sub">{L.narrow ? "reqs" : "requests"}</text>
            <text x={L.originX} y={L.originY - L.originH / 2 - 8} textAnchor="middle" className={`rc-origin-sub ${over ? "rc-bad" : ""}`}>{rps > 0 ? `${fmtShort(rps)}/s` : ""}</text>
          </g>
        </svg>
        <canvas ref={canvasRef} className="rc-canvas" aria-hidden="true" />
      </div>
      <div className="rc-stage-foot">
        <span className="rc-status" aria-live="polite">{status}</span>
        <span className="rc-clock">t = {fmtNum(simT, 2)} s{phase === "running" && warpRef.current < 0.95 ? ` · ${fmtNum(warpRef.current, 1)}x` : ""}</span>
      </div>
    </div>
  );
}
