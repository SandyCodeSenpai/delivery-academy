import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, Chip, Icon, Segmented, Stage, Stat, StatGrid, WidgetFrame } from "@/ui";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { CACHE, HOST, NODE_LABEL, SERVERS, STEPS, STUB_MS, SERVER_MS, laterLookup, type NodeId } from "./data";
import { Predict } from "./Predict";

interface Box { x: number; y: number; w: number; h: number }

function layout(W: number) {
  const Wc = Math.min(W, 720), ox = Math.max(0, (W - Wc) / 2);
  const narrow = Wc < 540;
  const rowH = 46, gap = narrow ? 10 : 14, top = 4;
  const rowY = (i: number) => top + i * (rowH + gap);
  const sw = narrow ? Math.round(Wc * 0.42) : Math.min(250, Math.round(Wc * 0.38));
  const sx = Wc - sw - 2;
  const pw = narrow ? Math.min(98, Math.round(Wc * 0.27)) : 124;
  const rw = narrow ? 96 : 140;
  const rx = sx - (narrow ? 28 : 64) - rw;
  const boxes: Record<NodeId, Box> = {
    player: { x: 2, y: rowY(0), w: pw, h: rowH },
    resolver: { x: rx, y: rowY(2), w: rw, h: rowH },
    pop: { x: 2, y: rowY(4), w: pw, h: rowH },
    root: { x: sx, y: rowY(0), w: sw, h: rowH },
    tldcom: { x: sx, y: rowY(1), w: sw, h: rowH },
    cfdns: { x: sx, y: rowY(2), w: sw, h: rowH },
    tldnet: { x: sx, y: rowY(3), w: sw, h: rowH },
    gslb: { x: sx, y: rowY(4), w: sw, h: rowH },
  };
  for (const b of Object.values(boxes)) b.x += ox;
  return { boxes, H: rowY(5) - gap + top + 2 };
}

/** Endpoints of the edge between two nodes. */
function edge(b: Record<NodeId, Box>, a: NodeId, c: NodeId): [number, number, number, number] {
  const A = b[a], C = b[c];
  if ((a === "player" && c === "resolver") || (a === "resolver" && c === "player")) {
    const p: [number, number] = [b.player.x + b.player.w, b.player.y + b.player.h / 2];
    const r: [number, number] = [b.resolver.x + b.resolver.w / 2, b.resolver.y];
    return a === "player" ? [p[0], p[1], r[0], r[1]] : [r[0], r[1], p[0], p[1]];
  }
  if (a === "player" && c === "pop") return [A.x + A.w / 2, A.y + A.h, C.x + C.w / 2, C.y];
  return [A.x + A.w, A.y + A.h / 2, C.x, C.y + C.h / 2];
}

const LATER = [
  { value: 10, label: "+10 s" },
  { value: 90, label: "+90 s" },
  { value: 600, label: "+10 min" },
  { value: 259200, label: "+3 days" },
];
const r1 = (v: number) => Math.round(v * 10) / 10;
const ttlText = (s: number) => (s >= 86400 ? `${r1(s / 86400)} d` : s >= 3600 ? `${r1(s / 3600)} h` : s >= 60 ? `${r1(s / 60)} min` : `${Math.round(s)} s`);
const cumMs = (i: number) => STEPS.slice(0, i + 1).reduce((s, x) => s + x.addMs, 0);

export function Walkthrough({ full, onFinished }: { full: boolean; onFinished: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [later, setLater] = useState(90);
  const [laterOpen, setLaterOpen] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const last = STEPS.length - 1;
  const s = STEPS[step];
  const finishedRef = useRef(false);

  useEffect(() => {
    if (step === last && !finishedRef.current) { finishedRef.current = true; onFinished(); }
  }, [step, last, onFinished]);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((x) => Math.min(last, x + 1)), reduced ? 1400 : 1900);
    return () => clearTimeout(id);
  }, [playing, step, last, reduced]);

  const go = (i: number) => { setPlaying(false); setStep(Math.max(0, Math.min(last, i))); };
  const visited = new Set<NodeId>(STEPS.slice(0, step).filter((x) => x.kind === "round").map((x) => x.to));
  const cached = CACHE.filter((c) => STEPS.slice(0, step + 1).some((x) => x.caches === c.id));
  const queries = STEPS.slice(0, step + 1).filter((x) => x.kind === "round").length;
  const total = cumMs(step);

  const L = W > 0 ? layout(W) : null;
  const nodes: NodeId[] = ["player", "resolver", ...SERVERS, "pop"];

  const stage = (
    <Stage>
      <div ref={ref} className="dr-measure">
        {L && (
          <svg width={W} height={L.H} viewBox={`0 0 ${W} ${L.H}`} role="img"
            aria-label={`DNS lookup diagram. Step ${step + 1} of ${STEPS.length}: ${s.title}.`}>
            {SERVERS.map((n) => {
              const [x1, y1, x2, y2] = edge(L.boxes, "resolver", n);
              const on = s.to === n;
              return <line key={n} x1={x1} y1={y1} x2={x2} y2={y2} className={`dr-edge${on ? " is-active" : visited.has(n) ? " is-done" : ""}`} />;
            })}
            {(() => {
              const [x1, y1, x2, y2] = edge(L.boxes, "player", "resolver");
              const on = step === 1 || step === 7;
              return <line x1={x1} y1={y1} x2={x2} y2={y2} className={`dr-edge${on ? " is-active" : step > 1 ? " is-done" : ""}`} />;
            })()}
            {(() => {
              const [x1, y1, x2, y2] = edge(L.boxes, "player", "pop");
              return <line x1={x1} y1={y1} x2={x2} y2={y2} className={`dr-edge dr-edge-pop${step === last ? " is-live" : ""}`} />;
            })()}
            {nodes.map((n) => {
              const b = L.boxes[n];
              const active = (s.kind === "self" && n === "player") || (s.kind !== "self" && s.to === n) || (step === 1 && n === "player");
              const done = visited.has(n) || (n === "resolver" && step > 1);
              const ghost = n === "pop" && step < last;
              const lbl = NODE_LABEL[n];
              const ms = SERVER_MS[n];
              const showMs = ms !== undefined && (visited.has(n) || s.to === n) && b.w >= 150;
              return (
                <g key={n} className={`dr-node${active ? " is-active" : ""}${done ? " is-done" : ""}${ghost ? " is-ghost" : ""}${n === "pop" && !ghost ? " is-pop" : ""}`}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} />
                  <text x={b.x + 12} y={b.y + 19} className="dr-node-title">{lbl.title}</text>
                  <text x={b.x + 12} y={b.y + 35} className="dr-node-sub">{n === "pop" && ghost ? "not known yet" : lbl.sub}</text>
                  {showMs && <text x={b.x + b.w - 10} y={b.y + 19} textAnchor="end" className="dr-node-ms">{ms} ms</text>}
                  {done && n !== "resolver" && n !== "player" && (
                    <circle cx={b.x + b.w - 12} cy={b.y + b.h - 13} r={4} className="dr-node-dot" />
                  )}
                </g>
              );
            })}
            {!reduced && s.kind !== "self" && (() => {
              const [x1, y1, x2, y2] = s.from === "resolver" && s.to === "player" ? edge(L.boxes, "resolver", "player") : edge(L.boxes, s.from, s.to);
              const round = s.kind === "round";
              return (
                <motion.circle key={`pk-${step}-${W}`} r={5} className="dr-packet"
                  initial={{ cx: x1, cy: y1, opacity: 0 }}
                  animate={round ? { cx: [x1, x2, x2, x1], cy: [y1, y2, y2, y1], opacity: [1, 1, 1, 1] } : { cx: [x1, x2], cy: [y1, y2], opacity: [1, 1] }}
                  transition={{ duration: round ? 1.3 : 0.7, times: round ? [0, 0.42, 0.58, 1] : [0, 1], ease: "easeInOut" }} />
              );
            })()}
          </svg>
        )}
      </div>
    </Stage>
  );

  const caption = (
    <motion.div key={step} className="dr-card dr-caption" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="dr-caption-top">
        <span className="dr-kicker">Step {step + 1} of {STEPS.length}</span>
        {s.addMs > 0 && <Chip tone="accent">+{s.addMs} ms</Chip>}
      </div>
      <h4>{s.title}</h4>
      <p>{s.body}</p>
      {s.ask && (<div className="dr-rec-wrap"><div className="dr-rec-label">Asks</div><pre className="dr-rec">{s.ask}</pre></div>)}
      {s.reply && (<div className="dr-rec-wrap"><div className="dr-rec-label">Gets back{s.replyNote ? ` · ${s.replyNote}` : ""}</div><pre className="dr-rec is-reply">{s.reply}</pre></div>)}
    </motion.div>
  );

  const nav = (
    <div className="dr-nav">
      <Button size="s" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step"><Icon name="chevron-left" size={16} /> Back</Button>
      <Button size="s" variant="primary" onClick={() => go(step + 1)} disabled={step === last}>Next <Icon name="chevron-right" size={16} /></Button>
      {step < last
        ? <Button size="s" variant="ghost" onClick={() => setPlaying((p) => !p)}><Icon name={playing ? "pause" : "play"} size={15} /> {playing ? "Pause" : "Play all"}</Button>
        : <Button size="s" variant="ghost" onClick={() => go(0)}><Icon name="reset" size={15} /> Restart</Button>}
      {!full && <span className={`dr-readout${step === last ? " is-final" : ""}`} aria-live="polite"><b>{total}</b> ms so far</span>}
    </div>
  );

  const stats = (
    <StatGrid>
      <Stat label="Lookup time" value={total} unit="ms" tone={step === last ? "accent" : "neutral"} sub="cold cache, assumed" />
      <Stat label="Servers asked" value={queries} unit="of 5" />
    </StatGrid>
  );

  const cachePanel = (
    <div className="dr-card dr-cache" aria-label="Resolver cache">
      <div className="dr-kicker">Resolver cache</div>
      {cached.length === 0 && <div className="dr-muted">Empty. Nothing has been asked yet.</div>}
      {cached.map((c) => (
        <div key={c.id} className="dr-cache-row">
          <code className="dr-cache-name" title={c.name}>{c.name}</code>
          <span className="dr-cache-type">{c.type}</span>
          <span className="dr-cache-ttl">{ttlText(c.ttl)}</span>
          <span className="dr-cache-bar" aria-hidden="true"><i style={{ width: `${(Math.log(c.ttl) / Math.log(172800)) * 100}%` }} /></span>
        </div>
      ))}
      {cached.length > 0 && <div className="dr-muted dr-small">Bar = how long the resolver may keep it (TTL, log scale). Long for delegations, short where the CDN steers.</div>}
    </div>
  );

  const stepList = (
    <ol className="dr-steps" aria-label="All steps">
      {STEPS.map((x, i) => (
        <li key={i}>
          <button type="button" className={i === step ? "is-on" : i < step ? "is-past" : ""} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>
            <span className="dr-steps-n">{i + 1}</span>
            <span className="dr-steps-t">{x.title}</span>
            <span className="dr-steps-ms">{cumMs(i)} ms</span>
          </button>
        </li>
      ))}
    </ol>
  );

  const res = laterLookup(later);
  const laterBlock = step < last ? (
    <div className="dr-locked"><Icon name="lock" size={15} /> Finish the lookup to unlock the next question: what happens when someone asks again?</div>
  ) : (
    <div className="dr-later">
      <Predict
        q={<>A second viewer on the same ISP asks for <code>{HOST}</code> <b>90 seconds</b> later. Which servers must the resolver contact?</>}
        options={["All five again", "Only CloudFront's DNS", "None. Everything is still cached."]}
        answer={1}
        explain={<>The A record (TTL 60 s) has expired, but the CNAME (300 s) and both delegations (2 days) are still cached. One query: {STUB_MS} + {SERVER_MS.gslb} + {STUB_MS} = {2 * STUB_MS + (SERVER_MS.gslb ?? 0)} ms instead of 82 ms.</>}
        onReveal={() => setLaterOpen(true)} />
      {laterOpen && (
        <div className="dr-card dr-later-body">
          <Segmented label="Ask again after" value={later} options={LATER} onChange={setLater} />
          <div className="dr-later-grid">
            {CACHE.map((c) => {
              const ok = res.valid(c.id);
              return (
                <div key={c.id} className={`dr-later-row${ok ? "" : " is-exp"}`}>
                  <code className="dr-cache-name">{c.name}</code>
                  <span className="dr-cache-type">{c.type}</span>
                  <Chip tone={ok ? "good" : "warn"}>{ok ? `cached, ${ttlText(c.ttl - later)} left` : "expired"}</Chip>
                </div>
              );
            })}
          </div>
          <div className="dr-later-sum">
            <div><span className="dr-muted">Resolver asks: </span><b>{res.ask.length === 0 ? "nobody, answers from cache" : res.ask.map((n) => NODE_LABEL[n].title).join(", ")}</b></div>
            <div className="dr-later-ms"><span className="dr-big">{res.ms}</span> ms</div>
          </div>
        </div>
      )}
    </div>
  );

  if (full) {
    return (
      <div className="dr-sec">
        <WidgetFrame
          stage={<div className="dr-col">{stage}{caption}</div>}
          controls={<>{nav}{stats}{stepList}</>}
          footer={<div className="dr-two">{cachePanel}{laterBlock}</div>} />
      </div>
    );
  }
  return (
    <div className="dr-sec">
      <WidgetFrame stage={<div className="dr-col">{stage}{nav}{caption}</div>} footer={<div className="dr-col">{cachePanel}{laterBlock}</div>} />
    </div>
  );
}
