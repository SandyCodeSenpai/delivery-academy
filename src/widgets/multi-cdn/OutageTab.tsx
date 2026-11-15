import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Chip, Icon, LineChart, Segmented, Stage, WidgetFrame } from "@/ui";
import { fmtNum } from "@/lib/format";
import { useRaf, useReducedMotion, useWidth, rng } from "@/lib/hooks";
import { METHODS, OUT, T_END, leftOnA, methodStats, seriesPoints, type MethodId } from "./model";
import { Predict, type PredictQ } from "./Predict";

const RUN_SECONDS = 9; // wall-clock length of the 10-minute replay

const WHY: Record<MethodId, { how: string; src: string }> = {
  dns: {
    how: "At minute 1 the steering DNS stops answering with CDN A. But resolvers cached the old answer for up to the 300 s TTL, and some resolvers and devices ignore TTLs, so a long tail keeps reaching A.",
    src: "Book: switch delays of 300 s to 15 min reported (SMPTE 2025). Share of resolvers that ignore TTL: assumed 30%.",
  },
  api: {
    how: "From minute 1 the playback API writes CDN B into every new manifest. Sessions already playing on A keep their VOD manifest, so a session only recovers when the viewer gives up and presses play again.",
    src: "Restart rate of stalled viewers: assumed 35% per minute.",
  },
  client: {
    how: "The player sees segment errors on A, retries, then fetches from B. No server needs to notice, so it is fast. But every session hits errors first, and players without failover code never move.",
    src: "6 to 24 s to give up on A: assumed. Players with failover logic: assumed 94%. Herding risk: all of them land on B at once.",
  },
  cs: {
    how: "At minute 1 the steering server puts CDN A last in PATHWAY-PRIORITY. Each player picks this up on its next reload, spread over one TTL. Players without Content Steering ignore it. This line shows only the server-driven move; the standard's player-side penalty rule works like player failover and is counted in the combination.",
    src: "Book: TTL 300 s is the recommended value (Apple spec); 60 s during an incident costs ~5x more requests. Players with support: assumed 85%.",
  },
  combo: {
    how: "Player failover catches the first seconds. Content Steering and the playback API then hold the new order with business rules, and DNS is a coarse backstop for old devices. This is the design the book recommends (9.14).",
    src: "Uses the same assumptions as the four lines above, applied per device class.",
  },
};

const QUESTIONS: PredictQ[] = [
  {
    id: "dns",
    prompt: <>The steering DNS uses a 300 s TTL. After it stops answering with CDN A, how long until 90% of the failing LatAm sessions have moved?</>,
    options: ["About 1 minute", "About 5 minutes, one TTL", "Longer than 5 minutes: the tail runs past the TTL"],
    answer: 2,
    explain: <>Resolvers and devices cache answers, and some ignore low TTLs. The SMPTE 2025 paper reports DNS switch delays from 300 s up to 15 min. A 300 s TTL does not mean 300 s failover. Press the button and watch the orange line.</>,
  },
  {
    id: "ttl",
    prompt: <>You cut the Content Steering TTL from 300 s to 60 s so players move faster. What does that cost at a 2M-viewer premiere?</>,
    options: ["Each reload makes the player rebuffer", "About 5x more steering requests: ~6,700/s becomes ~33,000/s", "Nothing, reloads are free"],
    answer: 1,
    explain: <>Every player reloads once per TTL: 2M / 300 s is about 6,700 requests per second, and 2M / 60 s is about 33,000 (9.9.2). Reloads do not interrupt playback, but the steering endpoint must be sized for it. Switch the TTL and compare the teal line.</>,
  },
];

const fmtMin = (m: number | null) => (m === null ? "> 10 min" : m < 1 ? `${fmtNum(m * 60)} s` : `${fmtNum(m, 1)} min`);
const clock = (m: number) => `${Math.floor(m)}:${String(Math.floor((m % 1) * 60)).padStart(2, "0")}`;

export default function OutageTab({ onTrigger }: { onTrigger: () => void }) {
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [ttl, setTtl] = useState<60 | 300>(300);
  const [focus, setFocus] = useState<MethodId>("dns");
  const reduce = useReducedMotion();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartPx = useWidth(chartRef);

  const tRef = useRef(0);
  useRaf((dt) => {
    const n = Math.min(T_END, tRef.current + (dt * T_END) / RUN_SECONDS);
    tRef.current = n;
    setT(n);
    if (n >= T_END) setRunning(false);
  }, running);

  const trigger = () => {
    onTrigger();
    setStarted(true);
    if (reduce) { tRef.current = T_END; setT(T_END); setRunning(false); } else { tRef.current = 0; setT(0); setRunning(true); }
  };
  const reset = () => { setRunning(false); setStarted(false); tRef.current = 0; setT(0); };
  const finished = started && t >= T_END;

  const stats = useMemo(() => Object.fromEntries(METHODS.map((m) => [m.id, methodStats(m.id, ttl)])) as Record<MethodId, ReturnType<typeof methodStats>>, [ttl]);
  const series = useMemo(() => {
    const order = [...METHODS.filter((m) => m.id !== focus), ...METHODS.filter((m) => m.id === focus)];
    return order.map((m) => ({
      id: m.id, label: m.short,
      color: m.id === focus ? m.color : `color-mix(in srgb, ${m.color} 38%, transparent)`,
      points: started ? seriesPoints(m.id, ttl, t) : [],
      area: m.id === focus,
    }));
  }, [focus, started, t, ttl]);


  const stage = (
    <Stage className="mcdn-stage">
      <div className="mcdn-out-head">
        <div>
          <div className="mcdn-ctl-title">LatAm sessions failing</div>
          <div className="mcdn-muted">Minutes after the failure. CDN A carries {fmtNum(OUT.aShare * 100)}% of LatAm sessions before it <Chip>assumed</Chip></div>
        </div>
      </div>
      <div className="mcdn-run">
        <Button variant={started ? "secondary" : "danger"} onClick={trigger} disabled={running}>
          <Icon name={started ? "reset" : "bolt"} size={17} />{started ? "Replay the outage" : "CDN A fails in LatAm at t=0"}
        </Button>
        {started && !running && <Button size="s" variant="ghost" onClick={reset}>Clear</Button>}
        <div className={`mcdn-clock${started ? " is-on" : ""}`} aria-label={`Time after failure ${clock(started ? t : 0)}`}>
          <span>t =</span> {clock(started ? t : 0)}
        </div>
      </div>
      <div ref={chartRef} className="mcdn-chart">
        <LineChart series={series} xMin={0} xMax={T_END} yMin={0} yMax={48} height={chartPx && chartPx < 480 ? 220 : 240}
          xFmt={clock} yFmt={(v) => `${Math.round(v)}%`}
          markers={[{ x: OUT.detect, label: "steering acts" }]} />
        {!started && <div className="mcdn-chart-empty">Nothing has failed yet. All sessions are playing.</div>}
      </div>
      <Sessions method={focus} t={started ? t : -1} ttl={ttl} />
    </Stage>
  );

  const controls = (
    <>
      <Segmented label="Content Steering TTL" value={ttl} onChange={(v) => setTtl(v)} options={[{ value: 60, label: "60 s" }, { value: 300, label: "300 s" }]} />
      <div className="mcdn-ctl-note">Detection: the steering system acts at minute 1, after two bad 30 s intervals <Chip>assumed</Chip></div>
    </>
  );

  const footer = (
    <div className="mcdn-foot">
      <div className="mcdn-methods" role="list" aria-label="Steering methods. Select one to highlight it.">
        <div className="mcdn-mrow mcdn-mhead" aria-hidden="true">
          <span>Method</span><span>90% moved</span><span>At 10 min</span><span>Lost min / 1k</span>
        </div>
        {METHODS.map((m) => {
          const s = stats[m.id];
          const show = finished;
          return (
            <button key={m.id} type="button" role="listitem" className={`mcdn-mrow${focus === m.id ? " is-focus" : ""}`} aria-pressed={focus === m.id}
              onClick={() => setFocus(m.id)} style={{ "--c": m.color } as CSSProperties}>
              <span className="mcdn-mname"><i />{m.label}</span>
              <span className="mcdn-mval" data-label="90% moved">{show ? fmtMin(s.drain90) : "—"}</span>
              <span className="mcdn-mval" data-label="At 10 min">{show ? `${fmtNum(leftOnA(m.id, T_END, ttl) * OUT.aShare * 100, 1)}%` : "—"}</span>
              <span className="mcdn-mval" data-label="Lost min / 1k">{show ? fmtNum(s.lostMin) : "—"}</span>
            </button>
          );
        })}
      </div>
      <div className="mcdn-why" style={{ "--c": METHODS.find((m) => m.id === focus)!.color } as CSSProperties} aria-live="polite">
        <div className="mcdn-why-title">{METHODS.find((m) => m.id === focus)!.label}</div>
        <p>{WHY[focus].how}</p>
        <p className="mcdn-muted">{WHY[focus].src}</p>
      </div>
      <p className="mcdn-note">"Lost min / 1k" = minutes of failed playback per 1,000 LatAm sessions over the 10 minutes. "90% moved" counts from the failure, as in a drill's time-to-drain (9.12).</p>
    </div>
  );

  return (
    <div className="mcdn-tab">
      <Predict questions={QUESTIONS} />
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}

/** 100 LatAm sessions as dots. Red = on CDN A and failing, green = moved off A, grey = playing on B or C all along. */
function Sessions({ method, t, ttl }: { method: MethodId; t: number; ttl: number }) {
  // Stratified ranks: dot k fails while (its rank) < share still on A, so the dot count matches the line exactly.
  const ranks = useMemo(() => {
    const r = rng(9); const a = Array.from({ length: 40 }, (_, k) => (k + 0.5) / 40);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }, []);
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const cols = w && w < 420 ? 20 : 25;
  const rows = 100 / cols;
  const cell = 14, gap = 5, W = cols * (cell + gap) - gap, H = rows * (cell + gap) - gap;
  const left = t < 0 ? 1 : leftOnA(method, t, ttl);
  // Positions on A are spread across the grid so it reads like a real mix of sessions.
  const onA = useMemo(() => {
    const r = rng(4); const idx = Array.from({ length: 100 }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return new Map(idx.slice(0, 40).map((v, k) => [v, k]));
  }, []);
  let failing = 0, moved = 0;
  const dots = Array.from({ length: 100 }, (_, i) => {
    const k = onA.get(i);
    let state = "other";
    if (k !== undefined) {
      if (t < 0) state = "a";
      else if (ranks[k] < left) { state = "fail"; failing++; } else { state = "moved"; moved++; }
    }
    return <rect key={i} x={(i % cols) * (cell + gap)} y={Math.floor(i / cols) * (cell + gap)} width={cell} height={cell} rx={cell / 2} className={`mcdn-sdot s-${state}`} />;
  });
  return (
    <div ref={ref} className="mcdn-sessions">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t < 0 ? "100 sessions, all playing" : `${failing} of 100 sessions failing, ${moved} moved off CDN A`}>{dots}</svg>
      <div className="mcdn-skey">
        <span className="mcdn-skey-title">{METHODS.find((m) => m.id === method)!.short}, 100 sessions</span>
        <span><i className="s-fail" />failing on A{t >= 0 ? `: ${failing}` : ""}</span>
        <span><i className="s-moved" />moved off A{t >= 0 ? `: ${moved}` : ""}</span>
        <span><i className="s-other" />on B or C</span>
        {t < 0 && <span><i className="s-a" />on A</span>}
      </div>
    </div>
  );
}
