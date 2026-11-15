import { useRef, useState } from "react";
import { Callout, Chip, Segmented, Slider, Stage, Toggle, WidgetFrame } from "@/ui";
import type { Tone } from "@/content/types";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { Predict, type PredictQuestion } from "./Predict";

type Mode = "group" | "dns";
const PUBLISHED_MIN = 2;

interface Outcome { code: string; tone: Tone; via: string; detail: string }
interface Row { id: string; title: string; sub: string; out: Outcome }

const CONNECT_NOTE = "adds one connect timeout: 1 to 2 s if tuned, up to 30 s on CloudFront defaults";

function rows(primaryDown: boolean, newEp: boolean, lag: number, mode: Mode): Row[] {
  const replicaHasNew = lag <= PUBLISHED_MIN;
  const out: Row[] = [
    {
      id: "hot", title: "Popular segment", sub: "already cached at the edge",
      out: { code: "200", tone: "good", via: "edge cache", detail: primaryDown ? "Never reaches an origin, so the outage is invisible here." : "Never reaches an origin." },
    },
    {
      id: "tail", title: "Long-tail episode", sub: "published weeks ago, cache miss",
      out: !primaryDown
        ? { code: "200", tone: "good", via: "primary (S3)", detail: "Every miss goes to the primary first." }
        : mode === "group"
          ? { code: "200", tone: "good", via: "replica, failed over", detail: `The CDN tries S3, the connection fails, and it retries on GCS in the same request. This ${CONNECT_NOTE}.` }
          : { code: "5xx, then 200", tone: "warn", via: "replica after DNS moves", detail: "Errors until health checks fail and cached DNS answers expire, about 2 minutes (Ch. 3). Then GCS serves it." },
    },
  ];
  if (newEp) {
    out.push({
      id: "new", title: "New episode segment", sub: `published ${PUBLISHED_MIN} min ago, cache miss`,
      out: !primaryDown
        ? { code: "200", tone: "good", via: "primary (S3)", detail: replicaHasNew ? "The replica has it too." : `The replica will not have it for another ${fmtMin(lag - PUBLISHED_MIN)}, but nobody asks the replica yet. The gap is invisible.` }
        : replicaHasNew
          ? mode === "group"
            ? { code: "200", tone: "good", via: "replica, failed over", detail: `Replication finished within ${fmtMin(lag)}, so GCS has it.` }
            : { code: "5xx, then 200", tone: "warn", via: "replica after DNS moves", detail: "Errors until DNS moves (about 2 minutes), then GCS has it." }
          : mode === "group"
            ? { code: "404", tone: "bad", via: "replica, failed over", detail: `Failover works, but GCS does not have the object yet: lag is ${fmtMin(lag)}, published ${PUBLISHED_MIN} min ago. A healthy origin answers 404.` }
            : { code: "5xx, then 404", tone: "bad", via: "replica after DNS moves", detail: "Errors until DNS moves, then 404 until replication catches up." },
    });
  }
  return out;
}

function fmtMin(m: number): string {
  const v = Math.round(m * 10) / 10;
  return `${v % 1 ? v.toFixed(1) : v} min`;
}

export function MultiOriginTab() {
  const [lag, setLag] = useState(1);
  const [primaryDown, setPrimaryDown] = useState(false);
  const [newEp, setNewEp] = useState(false);
  const [mode, setMode] = useState<Mode>("group");
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const list = rows(primaryDown, newEp, lag, mode);
  const missing = newEp && lag > PUBLISHED_MIN;

  const questions: PredictQuestion[] = [
    {
      id: "lag-404",
      prompt: `The primary region is down. A new episode went live ${PUBLISHED_MIN} minutes ago, and replication lag is 5 minutes. A fan presses play. What happens?`,
      options: ["It plays from the replica", "404: the replica does not have it yet", "It plays from the primary"],
      answer: 1,
      explain: <>The CDN fails over to GCS, but GCS gets the episode only 5 minutes after publish. The request reaches a healthy origin that answers 404. Failover helps only if the replica is complete.</>,
      showLabel: "Show this outage",
      show: () => { setLag(5); setNewEp(true); setMode("group"); setPrimaryDown(true); },
    },
    {
      id: "lag-hidden",
      prompt: "The primary is healthy and replication lag is 10 minutes. Do viewers of the new episode get 404s?",
      options: ["Yes, some of them", "No"],
      answer: 1,
      explain: <>Every miss goes to the primary first, and the primary has the episode. The lag stays hidden until the day you fail over. That is why lag is an SLO with alerts.</>,
      showLabel: "Show it",
      show: () => { setLag(10); setNewEp(true); setPrimaryDown(false); },
    },
    {
      id: "dns-vs-group",
      prompt: "Same outage, a long-tail episode the cache does not have. Which recovers sooner for that viewer?",
      options: ["Origin group in the CDN", "DNS-level failover", "About the same"],
      answer: 0,
      explain: <>An origin group retries the secondary inside the same request. DNS failover waits for health checks to fail and for cached DNS answers to expire, about 2 minutes. Keep DNS as the backstop.</>,
      showLabel: "Compare with DNS",
      show: () => { setPrimaryDown(true); setMode("group"); window.setTimeout(() => setMode("dns"), reduced ? 0 : 900); },
    },
  ];

  const stage = (
    <Stage className="so-stage">
      <div ref={ref} className="so-measure">
        {width > 0 && <OriginDiagram width={width} lag={lag} primaryDown={primaryDown} newEp={newEp} mode={mode} motion={!reduced} />}
      </div>
    </Stage>
  );

  const footer = (
    <div className="so-col">
      <div className="so-rows" aria-live="polite">
        {list.map((r) => (
          <div key={r.id} className={`so-row tone-${r.out.tone}`}>
            <div className="so-row-head">
              <div><strong>{r.title}</strong> <span className="so-muted">{r.sub}</span></div>
              <Chip tone={r.out.tone}>{r.out.code}</Chip>
            </div>
            <div className="so-row-via">Served by: {r.out.via}</div>
            <div className="so-row-detail">{r.out.detail}</div>
          </div>
        ))}
      </div>
      {primaryDown && missing && (
        <Callout type="mistake">Publishing as soon as the primary has the content. The moment you most need failover is the moment the replica might be behind. A <b>publish gate</b> keeps the episode hidden until every origin has every object, verified by checksum.</Callout>
      )}
      <div className="so-compare">
        <div className={`so-card ${mode === "group" ? "on" : ""}`}>
          <div className="so-card-title">Origin failover in the CDN (origin groups)</div>
          <ul>
            <li>Per request, on the miss path. The CDN tries the primary first every time, then the secondary on status codes you choose or a failed connection.</li>
            <li>Fast and invisible when timeouts are tuned. CloudFront's defaults can wait up to 30 s, longer than a player buffer.</li>
            <li>Each origin keeps its own shield, so the replica starts cold.</li>
          </ul>
        </div>
        <div className={`so-card ${mode === "dns" ? "on" : ""}`}>
          <div className="so-card-title">DNS-level failover</div>
          <ul>
            <li>Health checks mark the primary unhealthy, then DNS answers with the replica's address.</li>
            <li>Slower: detection, then TTL and resolver caches. About 2 minutes in Chapter 3's math.</li>
            <li>Coarse: it moves everything at once. Good as a backstop, not as the first line.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const controls = (
    <div className="so-controls-wrap"><div className="so-controls">
      <Slider label="Replication lag (S3 to GCS)" value={lag} min={0.5} max={15} step={0.5} onChange={setLag} format={fmtMin}
        hint="Time from write on S3 to a verified copy on GCS." />
      <Toggle label="Primary region down" checked={primaryDown} onChange={setPrimaryDown} hint="S3 in us-east-1 stops answering." />
      <Toggle label="New episode published 2 min ago" checked={newEp} onChange={setNewEp} hint="First viewers miss every cache." />
      <Segmented label="Failover happens in" value={mode} onChange={setMode}
        options={[{ value: "group" as Mode, label: "CDN origin group" }, { value: "dns" as Mode, label: "DNS" }]} />
    </div></div>
  );

  return <WidgetFrame stage={stage} controls={controls} footer={<div className="so-col">{footer}<Predict questions={questions} /></div>} />;
}

function OriginDiagram({ width, lag, primaryDown, newEp, mode, motion }: { width: number; lag: number; primaryDown: boolean; newEp: boolean; mode: Mode; motion: boolean }) {
  const W = Math.max(300, Math.round(width));
  const narrow = W < 520;
  const pH = newEp || primaryDown ? 70 : 58, rH = newEp ? 70 : 58;
  const H = narrow ? 250 : 236;
  const cdnW = Math.round(narrow ? W * 0.37 : W * 0.3);
  const oW = Math.round(narrow ? W * 0.47 : W * 0.36);
  const ox = W - oW;
  const cdnY = (H - 58) / 2, pY = 4, rY = H - 4 - rH;
  const cx = cdnW, cy = cdnY + 29;
  const pCy = pY + pH / 2, rCy = rY + rH / 2;
  const mid = (cx + ox) / 2;
  const curve = (y2: number) => `M${cx},${cy} C${mid},${cy} ${mid},${y2} ${ox},${y2}`;
  const replicaHasNew = lag <= PUBLISHED_MIN;

  const toPrimary = primaryDown ? "so-route failed" : "so-route active";
  const toReplica = !primaryDown ? "so-route idle" : mode === "group" ? "so-route active" : "so-route pending";
  const rx = ox + 18;
  const label = `CDN with two origins. Primary S3 is ${primaryDown ? "down" : "up"}. Replica GCS with ${fmtMin(lag)} replication lag. ` +
    (primaryDown ? (mode === "group" ? "Misses fail over per request to the replica." : "Misses fail until DNS moves to the replica.") : "Misses go to the primary.");

  return (
    <svg className="so-origins" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {/* routes */}
      <path d={curve(pCy)} className={toPrimary} />
      {motion && !primaryDown && <path d={curve(pCy)} className="so-flow so-flow-route" />}
      <path d={curve(rCy)} className={toReplica} />
      {motion && primaryDown && mode === "group" && <path d={curve(rCy)} className="so-flow so-flow-route" />}
      {primaryDown && (
        <g transform={`translate(${ox - 16},${pCy})`} className="so-x" aria-hidden="true">
          <circle r={9} />
          <path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" />
        </g>
      )}
      {primaryDown && (
        <text x={mid - 10} y={(cy + rCy) / 2 + 16} textAnchor="end" className="so-t-sub" style={{ fill: mode === "group" ? "var(--p3)" : "var(--warn)" }}>
          {mode === "group" ? "per request" : "after ~2 min"}
        </text>
      )}

      {/* replication arrow */}
      <line x1={rx} x2={rx} y1={pY + pH + 4} y2={rY - 8} className={`so-repl ${primaryDown ? "paused" : ""}`} />
      <path d={`M${rx - 4},${rY - 10} L${rx},${rY - 4} L${rx + 4},${rY - 10}`} className={`so-repl-head ${primaryDown ? "paused" : ""}`} />
      {motion && !primaryDown && <line x1={rx} x2={rx} y1={pY + pH + 4} y2={rY - 8} className="so-flow so-flow-repl" />}
      <text x={rx + 10} y={(pY + pH + rY) / 2 - 3} className="so-t-sub">
        <tspan x={rx + 10}>{primaryDown ? "Replication paused" : "Replication"}</tspan>
        <tspan x={rx + 10} dy={16} className="so-t-strong">lag {fmtMin(lag)}</tspan>
      </text>

      {/* boxes */}
      <Box x={0} y={cdnY} w={cdnW} h={58} title="CDN" sub="edge + shield" />
      <Box x={ox} y={pY} w={oW} h={pH} title="Primary" sub="S3, us-east-1" tone={primaryDown ? "bad" : undefined}
        status={primaryDown ? { text: "Region down", tone: "bad" } : newEp ? { text: "New episode: yes", tone: "good" } : undefined} />
      <Box x={ox} y={rY} w={oW} h={rH} title="Replica" sub="GCS, other cloud"
        status={newEp ? (replicaHasNew ? { text: "New episode: yes", tone: "good" } : { text: "New episode: missing", tone: "bad" }) : undefined} />
    </svg>
  );
}

function Box({ x, y, w, h, title, sub, tone, status }: { x: number; y: number; w: number; h: number; title: string; sub: string; tone?: "bad"; status?: { text: string; tone: "good" | "bad" } }) {
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={12} className={`so-box ${tone ?? ""}`} />
      <text x={x + 12} y={y + 23} className="so-t-title">{title}</text>
      <text x={x + 12} y={y + 41} className="so-t-sub">{sub}</text>
      {status && <text x={x + 12} y={y + 59} className="so-t-sub so-t-strong" style={{ fill: status.tone === "good" ? "var(--good)" : "var(--bad)" }}>{status.text}</text>}
    </g>
  );
}
