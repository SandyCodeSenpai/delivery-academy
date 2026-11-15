import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Slider, Stage, Stat, StatGrid, WidgetFrame } from "@/ui";
import { fmtNum, fmtPct } from "@/lib/format";
import { rng, useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import { CLASSES, DETECT_S, FLOOR_TTL, IGNORE_HOLD, TTL_STOPS, effTtl, fmtDur, fmtTtl, stillDead, timeBelow, totalDead, ttlXMax, type ClassId } from "./data";
import { Predict } from "./Predict";

type Phase = "idle" | "running" | "done";
const RUN_SECONDS = 5;

/** 100 sample clients: 85 honor TTL, 10 floor, 5 ignore. Each has a random expiry phase. */
function makeDots() {
  const r = rng(7);
  const cls: ClassId[] = [...Array(85).fill("honor"), ...Array(10).fill("floor"), ...Array(5).fill("ignore")];
  for (let i = cls.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cls[i], cls[j]] = [cls[j], cls[i]]; }
  return cls.map((c) => ({ cls: c, u: r() }));
}

function Chart({ W, ttl, t, phase, xMax }: { W: number; ttl: number; t: number; phase: Phase; xMax: number }) {
  const H = W < 480 ? 200 : 240, L = 42, R = 12, T = 36, B = 26;
  const sx = (x: number) => L + (x / xMax) * (W - L - R);
  const sy = (y: number) => T + (1 - y) * (H - T - B);
  const tEnd = phase === "idle" ? 0 : Math.min(t, xMax);
  const xs = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i <= 160; i++) set.add((xMax * i) / 160);
    for (const c of CLASSES) set.add(DETECT_S + effTtl(c.id, ttl));
    set.add(DETECT_S); set.add(DETECT_S - 0.001);
    return [...set].filter((x) => x <= xMax).sort((a, b) => a - b);
  }, [ttl, xMax]);
  const pts = xs.filter((x) => x <= tEnd);
  if (phase !== "idle" && (pts.length === 0 || pts[pts.length - 1] < tEnd)) pts.push(tEnd);
  // stacked layers: honor at the bottom, then floor, then ignore
  const layer = (k: number, x: number) => CLASSES.slice(0, k).reduce((s, c) => s + c.share * stillDead(c.id, ttl, x), 0);
  const area = (k: number) => {
    if (pts.length < 2) return "";
    const top = pts.map((x) => `${sx(x).toFixed(1)},${sy(layer(k + 1, x)).toFixed(1)}`);
    const bot = [...pts].reverse().map((x) => `${sx(x).toFixed(1)},${sy(layer(k, x)).toFixed(1)}`);
    return `M${top.join("L")}L${bot.join("L")}Z`;
  };
  const totalLine = pts.length >= 2 ? `M${pts.map((x) => `${sx(x).toFixed(1)},${sy(totalDead(ttl, x)).toFixed(1)}`).join("L")}` : "";
  const tickStep = [10, 20, 30, 60, 120, 300, 600, 900, 1200, 1800, 3600].find((st) => xMax / st <= (W < 480 ? 4 : 6)) ?? 3600;
  const xt: number[] = []; for (let v = 0; v <= xMax + 0.001; v += tickStep) xt.push(v);
  const mHonor = DETECT_S + ttl;
  const mk = [{ x: DETECT_S, label: "DNS changes" }, ...(mHonor < xMax ? [{ x: mHonor, label: "+ TTL" }] : [])];
  const close = mk.length > 1 && sx(mk[1].x) - sx(mk[0].x) < 100;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={phase === "idle" ? "Empty chart. Run the outage to plot the share of clients sent to the dead PoP." : `Share of clients still sent to the dead PoP. At ${fmtDur(tEnd)}: ${fmtPct(totalDead(ttl, tEnd))}.`}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="dr-grid" /><text x={L - 6} y={sy(v) + 4} textAnchor="end" className="dr-tick">{v * 100}%</text></g>
      ))}
      {xt.map((v, i) => <text key={i} x={sx(v)} y={H - 7} textAnchor={i === 0 ? "start" : sx(v) > W - R - 20 ? "end" : "middle"} className="dr-tick">{i === 0 ? "t = 0" : tickStep < 60 ? `${v} s` : v >= 3600 && v % 3600 === 0 ? `${v / 3600} h` : `${v / 60} min`}</text>)}
      {phase !== "idle" && mk.map((m, i) => {
        const x = sx(m.x), row = i === 1 && close ? 26 : 12;
        const flip = x > W - 100;
        return (
          <g key={m.label}>
            <line x1={x} x2={x} y1={row + 4} y2={H - B} className="dr-marker" />
            <text x={flip ? x - 5 : x + 5} y={row + 4} textAnchor={flip ? "end" : "start"} className="dr-tick dr-marker-t">{m.label}</text>
          </g>
        );
      })}
      {CLASSES.map((c, k) => <path key={c.id} d={area(k)} className="dr-area" style={{ fill: c.color }} />)}
      {totalLine && <path d={totalLine} className="dr-total" />}
      {phase !== "idle" && (
        <g>
          <line x1={sx(tEnd)} x2={sx(tEnd)} y1={T} y2={H - B} className="dr-playhead" />
          <circle cx={sx(tEnd)} cy={sy(totalDead(ttl, tEnd))} r={4.5} className="dr-playhead-dot" />
        </g>
      )}
      {phase === "idle" && <text x={(L + W - R) / 2} y={(T + H - B) / 2} textAnchor="middle" className="dr-empty">The PoP is healthy. Press the outage button.</text>}
    </svg>
  );
}

function Dots({ W, ttl, t, phase }: { W: number; ttl: number; t: number; phase: Phase }) {
  const dots = useMemo(makeDots, []);
  const cols = W < 480 ? 20 : 25;
  const cell = Math.min(26, (W - 4) / cols);
  const rows = Math.ceil(dots.length / cols);
  const H = rows * cell + 2;
  const r = Math.max(3.5, Math.min(7, cell / 2 - 2.5));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`100 sample clients. ${phase === "idle" ? "All on the healthy PoP." : `${dots.filter((d) => t < DETECT_S + d.u * effTtl(d.cls, ttl)).length} still sent to the dead PoP.`}`}>
      {dots.map((d, i) => {
        const cx = (i % cols) * cell + cell / 2 + 2, cy = Math.floor(i / cols) * cell + cell / 2 + 1;
        const switchAt = DETECT_S + d.u * effTtl(d.cls, ttl);
        const st = phase === "idle" ? "is-ok" : t < switchAt ? "is-dead" : "is-moved";
        if (d.cls === "honor") return <circle key={i} cx={cx} cy={cy} r={r} className={`dr-dot ${st}`} />;
        if (d.cls === "floor") return <rect key={i} x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={1.5} transform={`rotate(45 ${cx} ${cy})`} className={`dr-dot ${st}`} style={{ transformBox: "view-box" }} />;
        return <rect key={i} x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={2} className={`dr-dot ${st}`} />;
      })}
    </svg>
  );
}

export function TtlLab({ full, onRun }: { full: boolean; onRun: () => void }) {
  const [ti, setTi] = useState(2);
  const [phase, setPhase] = useState<Phase>("idle");
  const [t, setT] = useState(0);
  const [predicted, setPredicted] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const ttl = TTL_STOPS[ti];
  const xMax = ttlXMax(ttl);
  const firedRef = useRef(false);

  const tRef = useRef(0);
  tRef.current = t;
  useRaf((dt) => {
    const nt = tRef.current + (dt * xMax) / RUN_SECONDS;
    if (nt >= xMax) { setT(xMax); setPhase("done"); } else setT(nt);
  }, phase === "running");

  useEffect(() => { if (phase === "done" && !firedRef.current) { firedRef.current = true; onRun(); } }, [phase, onRun]);

  const start = () => {
    if (reduced) { setT(xMax); setPhase("done"); return; }
    setT(0); setPhase("running");
  };
  const reset = () => { setPhase("idle"); setT(0); };
  const changeTtl = (i: number) => { setTi(i); if (phase === "running") reset(); else if (phase === "done") setT(ttlXMax(TTL_STOPS[i])); };

  const now = phase === "idle" ? 0 : totalDead(ttl, t);
  const t90 = timeBelow(ttl, 0.1);
  const qph = 3600 / ttl;

  const stage = (
    <Stage>
      <div ref={ref} className="dr-measure">
        {W > 0 && <Chart W={W} ttl={ttl} t={t} phase={phase} xMax={xMax} />}
        <div className="dr-legend" aria-hidden="true">
          {CLASSES.map((c) => <span key={c.id}><i style={{ background: c.color, opacity: 0.55 }} />{c.label}</span>)}
        </div>
        <div className="dr-dots-head">
          <span className="dr-kicker">100 sample clients</span>
          <span className="dr-dots-key"><i className="dr-k-ok" />healthy PoP <i className="dr-k-dead" />sent to dead PoP <i className="dr-k-moved" />moved</span>
        </div>
        {W > 0 && <Dots W={W} ttl={ttl} t={t} phase={phase} />}
        <div className="dr-muted dr-small">Circle = honors TTL, diamond = 5-min floor, square = ignores TTL.</div>
      </div>
    </Stage>
  );

  const controls = (
    <>
      <Slider label="TTL on the CDN's A record" min={0} max={TTL_STOPS.length - 1} value={ti} onChange={changeTtl}
        format={(i) => fmtTtl(TTL_STOPS[i])} hint="How long resolvers may cache the answer" />
      <div className="dr-nav">
        <Button variant="danger" size="s" onClick={start} disabled={!predicted || phase === "running"}>
          <Icon name="bolt" size={15} /> {phase === "idle" ? "PoP outage at t = 0" : "Run again"}
        </Button>
        {phase !== "idle" && <Button size="s" variant="ghost" onClick={reset}><Icon name="reset" size={15} /> Reset</Button>}
      </div>
      {!predicted && <div className="dr-muted dr-small">Make a prediction first, then run the outage.</div>}
      {phase === "done" && (
        <Slider label="Time since outage" min={0} max={xMax} step={xMax / 200} value={t} onChange={setT} format={fmtDur} />
      )}
      <div className={full ? undefined : "dr-stats3"}><StatGrid>
        <Stat label={phase === "idle" ? "Sent to dead PoP" : `At ${fmtDur(t)}`} value={fmtPct(now)} tone={phase === "idle" ? "neutral" : now > 0.1 ? "bad" : now > 0.02 ? "warn" : "good"} sub="of new lookups" />
        <Stat label="90% moved after" value={fmtDur(t90)} sub={`detect ${DETECT_S} s + caches`} />
        <Stat label="DNS queries" value={fmtNum(qph, qph < 10 ? 1 : 0)} unit="/ h" sub="per resolver, per name" />
      </StatGrid></div>
    </>
  );

  const assumptions = (
    <details className="dr-assume" open={full}>
      <summary>Assumptions in this model</summary>
      <ul>
        <li>Health check every 10 s, 3 failures in a row: 30 s. Then about 10 s for the GSLB answer to change. So DNS stops handing out the dead PoP at {DETECT_S} s.</li>
        <li>85% of resolvers honor your TTL. 10% enforce a minimum TTL of {FLOOR_TTL / 60} minutes. 5% of resolvers and apps ignore TTL and keep answers about {IGNORE_HOLD / 3600} hours.</li>
        <li>Each resolver fetched its copy at a random moment, so expiries are spread evenly over one TTL.</li>
        <li>This counts new lookups only. A player already streaming keeps its open connection until it breaks.</li>
      </ul>
    </details>
  );

  return (
    <div className="dr-sec">
      <Predict
        q={<>The TTL is <b>60 s</b>. The PoP dies at t = 0. <b>Two minutes</b> later, what share of clients does DNS still send to the dead PoP?</>}
        options={["0%. Two full TTLs have passed.", "About 1 in 8", "About half"]}
        answer={1}
        explain={<>Detection takes about {DETECT_S} s, so TTL-honoring resolvers finish moving at 100 s. But resolvers with a 5-minute floor, and those that ignore TTL, still hold the old answer: about {fmtPct(totalDead(60, 120))} at 2 minutes. Run it and see.</>}
        onReveal={() => setPredicted(true)} />
      <WidgetFrame stage={stage} controls={controls} footer={assumptions} />
    </div>
  );
}
