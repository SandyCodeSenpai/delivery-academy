/* Flow diagram renderer: HTML cards over an SVG edge layer, laid out at 1:1 pixel scale so text never shrinks. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FlowSpec, Tone } from "@/content/types";
import { useReducedMotion } from "@/lib/hooks";
import { Icon, familyOf } from "./icons";
import { layoutFlow, edgeKey, polyLen, type FlowLayout, type LEdge, type Pt } from "./layout";
import { plain } from "./text";

/** Width of an element's content box; measured before paint so the first frame is already laid out. */
export function useBoxWidth(ref: React.RefObject<HTMLElement>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    setW(Math.floor(el.clientWidth));
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(Math.floor(el.clientWidth))); });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [ref]);
  return w;
}

/** Remembers what each diagram last looked like, so the next step animates from it instead of jumping. */
const memory = new Map<string, { focus?: string[]; flow?: string[] }>();
const signature = (s: FlowSpec) =>
  s.nodes.map((n) => `${n.id}@${n.col},${n.row}`).join("|") + "#" + s.edges.map(edgeKey).join("|");

export function badgeTone(text: string, tone?: Tone): Tone {
  if (tone && tone !== "neutral") return tone;
  const t = text.toUpperCase();
  if (/\b(HIT|OK|200|206|304|LIVE|UP|PASS)\b/.test(t)) return "good";
  if (/\b(MISS|STALE|EXPIRED|SLOW|RETRY|WARN)\b/.test(t)) return "warn";
  if (/\b([45]\d\d|ERR|ERROR|FAIL|FAILED|DOWN|DENY|DENIED|BLOCK)\b/.test(t)) return "bad";
  return "neutral";
}

interface FocusInfo { nodes: Set<string>; edges: Set<string> }
function resolveFocus(spec: FlowSpec, focus: string[] | undefined, flow: string[] | undefined): FocusInfo | null {
  if (!focus || !focus.length) return null;
  const f = new Set(focus);
  const flowSet = new Set(flow ?? []);
  const explicitEdges = focus.some((k) => k.includes(">"));
  const nodes = new Set(spec.nodes.filter((n) => f.has(n.id)).map((n) => n.id));
  const edges = new Set<string>();
  for (const e of spec.edges) {
    const k = edgeKey(e), r = `${e.to}>${e.from}`;
    const on = f.has(k) || f.has(r) || flowSet.has(k) || flowSet.has(r) || (!explicitEdges && nodes.has(e.from) && nodes.has(e.to));
    if (on) { edges.add(k); nodes.add(e.from); nodes.add(e.to); }
  }
  return { nodes, edges };
}

export function FlowDiagram({ spec }: { spec: FlowSpec }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const width = useBoxWidth(hostRef);
  const layout = useMemo(() => (width > 0 ? layoutFlow(spec, width) : null), [spec, width]);
  const sig = useMemo(() => signature(spec), [spec]);

  // Start from the previous step's focus (if this diagram was just on screen), then move to the new one.
  const prev = memory.get(sig);
  const [shown, setShown] = useState<{ focus?: string[]; flow?: string[] }>(() => prev ?? { focus: spec.focus, flow: spec.flow });
  const [entering, setEntering] = useState(() => !prev);
  useEffect(() => {
    if (!entering) return;
    const id = setTimeout(() => setEntering(false), 600 + spec.nodes.length * 80 + 700);
    return () => clearTimeout(id);
  }, [entering, spec.nodes.length]);
  useEffect(() => {
    const next = { focus: spec.focus, flow: spec.flow };
    memory.set(sig, next);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(next)));
    return () => cancelAnimationFrame(id);
  }, [sig, spec.focus, spec.flow]);

  const aria = useMemo(() => {
    const name = new Map(spec.nodes.map((n) => [n.id, plain(n.label)]));
    const parts = spec.edges.filter((e) => name.has(e.from) && name.has(e.to))
      .map((e) => `${name.get(e.from)} ${e.both ? "to and from" : "to"} ${name.get(e.to)}${e.label ? ` (${plain(e.label)})` : ""}`);
    return `Diagram: ${parts.length ? parts.join("; ") : spec.nodes.map((n) => plain(n.label)).join(", ")}.`;
  }, [spec]);

  return (
    <div ref={hostRef} className="dg-flow-host">
      {layout && layout.nodes.length > 0 && (
        <div className={`dg-scroll${layout.overflow ? " is-overflow" : ""}`} tabIndex={layout.overflow ? 0 : undefined}>
          <FlowCanvas layout={layout} spec={spec} focus={shown.focus} flow={shown.flow} entering={entering} aria={aria} />
        </div>
      )}
    </div>
  );
}

function FlowCanvas({ layout, spec, focus, flow, entering, aria }: { layout: FlowLayout; spec: FlowSpec; focus?: string[]; flow?: string[]; entering: boolean; aria: string }) {
  const reduced = useReducedMotion();
  const fi = useMemo(() => resolveFocus(spec, focus, flow), [spec, focus, flow]);
  const edgeByKey = useMemo(() => new Map(layout.edges.map((e) => [e.key, e])), [layout]);

  // flow steps: resolve keys (accept reversed keys) to concrete edges and a direction
  const steps = useMemo(() => (flow ?? []).map((k) => {
    const e = edgeByKey.get(k);
    if (e) return { e, rev: false };
    const [a, b] = k.split(">");
    const r = edgeByKey.get(`${b}>${a}`);
    return r ? { e: r, rev: true } : null;
  }).filter(Boolean) as { e: LEdge; rev: boolean }[], [flow, edgeByKey]);
  const flowKeys = useMemo(() => new Set(steps.map((s) => s.e.key)), [steps]);

  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const packetRef = useRef<SVGGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = canvasRef.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Packet animation: constant ~240px/s along each flow edge, eased at the ends, 200ms rest at each node.
  useEffect(() => {
    const g = packetRef.current;
    if (!g || !steps.length || reduced || !visible) { if (g) g.style.opacity = "0"; return; }
    const SPEED = 240, DWELL = 200, END = 700, LEAD = entering ? 900 : 250;
    const segs = steps.map((s) => {
      const el = pathRefs.current.get(s.e.key);
      const len = el ? el.getTotalLength() : 0;
      return { ...s, el, len, dur: Math.max(380, (len / SPEED) * 1000) };
    }).filter((s) => s.el && s.len > 0);
    if (!segs.length) return;
    const total = LEAD + segs.reduce((t, s) => t + s.dur + DWELL, 0) + END;
    const ease = (p: number) => 0.6 * p + 0.4 * (p * p * (3 - 2 * p));
    let raf = 0, lastSeg = -1;
    const t0 = performance.now();
    const ping = (id: string) => {
      const n = nodeRefs.current.get(id); if (!n) return;
      n.classList.remove("is-ping"); void n.offsetWidth; n.classList.add("is-ping");
    };
    const tick = (now: number) => {
      let t = (now - t0) % total;
      let opacity = 1;
      if (t < LEAD) { g.style.opacity = "0"; lastSeg = -1; raf = requestAnimationFrame(tick); return; }
      t -= LEAD;
      let i = 0, local = 0, dwell = false;
      for (; i < segs.length; i++) {
        if (t < segs[i].dur) { local = t / segs[i].dur; break; }
        t -= segs[i].dur;
        if (t < DWELL) { local = 1; dwell = true; break; }
        t -= DWELL;
      }
      if (i >= segs.length) { i = segs.length - 1; local = 1; opacity = Math.max(0, 1 - t / 260); }
      const s = segs[i];
      if (dwell || local >= 1) {
        if (lastSeg !== i) { lastSeg = i; ping(s.rev ? s.e.from : s.e.to); }
      }
      const p = ease(Math.min(1, local));
      const d = (s.rev ? 1 - p : p) * s.len;
      const pt = s.el!.getPointAtLength(d);
      if (i === 0 && local < 0.12) opacity = Math.min(opacity, local / 0.12);
      g.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      g.style.opacity = String(opacity);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [steps, reduced, visible, layout, entering]);

  const dimNode = (id: string) => !!fi && !fi.nodes.has(id);
  const dimEdge = (k: string) => !!fi && !fi.edges.has(k);
  const nodeOrder = new Map(layout.nodes.map((n) => [n.id, n.order]));
  const nodeCount = layout.nodes.length;

  return (
    <div ref={canvasRef} className={`dg-flow s-${layout.style}${entering ? " is-enter" : ""}${fi ? " has-focus" : ""}`}
      style={{ width: layout.w, height: layout.h }} role="img" aria-label={aria}>
      {layout.groups.map((g) => {
        const dim = !!fi && !spec.groups?.find((x) => x.id === g.id)?.nodes.some((id) => fi.nodes.has(id));
        return (
          <div key={g.id} className={`dg-group tone-${g.tone ?? "neutral"}${dim ? " is-dim" : ""}`} style={{ left: g.x, top: g.y, width: g.w, height: g.h }}>
            {g.lines[0] && <span className="dg-group-label">{g.lines[0]}</span>}
          </div>
        );
      })}

      <svg className="dg-edges" width={layout.w} height={layout.h} aria-hidden="true">
        {layout.edges.map((e) => {
          const onFlow = flowKeys.has(e.key);
          const cls = `dg-edge tone-${e.e.tone ?? "neutral"}${onFlow ? " is-flow" : ""}${dimEdge(e.key) ? " is-dim" : ""}${fi && !dimEdge(e.key) ? " is-focus" : ""}`;
          const delay = entering ? { animationDelay: `${180 + Math.max(nodeOrder.get(e.from) ?? 0, nodeOrder.get(e.to) ?? 0) * 70}ms` } : undefined;
          return (
            <g key={e.key} className={cls} style={delay}>
              <path ref={(el) => { if (el) pathRefs.current.set(e.key, el); else pathRefs.current.delete(e.key); }}
                className="dg-edge-line" d={e.d} strokeDasharray={e.e.dashed ? "5 5" : undefined} />
              {e.heads.map((h, i) => <path key={i} className="dg-edge-head" d={h} />)}
            </g>
          );
        })}
      </svg>

      {layout.edges.map((e) => e.label && (
        <div key={e.key} className={`dg-elabel tone-${e.e.tone ?? "neutral"}${dimEdge(e.key) ? " is-dim" : ""}${flowKeys.has(e.key) ? " is-flow" : ""}`}
          style={{ left: e.label.x, top: e.label.y, width: e.label.w, height: e.label.h,
            animationDelay: entering ? `${260 + Math.max(nodeOrder.get(e.from) ?? 0, nodeOrder.get(e.to) ?? 0) * 70}ms` : undefined }}>
          {e.label.lines.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      ))}

      <svg className="dg-packets" width={layout.w} height={layout.h} aria-hidden="true">
        <g ref={packetRef} className="dg-packet" style={{ opacity: 0 }}>
          <circle className="dg-packet-halo" r={9} />
          <circle className="dg-packet-dot" r={4.5} />
        </g>
      </svg>

      {layout.nodes.map((n) => {
        const fam = familyOf(n.n.kind);
        const tone = n.n.tone ?? "neutral";
        const bt = n.n.badge ? badgeTone(n.n.badge, n.n.tone) : "neutral";
        const st = { left: n.x, top: n.y, width: n.w, height: n.h, animationDelay: entering ? `${n.order * (nodeCount > 8 ? 45 : 70)}ms` : undefined } as CSSProperties;
        return (
          <div key={n.id} ref={(el) => { if (el) nodeRefs.current.set(n.id, el); else nodeRefs.current.delete(n.id); }}
            className={`dg-node fam-${fam} tone-${tone}${dimNode(n.id) ? " is-dim" : ""}${fi && !dimNode(n.id) ? " is-focus" : ""}`} style={st}>
            <div className="dg-node-icon"><Icon kind={n.n.kind} size={20} /></div>
            <div className="dg-node-text">
              <div className="dg-node-label">{n.label.map((l, i) => <span key={i}>{l}</span>)}</div>
              {n.sub.length > 0 && <div className="dg-node-sub">{n.sub.map((l, i) => <span key={i}>{l}</span>)}</div>}
            </div>
            {n.n.badge && <span className={`dg-badge tone-${bt}`}>{n.n.badge}</span>}
          </div>
        );
      })}
      {reduced && steps.length > 0 && (
        <svg className="dg-steps" width={layout.w} height={layout.h} aria-hidden="true">
          {steps.map((s, i) => {
            const pts = s.rev ? [...s.e.pts].reverse() : s.e.pts;
            const pt = pointAlong(pts, Math.min(2, polyLen(pts) / 2));
            return <g key={i} transform={`translate(${pt.x} ${pt.y})`}><circle r={9} /><text dy="0.35em" textAnchor="middle">{i + 1}</text></g>;
          })}
        </svg>
      )}

    </div>
  );
}

function pointAlong(pts: Pt[], d: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= L) { const k = d / (L || 1); return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }; }
    d -= L;
  }
  return pts[pts.length - 1];
}
