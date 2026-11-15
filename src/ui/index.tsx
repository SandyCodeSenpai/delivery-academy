/**
 * Shared UI primitives. APIs are a contract for widget and page authors.
 * The design lead may restyle (ui.css) and extend, but must keep these props working.
 */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion as useFmReducedMotion } from "framer-motion";
import type { Tone, CalloutType } from "@/content/types";
import { useWidth } from "@/lib/hooks";
import "./ui.css";

export const toneVar = (t?: Tone) =>
  t === "good" ? "var(--good)" : t === "bad" ? "var(--bad)" : t === "warn" ? "var(--warn)" : t === "accent" ? "var(--accent)" : "var(--ink)";

/** Springs (Apple response/damping mapped to framer-motion, mass 1). Use for movement; tween color/opacity. */
export const springs = {
  smooth: { type: "spring", stiffness: 195, damping: 28 },   // step transitions, page pushes, progress
  snappy: { type: "spring", stiffness: 440, damping: 36 },   // thumbs, switches, presses
  sheet: { type: "spring", stiffness: 158, damping: 22 },    // sheets and popovers
  bouncy: { type: "spring", stiffness: 250, damping: 22 },   // correct-answer check, XP, streak only
} as const;

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "good" | "tinted" | "plain";
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "s" | "m" | "l"; block?: boolean };
/** primary = accent filled (one per screen). good/danger = filled result buttons (Continue after an answer).
 *  secondary = quiet surface. tinted = accent-soft. ghost = text on hover surface. plain = link-like. */
export function Button({ variant = "secondary", size = "m", block, className = "", ...rest }: BtnProps) {
  return <button type="button" className={`ui-btn ui-btn-${variant} ui-btn-${size}${block ? " ui-btn-block" : ""} ${className}`} {...rest} />;
}

/** Icon-only button. `label` is required for screen readers. */
export function IconButton({ label, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={`ui-iconbtn ${className}`} {...rest}>{children}</button>;
}

export function Slider(p: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string; disabled?: boolean }) {
  const id = useId();
  const pct = ((p.value - p.min) / (p.max - p.min || 1)) * 100;
  return (
    <div className="ui-slider">
      <div className="ui-slider-top"><label htmlFor={id}>{p.label}</label><output htmlFor={id}>{p.format ? p.format(p.value) : p.value}</output></div>
      <input id={id} type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} disabled={p.disabled}
        style={{ "--pct": `${pct}%` } as CSSProperties} onChange={(e) => p.onChange(Number(e.target.value))} />
      {p.hint && <div className="ui-hint">{p.hint}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>(p: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="ui-seg">
      {p.label && <div className="ui-seg-label">{p.label}</div>}
      <div className="ui-seg-track" role="radiogroup" aria-label={p.label}>
        {p.options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === p.value} disabled={p.disabled}
            className={o.value === p.value ? "on" : ""} onClick={() => p.onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Toggle(p: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="ui-toggle">
      <input id={id} type="checkbox" role="switch" checked={p.checked} disabled={p.disabled} onChange={(e) => p.onChange(e.target.checked)} />
      <label htmlFor={id}><span className="ui-toggle-track" aria-hidden="true"><span /></span><span className="ui-toggle-text">{p.label}{p.hint && <small>{p.hint}</small>}</span></label>
    </div>
  );
}

export function Stat(p: { label: string; value: ReactNode; unit?: string; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className={`ui-stat tone-${p.tone ?? "neutral"}`}>
      <div className="ui-stat-label">{p.label}</div>
      <div className="ui-stat-value">{p.value}{p.unit && <span className="ui-stat-unit">{p.unit}</span>}</div>
      {p.sub && <div className="ui-stat-sub">{p.sub}</div>}
    </div>
  );
}
export const StatGrid = ({ children }: { children: ReactNode }) => <div className="ui-stats">{children}</div>;

/** The canvas panel where a simulation draws (dotted background). */
export function Stage({ children, height, className = "" }: { children: ReactNode; height?: number | string; className?: string }) {
  return <div className={`ui-stage ${className}`} style={height ? { minHeight: height } : undefined}>{children}</div>;
}

/** Standard widget layout: stage + controls. Side by side when wide (container >= 760px), stacked when narrow. */
export function WidgetFrame({ stage, controls, footer }: { stage: ReactNode; controls?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="ui-wframe">
      <div className="ui-wframe-grid">
        <div className="ui-wframe-stage">{stage}</div>
        {controls && <div className="ui-wframe-controls">{controls}</div>}
      </div>
      {footer && <div className="ui-wframe-footer">{footer}</div>}
    </div>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-chip tone-${tone}`}>{children}</span>;
}

const CALLOUT_LABEL: Record<CalloutType, string> = { staff: "Staff lens", mistake: "Common mistake", industry: "In industry", crunchyroll: "At Crunchyroll" };
export function Callout({ type, children }: { type: CalloutType; children: ReactNode }) {
  return <aside className={`ui-callout c-${type}`}><div className="ui-callout-label">{CALLOUT_LABEL[type]}</div><div className="ui-callout-body">{children}</div></aside>;
}

export interface LogEntry { id: string | number; text: ReactNode; tone?: Tone; tag?: string }
/** Event log (newest last). */
export function Log({ entries, max = 8, title }: { entries: LogEntry[]; max?: number; title?: string }) {
  const shown = entries.slice(-max);
  return (
    <div className="ui-log" aria-live="polite">
      {title && <div className="ui-log-title">{title}</div>}
      {shown.length === 0 && <div className="ui-log-empty">Nothing yet.</div>}
      {shown.map((e) => (
        <div key={e.id} className={`ui-log-row tone-${e.tone ?? "neutral"}`}>{e.tag && <span className="ui-log-tag">{e.tag}</span>}<span>{e.text}</span></div>
      ))}
    </div>
  );
}

export interface Series { id: string; label: string; color: string; points: [number, number][]; dashed?: boolean; area?: boolean }
/** Minimal responsive SVG line chart. Colors: pass CSS vars like "var(--p2)". */
export function LineChart(p: {
  series: Series[]; xMax?: number; yMax?: number; xMin?: number; yMin?: number; height?: number;
  xLabel?: string; yLabel?: string; xFmt?: (v: number) => string; yFmt?: (v: number) => string;
  bands?: { y0: number; y1: number; tone: Tone; label?: string }[]; markers?: { x: number; label: string }[]; hLines?: { y: number; label: string; tone?: Tone }[];
}) {
  // viewBox width = real pixel width, so tick and axis text render at true size (never below 12px on phones).
  const boxRef = useRef<HTMLDivElement>(null);
  const measured = useWidth(boxRef);
  const W = Math.max(240, Math.round(measured || 640)), H = p.height ?? 220, L = W < 420 ? 40 : 48, R = 12, T = 12, B = 30;
  const all = p.series.flatMap((s) => s.points);
  const xMin = p.xMin ?? 0, yMin = p.yMin ?? 0;
  const xMax = p.xMax ?? Math.max(1, ...all.map((q) => q[0]));
  const yMax = p.yMax ?? Math.max(1, ...all.map((q) => q[1])) * 1.1;
  const sx = (x: number) => L + ((x - xMin) / (xMax - xMin || 1)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - T - B);
  const nx = W < 420 ? 3 : 4;
  const ticks = (a: number, b: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const xf = p.xFmt ?? ((v: number) => String(Math.round(v))), yf = p.yFmt ?? ((v: number) => String(Math.round(v)));
  return (
    <div className="ui-chart" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={p.series.map((s) => s.label).join(", ")}>
        {p.bands?.map((b, i) => <rect key={i} x={L} width={W - L - R} y={sy(b.y1)} height={Math.max(0, sy(b.y0) - sy(b.y1))} style={{ fill: toneVar(b.tone), opacity: 0.08 }} />)}
        {ticks(yMin, yMax).map((v, i) => (<g key={i}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="ui-chart-grid" /><text x={L - 6} y={sy(v) + 4} textAnchor="end" className="ui-chart-tick">{yf(v)}</text></g>))}
        {ticks(xMin, xMax, nx).map((v, i) => <text key={i} x={sx(v)} y={H - 10} textAnchor="middle" className="ui-chart-tick">{xf(v)}</text>)}
        {p.hLines?.map((h, i) => (<g key={i}><line x1={L} x2={W - R} y1={sy(h.y)} y2={sy(h.y)} style={{ stroke: toneVar(h.tone ?? "warn") }} strokeDasharray="5 4" /><text x={W - R} y={sy(h.y) - 4} textAnchor="end" className="ui-chart-tick" style={{ fill: toneVar(h.tone ?? "warn") }}>{h.label}</text></g>))}
        {p.markers?.map((m, i) => (<g key={i}><line x1={sx(m.x)} x2={sx(m.x)} y1={T} y2={H - B} className="ui-chart-marker" /><text x={sx(m.x) + 4} y={T + 10} className="ui-chart-tick">{m.label}</text></g>))}
        {p.series.map((s) => {
          if (!s.points.length) return null;
          const d = s.points.map((q, i) => `${i ? "L" : "M"}${sx(q[0]).toFixed(1)},${sy(q[1]).toFixed(1)}`).join("");
          return (<g key={s.id}>
            {s.area && <path d={`${d}L${sx(s.points[s.points.length - 1][0])},${sy(yMin)}L${sx(s.points[0][0])},${sy(yMin)}Z`} style={{ fill: s.color, opacity: 0.12 }} />}
            <path d={d} fill="none" style={{ stroke: s.color }} strokeWidth={2.25} strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          </g>);
        })}
        {p.xLabel && <text x={W - R} y={H - B - 6} textAnchor="end" className="ui-chart-axis">{p.xLabel}</text>}
        {p.yLabel && <text x={L + 4} y={T + 10} className="ui-chart-axis">{p.yLabel}</text>}
      </svg>
      {p.series.length > 1 && <div className="ui-chart-legend">{p.series.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.label}</span>)}</div>}
    </div>
  );
}

/* ---------------- Added primitives (design lead) ---------------- */

export type IconName = "check" | "x" | "lock" | "chevron-right" | "chevron-left" | "chevron-down" | "search" | "sun" | "moon" | "play" | "pause" | "reset"
  | "flask" | "book" | "clock" | "bolt" | "target" | "arrow-right" | "home" | "grid" | "list" | "star" | "info" | "external" | "sparkle";
const ICON_PATHS: Record<IconName, ReactNode> = {
  "check": <path d="M5 12.5l4.5 4.5L19 7.5" />,
  "x": <path d="M6 6l12 12M18 6L6 18" />,
  "lock": <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></>,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-left": <path d="M14.5 6l-6 6 6 6" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  "search": <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  "sun": <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  "moon": <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" />,
  "play": <path d="M8 5.5v13l10.5-6.5z" />,
  "pause": <path d="M8.5 5.5v13M15.5 5.5v13" />,
  "reset": <><path d="M4.5 12a7.5 7.5 0 102.2-5.3" /><path d="M4.5 4.5v4h4" /></>,
  "flask": <><path d="M9.5 3.5h5M10.5 3.5v6l-5.2 8.6A1.6 1.6 0 006.7 20.5h10.6a1.6 1.6 0 001.4-2.4L13.5 9.5v-6" /><path d="M7.5 15h9" /></>,
  "book": <><path d="M4.5 5.5A2 2 0 016.5 3.5h12v15h-12a2 2 0 00-2 2z" /><path d="M4.5 20.5a2 2 0 012-2h12v2.5" /></>,
  "clock": <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  "bolt": <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  "target": <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" /></>,
  "arrow-right": <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  "home": <><path d="M4 10.5L12 4l8 6.5" /><path d="M6 9v10.5h12V9" /></>,
  "grid": <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  "list": <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  "star": <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />,
  "info": <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.01" /></>,
  "external": <><path d="M13.5 4.5h6v6M19.5 4.5L11 13" /><path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" /></>,
  "sparkle": <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
};
/** Line icon, 24px grid, 1.75px stroke, round caps. Color = currentColor. Decorative unless `label` is given. */
export function Icon({ name, size = 20, stroke = 1.75, label, style, className }: { name: IconName; size?: number; stroke?: number; label?: string; style?: CSSProperties; className?: string }) {
  const filled = name === "play";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{ICON_PATHS[name]}</svg>
  );
}

/** Surface card. `raised` = shadow instead of hairline. Pass `href` to render a link card. */
export function Card({ children, raised, pad = true, href, className = "", style, onClick, label }: { children: ReactNode; raised?: boolean; pad?: boolean; href?: string; className?: string; style?: CSSProperties; onClick?: () => void; label?: string }) {
  const cls = `ui-card${raised ? " raised" : ""}${pad ? " pad" : ""} ${className}`;
  if (href) return <a href={href} className={cls} style={style} aria-label={label}>{children}</a>;
  if (onClick) return <button type="button" className={cls} style={style} onClick={onClick} aria-label={label}>{children}</button>;
  return <div className={cls} style={style}>{children}</div>;
}

/** Thin progress capsule. value 0..1. color defaults to accent (pass a part color like "var(--p3)"). */
export function ProgressBar({ value, color, height = 6, label }: { value: number; color?: string; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="ui-progress" role="progressbar" aria-label={label ?? "Progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      style={{ "--h": `${height}px`, "--fill": color } as CSSProperties}>
      <span style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/** Circular progress ring. value 0..1. */
export function Ring({ value, size = 28, stroke = 3.5, color, children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value || 0));
  return (
    <span style={{ position: "relative", display: "inline-grid", placeItems: "center", width: size, height: size }} role={label ? "img" : undefined} aria-label={label}>
      <svg className="ui-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ "--ring": color, transform: "rotate(-90deg)", position: "absolute", inset: 0 } as CSSProperties} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ opacity: v > 0 ? 1 : 0 }} />
      </svg>
      {children && <span style={{ position: "relative" }}>{children}</span>}
    </span>
  );
}

/** Small label above a title, with an optional part-color dot. */
export function Eyebrow({ children, dot }: { children: ReactNode; dot?: string }) {
  return <div className="ui-eyebrow">{dot && <span className="ui-dot" style={{ "--dot": dot } as CSSProperties} />}{children}</div>;
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="ui-kbd">{children}</kbd>;

/** Modal sheet: centered dialog on desktop, bottom sheet on phones. Esc and scrim close it; focus is trapped and restored. */
export function Sheet({ open, onClose, children, label, width = 560 }: { open: boolean; onClose: () => void; children: ReactNode; label: string; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useFmReducedMotion();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => { const el = ref.current?.querySelector<HTMLElement>("[autofocus],input,button,[href],[tabindex]:not([tabindex='-1'])"); (el ?? ref.current)?.focus(); }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>("input,button,[href],select,textarea,[tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled"));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const ov = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); document.body.style.overflow = ov; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="ui-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <div className="ui-sheet-wrap" key="wrap">
            <motion.div ref={ref} className="ui-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ "--sheet-w": `${width}px` } as CSSProperties}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={reduce ? { duration: 0.15 } : springs.sheet}>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
