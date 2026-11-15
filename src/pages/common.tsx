import { Component, useEffect, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Chip, Icon, springs } from "@/ui";
import type { WidgetMeta } from "@/widgets/registry";
import { useReducedMotion } from "@/lib/hooks";
import { chapterByN, partColor } from "./course";

/** Catches render errors in children (content or widgets still being written) and shows a calm fallback. */
export class Boundary extends Component<{ children: ReactNode; fallback: (err: Error) => ReactNode; resetKey?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error, info: ErrorInfo) { console.warn("[shell] section failed to render:", err.message, info.componentStack?.split("\n")[1] ?? ""); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() { return this.state.err ? this.props.fallback(this.state.err) : this.props.children; }
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="pg-back" href={href}><Icon name="chevron-left" size={18} stroke={2} />{children}</a>;
}

/** Large-title page header (Apple style). */
export function PageHead({ eyebrow, title, sub, dot, children }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; dot?: string; children?: ReactNode }) {
  return (
    <header className="pg-head">
      {eyebrow && <div className="pg-eyebrow">{dot && <span className="pg-dot" style={{ background: dot }} />}{eyebrow}</div>}
      <h1 className="pg-title">{title}</h1>
      {sub && <p className="pg-sub">{sub}</p>}
      {children}
    </header>
  );
}

export function LabCard({ w, done, compact, hideChapter }: { w: WidgetMeta; done?: boolean; compact?: boolean; hideChapter?: boolean }) {
  const ch = chapterByN(w.chapter);
  const color = partColor(ch?.part ?? 0);
  return (
    <a href={`#lab-${w.id}`} className={`lab-card${compact ? " compact" : ""}`} style={{ "--pc": color } as CSSProperties}>
      <div className="lab-card-top">
        <span className="lab-icon"><Icon name="flask" size={20} /></span>
        {done ? <Chip tone="good"><Icon name="check" size={13} stroke={2.4} />Done</Chip> : hideChapter ? null : <span className="lab-ch">Chapter {w.chapter}</span>}
      </div>
      <div className="lab-card-title">{w.title}</div>
      <p className="lab-card-sum">{w.summary}</p>
      <span className="lab-card-go">Open lab<Icon name="arrow-right" size={16} stroke={2} /></span>
    </a>
  );
}

/** Small animated schematic of the delivery chain for the Playground card. */
export function ChainArt() {
  const reduce = useReducedMotion();
  const nodes = [
    { x: 40, label: "Viewer" }, { x: 150, label: "Edge" }, { x: 260, label: "Shield" }, { x: 370, label: "Origin" },
  ];
  return (
    <svg className="chain-art" viewBox="0 0 410 120" role="img" aria-label="A request travels from the viewer to the edge, the shield and the origin">
      <line x1={40} x2={370} y1={52} y2={52} className="chain-line" />
      {nodes.map((n, i) => (
        <g key={n.label} transform={`translate(${n.x} 52)`}>
          <rect x={-26} y={-22} width={52} height={44} rx={13} className={`chain-node${i === 1 ? " hot" : ""}`} />
          <ChainGlyph i={i} />
          <text y={44} textAnchor="middle" className="chain-label">{n.label}</text>
        </g>
      ))}
      {!reduce && (
        <motion.circle r={5} cy={52} className="chain-packet"
          initial={{ cx: 66, opacity: 0 }} animate={{ cx: [66, 124, 176, 234, 286, 344, 286, 234, 176, 124, 66], opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] }}
          transition={{ duration: 4.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2 }} />
      )}
    </svg>
  );
}
function ChainGlyph({ i }: { i: number }) {
  const p = { fill: "none", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "chain-glyph" };
  if (i === 0) return <g {...p}><rect x={-10} y={-9} width={20} height={13} rx={2.5} /><path d="M-4 8h8" /></g>;
  if (i === 3) return <g {...p}><ellipse cx={0} cy={-7} rx={9} ry={3.5} /><path d="M-9 -7v12c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-12" /></g>;
  return <g {...p}><rect x={-10} y={-10} width={20} height={8} rx={2} /><rect x={-10} y={1} width={20} height={8} rx={2} /><path d="M-6 -6h.01M-6 5h.01" /></g>;
}

/** Count-up number for stats (respects reduced motion). */
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setV(value); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(value * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduce]);
  return <span className="tnum">{v.toLocaleString("en-US")}</span>;
}

export const fadeUp = (reduce: boolean, delay = 0) => reduce
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15, delay } }
  : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { ...springs.smooth, delay } };

/** Turn plain-text sources into nodes with clickable URLs. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)>\]]+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer noopener">{p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : <span key={i}>{p}</span>))}</>;
}
