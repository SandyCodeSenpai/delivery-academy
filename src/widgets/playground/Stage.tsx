/**
 * The architecture drawing. Draws base links, traffic flows (thickness grows with load),
 * the highlighted request path, nodes with cache state and faults, HIT/MISS badges, and
 * the travelling packet. The packet moves in requestAnimationFrame and writes its
 * transform straight to the DOM, so React re-renders only once per hop, not per frame.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { along, baseLinks, length, link, pathD, type Cubic, type Layout } from "./layout";
import {
  CDN_LIKE, CDNS, REGIONS, REGION_NAME, REGION_SHORT, nodeWarm, viewersFromLog, REGION_MIX,
  type Cdn, type Hop, type NodeId, type PgState, type Region, type RequestTrace, type TrafficResult,
} from "./model";

const fmtGbps = (bps: number) => (bps >= 1e12 ? `${(bps / 1e12).toFixed(1)} Tbps` : bps >= 1e9 ? `${(bps / 1e9).toFixed(bps < 1e10 ? 1 : 0)} Gbps` : bps > 0 ? `${Math.max(1, Math.round(bps / 1e6))} Mbps` : "0 Gbps");

export const CDN_COLOR: Record<Cdn, string> = { A: "var(--p2)", B: "var(--p1)" };

const toneColor = (r: Hop["result"]) =>
  r === "hit" ? "var(--good)" : r === "miss" || r === "bypass" ? "var(--warn)" : r === "fail" || r === "timeout" || r === "404" ? "var(--bad)" : "var(--ink-2)";
const toneSoft = (r: Hop["result"]) =>
  r === "hit" ? "var(--good-soft)" : r === "miss" || r === "bypass" ? "var(--warn-soft)" : r === "fail" || r === "timeout" || r === "404" ? "var(--bad-soft)" : "var(--surface-2)";

export interface StageProps {
  L: Layout;
  s: PgState;
  view: "request" | "traffic";
  traffic: TrafficResult;
  trace: RequestTrace | null;
  revealed: number;
  playKey: number;
  reduced: boolean;
  onHop: (i: number) => void;
  onDone: () => void;
  onPickRegion?: (r: Region) => void;
  label: string;
}

/** Visual travel time for one hop. Real latency differs by 100x between hops, so it is
 *  compressed with a log: long hops look longer, but nothing takes more than ~1.1 s. */
function hopDuration(h: Hop, segs: number) {
  if (h.returnPath) return 420 + 120 * segs;
  return Math.min(900, 380 + 130 * Math.log10(1 + h.ms));
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hopChain(L: Layout, h: Hop, viewer: NodeId): { chain: Cubic[]; bounce: boolean } {
  if (h.returnPath) {
    const nodes = [...h.returnPath, viewer];
    const chain: Cubic[] = [];
    for (let i = 0; i < nodes.length - 1; i++) chain.push(link(L, nodes[i], nodes[i + 1]));
    return { chain, bounce: false };
  }
  const there = link(L, h.from, h.to);
  // Failures bounce: the packet reaches the node, the badge appears, and it comes back.
  const bounce = h.result === "fail" || h.result === "timeout" || h.result === "bypass";
  return { chain: bounce ? [there, link(L, h.to, h.from)] : [there], bounce };
}

export function Stage(p: StageProps) {
  const { L, s, view, traffic, trace, revealed, reduced } = p;
  const packet = useRef<SVGGElement>(null);
  const cb = useRef({ onHop: p.onHop, onDone: p.onDone });
  cb.current = { onHop: p.onHop, onDone: p.onDone };

  // Packet animation: one hop after another.
  useEffect(() => {
    if (!trace || p.playKey === 0) return;
    let cancelled = false, raf = 0, timer = 0;
    const g = packet.current;
    const viewer = `viewer:${s.region}` as NodeId;
    const hide = () => g && g.setAttribute("opacity", "0");
    const run = (i: number) => {
      if (cancelled) return;
      if (i >= trace.hops.length) { hide(); cb.current.onDone(); return; }
      const h = trace.hops[i];
      if (reduced || !g) {
        cb.current.onHop(i);
        timer = window.setTimeout(() => run(i + 1), reduced ? 420 : 300);
        return;
      }
      const { chain, bounce } = hopChain(L, h, viewer);
      const lens = chain.map((c) => length(c));
      const dur = hopDuration(h, chain.length) * (bounce ? 1.5 : 1);
      const t0 = performance.now();
      let badged = false;
      g.setAttribute("opacity", "1");
      const step = (now: number) => {
        if (cancelled) return;
        const k = Math.min(1, (now - t0) / dur);
        const pt = along(chain, lens, easeInOut(k));
        g.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
        if (bounce && !badged && k >= 0.5) { badged = true; cb.current.onHop(i); }
        if (k < 1) { raf = requestAnimationFrame(step); return; }
        if (!bounce) cb.current.onHop(i);
        const pause = h.result === "timeout" ? 420 : h.controlPlane ? 120 : 220;
        timer = window.setTimeout(() => run(i + 1), pause);
      };
      raf = requestAnimationFrame(step);
    };
    run(0);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(timer); hide(); };
    // Only a new playKey starts a new animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.playKey]);

  const f = s.faults;
  const nodeDown = (id: string) => (f.cdnAOutage && id.startsWith("edge:A")) || (f.shieldADown && id === "shield:A") || (f.awsDown && id === "s3");
  const R = L.r;
  const fs = L.font;

  // Request path highlight and badges for the hops revealed so far.
  const shownHops = trace ? trace.hops.slice(0, revealed) : [];
  const badges = new Map<string, Hop>();
  for (const h of shownHops) badges.set(h.to, h);
  const lit = new Set<string>();
  for (const h of shownHops) if (!h.returnPath) lit.add(`${h.from}>${h.to}`);

  // Traffic flows: stroke width ∝ sqrt(load), so a 2 Tbps link and a 20 Gbps link both stay visible.
  const maxW = L.kind === "wide" ? 16 : L.kind === "compact" ? 11 : 10;
  const widthFor = (bps: number) => 1.2 + (maxW - 1.2) * Math.sqrt(Math.min(1, bps / 2.4e12));
  const flowColor = (from: string, to: string) => {
    const id = from.startsWith("shield") || from.startsWith("edge") ? from : to;
    return id.includes(":A") ? CDN_COLOR.A : CDN_COLOR.B;
  };

  const radius = (id: string) => (id.startsWith("viewer") ? R.viewer : id === "steer" ? R.steer : id.startsWith("edge") ? R.edge : id.startsWith("shield") ? R.shield : R.origin);

  const badge = (id: string, h: Hop) => {
    const c = L.pos[id]; if (!c) return null;
    const text = h.badge;
    const bfs = Math.max(12, fs - 1.5);
    const w = text.length * bfs * 0.66 + bfs * 1.1, hgt = bfs + 9;
    const r = radius(id);
    let x = c.x + r + 5;
    if (x + w > L.w - 2 || id === "steer") x = c.x - r - 5 - w;  // steering's label sits on its right
    let y = c.y - hgt / 2;
    // Shields and origins sit close together: their badges go above the node.
    if (id.startsWith("shield") || ((id === "s3" || id === "gcs") && L.kind !== "compact")) { x = c.x - w / 2; y = c.y - r - hgt - 5; }
    else if (id === "s3" || id === "gcs") x = c.x - r - 5 - w;  // compact: the lag label sits on the right
    if (L.kind === "tall" && id.startsWith("viewer")) { x = c.x - w / 2; y = c.y + r + 4; }
    const steerBadge = id === "steer";
    const color = steerBadge ? CDN_COLOR[h.badge as Cdn] ?? "var(--ink-2)" : toneColor(h.result);
    return (
      <motion.g key={`b-${id}-${h.badge}`} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.32, ease: [0.2, 0.8, 0.2, 1] }} style={{ transformOrigin: `${x + w / 2}px ${y + hgt / 2}px`, transformBox: "view-box" }}>
        <rect x={x} y={y} width={w} height={hgt} rx={hgt / 2} style={{ fill: steerBadge ? "var(--surface)" : toneSoft(h.result), stroke: color }} strokeWidth={1.2} />
        <text x={x + w / 2} y={y + hgt / 2 + bfs * 0.35} textAnchor="middle" className="pg-badge-t" style={{ fill: color, fontSize: bfs }}>{text}</text>
      </motion.g>
    );
  };

  const keyPick = (r: Region) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onPickRegion?.(r); } };
  const V = viewersFromLog(s.viewersLog);
  const fmtV = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`);

  return (
    <svg className={`pg-svg pg-${L.kind}`} viewBox={`0 0 ${L.w} ${L.h}`} role="img" aria-label={p.label}>
      {/* Column headers (wide only) */}
      {L.headers.map((h) => <text key={h.text} x={h.x} y={h.y} textAnchor={h.anchor} className="pg-colhead" style={{ fontSize: fs - 1 }}>{h.text}</text>)}

      {/* Base links */}
      <g className="pg-base">
        {baseLinks().map((b) => {
          // Control-plane lines only for the selected viewer, so the drawing stays calm.
          if (b.kind === "control" && (view !== "request" || b.from !== `viewer:${s.region}`)) return null;
          const d = pathD(link(L, b.from, b.to));
          const on = lit.has(`${b.from}>${b.to}`) || lit.has(`${b.to}>${b.from}`);
          return (
            <path key={`${b.from}>${b.to}`} d={d} fill="none"
              className={`pg-link pg-link-${b.kind}${on ? " on" : ""}`}
              style={{ stroke: on ? "var(--ink)" : b.cdn ? CDN_COLOR[b.cdn] : "var(--muted)" }} />
          );
        })}
        {/* Bypass links appear when shield A is down */}
        {f.shieldADown && REGIONS.map((r) => {
          const to: NodeId = f.awsDown ? "gcs" : "s3";
          const on = lit.has(`edge:A:${r}>shield:A`) && shownHops.some((h) => h.to === to);
          return <path key={`bp-${r}`} d={pathD(link(L, `edge:A:${r}`, to))} fill="none" className={`pg-link pg-link-fallback${on ? " on" : ""}`} style={{ stroke: on ? "var(--ink)" : CDN_COLOR.A }} />;
        })}
      </g>

      {/* Traffic flows */}
      {view === "traffic" && (
        <g className={`pg-flows${reduced ? " still" : ""}`}>
          {traffic.links.map((l) => {
            const d = pathD(link(L, l.from, l.to));
            if (l.failed) return <path key={`f-${l.from}>${l.to}`} d={d} fill="none" className="pg-flow-fail" />;
            if (l.bps <= 0) return null;
            const w = widthFor(l.bps), col = flowColor(l.from, l.to);
            return (
              <g key={`f-${l.from}>${l.to}`}>
                <path d={d} fill="none" className="pg-flow-bed" style={{ stroke: col, strokeWidth: w }} />
                <path d={d} fill="none" className="pg-flow-dots" style={{ stroke: col, strokeWidth: Math.max(1.6, Math.min(w * 0.42, 4.5)) }} />
              </g>
            );
          })}
        </g>
      )}

      {/* Replication S3 -> GCS */}
      {(() => {
        const a = L.pos.s3, b = L.pos.gcs, r = R.origin + 4;
        const lag = f.replLag;
        const col = lag ? "var(--warn)" : "var(--muted)";
        const v = L.dir === "h";
        const x1 = v ? a.x : a.x + r, y1 = v ? a.y + r : a.y, x2 = v ? b.x : b.x - r, y2 = v ? b.y - r : b.y;
        const lagText = lag ? "45 min" : "20 s";
        return (
          <g className="pg-repl">
            <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: col }} strokeWidth={1.6} strokeDasharray="4 4" />
            <path d={v ? `M${x2 - 5},${y2 - 7} L${x2},${y2} L${x2 + 5},${y2 - 7}` : `M${x2 - 7},${y2 - 5} L${x2},${y2} L${x2 - 7},${y2 + 5}`} fill="none" style={{ stroke: col }} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            {L.kind === "wide" && (<>
              <text x={a.x + 14} y={(a.y + b.y) / 2 - 4} className="pg-sub" style={{ fontSize: fs, fill: col }}>replication</text>
              <text x={a.x + 14} y={(a.y + b.y) / 2 + fs + 2} className="pg-lbl" style={{ fontSize: fs, fill: lag ? "var(--warn)" : "var(--ink-2)" }}>lag {lagText}</text>
            </>)}
            {L.kind === "compact" && (<>
              <text x={a.x + 10} y={(a.y + b.y) / 2 - 2} className="pg-sub" style={{ fontSize: fs, fill: col }}>lag</text>
              <text x={a.x + 10} y={(a.y + b.y) / 2 + fs + 1} className="pg-lbl" style={{ fontSize: fs, fill: lag ? "var(--warn)" : "var(--ink-2)" }}>{lagText}</text>
            </>)}
            {L.kind === "tall" && (
              <text x={(a.x + b.x) / 2} y={a.y - 8} textAnchor="middle" className="pg-lbl" style={{ fontSize: fs, fill: lag ? "var(--warn)" : "var(--ink-2)" }}>lag {lagText}</text>
            )}
          </g>
        );
      })()}

      {/* Steering */}
      {(() => {
        const c = L.pos.steer;
        return (
          <g transform={`translate(${c.x},${c.y})`} className="pg-node">
            <circle r={R.steer} className="pg-disc" style={{ stroke: "var(--ink-2)" }} />
            <g style={{ color: "var(--ink-2)" }}><Icon name="steer" size={R.steer * 1.05} /></g>
            <text x={R.steer + 8} y={L.showSub ? -3 : fs * 0.35} className="pg-lbl" style={{ fontSize: fs }}>Steering</text>
            {L.showSub && <text x={R.steer + 8} y={fs + 1} className="pg-sub" style={{ fontSize: fs }}>Playback API · {s.steer === "manual" ? `manual ${Math.round(s.splitA * 100)}/${100 - Math.round(s.splitA * 100)}` : s.steer}</text>}
          </g>
        );
      })()}

      {/* Viewers */}
      {REGIONS.map((r) => {
        const c = L.pos[`viewer:${r}`];
        const sel = view === "request" && r === s.region;
        const label = L.kind === "wide" ? REGION_NAME[r] : REGION_SHORT[r];
        const ly = L.kind === "tall" ? -R.viewer - 8 : R.viewer + fs + 3;
        return (
          <g key={r} transform={`translate(${c.x},${c.y})`} className={`pg-node pg-viewer${sel ? " sel" : ""}`}
            role={p.onPickRegion ? "button" : undefined} tabIndex={p.onPickRegion ? 0 : undefined}
            aria-label={p.onPickRegion ? `Viewers in ${REGION_NAME[r]}${sel ? ", selected" : ""}` : undefined}
            onClick={p.onPickRegion ? () => p.onPickRegion!(r) : undefined} onKeyDown={p.onPickRegion ? keyPick(r) : undefined}>
            <circle r={R.viewer + 5} className="pg-sel-ring" />
            <circle r={R.viewer} className="pg-disc" />
            <g style={{ color: sel ? "var(--ink)" : "var(--ink-2)" }}><Icon name="viewer" size={R.viewer * 1.1} /></g>
            <text y={ly} textAnchor="middle" className="pg-lbl" style={{ fontSize: fs }}>{label}</text>
            {view === "traffic" && L.kind === "wide" && <text y={ly + fs + 3} textAnchor="middle" className="pg-sub" style={{ fontSize: fs }}>{fmtV(V * REGION_MIX[r])} viewers</text>}
          </g>
        );
      })}

      {/* Edge PoPs */}
      {REGIONS.flatMap((r) => CDNS.map((c) => {
        const id = `edge:${c}:${r}`;
        const pt = L.pos[id];
        const down = nodeDown(id);
        const warm = nodeWarm(s, "edge", c, r);
        return (
          <g key={id} transform={`translate(${pt.x},${pt.y})`} className="pg-node">
            <title>{`${c === "A" ? "CDN A" : "CDN B"} edge, ${REGION_NAME[r]}: ${down ? "down" : warm ? "warm cache" : "cold cache"}`}</title>
            <circle r={R.edge} className={`pg-disc${warm && !down ? " warm" : ""}`}
              style={{ stroke: down ? "var(--bad)" : CDN_COLOR[c], fill: down ? "var(--bad-soft)" : undefined, ["--tint" as string]: CDN_COLOR[c] }}
              strokeDasharray={warm || down ? undefined : "3 3"} />
            {down ? <g style={{ color: "var(--bad)" }}><Icon name="down" size={R.edge * 1.2} /></g>
              : <text y={fs * 0.36} textAnchor="middle" className="pg-letter" style={{ fontSize: Math.max(12, fs - 1), fill: CDN_COLOR[c] }}>{c}</text>}
          </g>
        );
      }))}

      {/* Shields */}
      {CDNS.map((c) => {
        const id = `shield:${c}`;
        const pt = L.pos[id];
        const down = nodeDown(id);
        const warm = nodeWarm(s, "shield", c);
        return (
          <g key={id} transform={`translate(${pt.x},${pt.y})`} className="pg-node">
            <title>{`Shield ${c}: ${down ? "down" : warm ? "warm cache" : "cold cache"}`}</title>
            <circle r={R.shield} className={`pg-disc${warm && !down ? " warm" : ""}`}
              style={{ stroke: down ? "var(--bad)" : CDN_COLOR[c], fill: down ? "var(--bad-soft)" : undefined, ["--tint" as string]: CDN_COLOR[c] }}
              strokeDasharray={warm || down ? undefined : "4 3"} />
            <g style={{ color: down ? "var(--bad)" : CDN_COLOR[c] }}><Icon name={down ? "down" : "shield"} size={R.shield * 1.05} /></g>
            <text y={R.shield + fs + 3} textAnchor="middle" className="pg-lbl" style={{ fontSize: fs }}>Shield {c}</text>
            {L.showSub && <text y={R.shield + 2 * fs + 6} textAnchor="middle" className="pg-sub" style={{ fontSize: fs, fill: down ? "var(--bad)" : undefined }}>{down ? "down" : CDN_LIKE[c]}</text>}
          </g>
        );
      })}

      {/* Origins */}
      {(["s3", "gcs"] as const).map((id) => {
        const pt = L.pos[id];
        const down = nodeDown(id);
        const slow = id === "s3" && f.slowOrigin && !down;
        const lag = id === "gcs" && f.replLag;
        const ring = down ? "var(--bad)" : slow || lag ? "var(--warn)" : "var(--ink-2)";
        const name = id === "s3" ? "S3 us-west-2" : "GCS us-central1";
        // In traffic view the origin shows what reaches it: the number that shields protect.
        const inflow = view === "traffic" ? traffic.links.filter((l) => l.to === id).reduce((sum, l) => sum + l.bps, 0) : 0;
        const sub = down ? "region down" : slow ? "slow: 1.2 s" : lag ? "new episode missing"
          : view === "traffic" ? `${fmtGbps(inflow)} in` : id === "s3" ? "primary" : "replica";
        const showSub = L.showSub || down || slow || lag;
        return (
          <g key={id} transform={`translate(${pt.x},${pt.y})`} className="pg-node">
            <circle r={R.origin} className="pg-disc" style={{ stroke: ring, fill: down ? "var(--bad-soft)" : undefined }} />
            <g style={{ color: ring }}><Icon name={down ? "down" : "bucket"} size={R.origin * 1.05} /></g>
            {L.kind === "compact"
              ? <text x={R.origin + 6} y={fs * 0.36} className="pg-lbl" style={{ fontSize: fs }}>{id === "s3" ? "S3" : "GCS"}</text>
              : <text y={R.origin + fs + 3} textAnchor="middle" className="pg-lbl" style={{ fontSize: fs }}>{name}</text>}
            {showSub && L.kind !== "compact" && <text y={R.origin + 2 * fs + 6} textAnchor="middle" className="pg-sub" style={{ fontSize: fs, fill: down ? "var(--bad)" : slow || lag ? "var(--warn)" : undefined }}>{sub}</text>}
          </g>
        );
      })}

      {/* Badges */}
      <AnimatePresence>{[...badges.entries()].map(([id, h]) => badge(id, h))}</AnimatePresence>

      {/* Packet */}
      <g ref={packet} opacity={0} className="pg-packet" aria-hidden="true">
        <circle r={L.kind === "wide" ? 13 : 10} className="pg-packet-halo" />
        <circle r={L.kind === "wide" ? 6.5 : 5.2} className="pg-packet-dot" />
      </g>
    </svg>
  );
}
