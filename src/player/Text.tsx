/**
 * Lite-markdown renderer shared by the lesson player and pages.
 *   **bold**  *italic*  `code`  "- " bullet lines  blank line = new paragraph
 *   [[term]] and [[shown text|term]] link a glossary entry (case-insensitive; a parenthetical
 *   short form also matches, e.g. [[ABR]] finds "ABR (adaptive bitrate)").
 * A glossary link renders as a dotted-underline chip: a popover with a fine pointer, a bottom sheet on phones.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { GlossaryEntry } from "@/content/types";
import { useReducedMotion } from "@/lib/hooks";
import { findGlossary, normTerm } from "./glossaryIndex";
import "./text.css";

/* ---------------- Inline parsing ---------------- */

const INLINE = /`([^`]+)`|\[\[([^\]]+?)\]\]|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*?[^*\s])?)\*/g;

/** Render one line of lite markdown (no paragraphs or bullets). */
function renderInline(s: string, keyPrefix = "i", links = true): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const key = `${keyPrefix}-${k++}`;
    if (m[1] !== undefined) out.push(<code key={key} className="tx-code">{m[1]}</code>);
    else if (m[2] !== undefined) {
      const [shown, target] = m[2].includes("|") ? m[2].split("|", 2) : [m[2], m[2]];
      const entry = links ? findGlossary(target.trim()) : undefined;
      out.push(entry
        ? <GlossaryTerm key={key} entry={entry}>{renderInline(shown.trim(), key)}</GlossaryTerm>
        : <span key={key} data-glossary-missing={links ? target.trim() : undefined}>{renderInline(shown.trim(), key, links)}</span>);
    } else if (m[3] !== undefined) out.push(<strong key={key}>{renderInline(m[3], key, links)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={key}>{renderInline(m[4], key, links)}</em>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Inline lite markdown, for titles, options and labels. `links={false}` renders glossary links as plain text (use inside buttons). */
export function Inline({ text, links = true }: { text: string; links?: boolean }) {
  return <>{renderInline(text, "i", links)}</>;
}

/** Block lite markdown: paragraphs and "- " bullet lists. */
export function Text({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").trim().split(/\n[ \t]*\n/);
  const nodes: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split("\n");
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => { if (para.length) { const k = `p${bi}-${nodes.length}`; nodes.push(<p key={k}>{renderInline(para.join(" "), k)}</p>); para = []; } };
    const flushList = () => {
      if (list.length) {
        const k = `l${bi}-${nodes.length}`;
        nodes.push(<ul key={k}>{list.map((li, i) => <li key={i}>{renderInline(li, `${k}-${i}`)}</li>)}</ul>);
        list = [];
      }
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (/^[-•] /.test(line)) { flushPara(); list.push(line.slice(2).trim()); }
      else if (line) { flushList(); para.push(line); }
    }
    flushPara(); flushList();
  });
  return <div className={`tx ${className}`}>{nodes}</div>;
}

/* ---------------- Glossary chip, popover and sheet ---------------- */

const wantsSheet = () =>
  typeof matchMedia !== "undefined" && (matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 600px)").matches);

/** Esc handling that wins over page-level shortcuts (runs in the capture phase). */
function useEscape(onEsc: () => void) {
  const ref = useRef(onEsc); ref.current = onEsc;
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); ref.current(); } };
    window.addEventListener("keydown", f, true);
    return () => window.removeEventListener("keydown", f, true);
  }, []);
}

export function GlossaryTerm({ entry, children }: { entry: GlossaryEntry; children: ReactNode }) {
  const [open, setOpen] = useState<null | "pop" | "sheet">(null);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(null); requestAnimationFrame(() => ref.current?.focus({ preventScroll: true })); }, []);
  return (
    <>
      <button
        ref={ref} type="button" className="tx-term" data-glossary={entry.term}
        aria-haspopup="dialog" aria-expanded={!!open}
        onClick={(e) => { e.stopPropagation(); if (open) close(); else setOpen(wantsSheet() ? "sheet" : "pop"); }}
      >{children}</button>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open === "pop" && <TermPopover key="pop" entry={entry} anchor={ref} onClose={close} />}
          {open === "sheet" && <TermSheet key="sheet" entry={entry} onClose={close} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function TermBody({ entry, onClose, titleId }: { entry: GlossaryEntry; onClose: () => void; titleId: string }) {
  return (
    <>
      <div className="tx-pop-head">
        <h3 id={titleId} className="tx-pop-term">{entry.term}</h3>
        <button type="button" className="tx-pop-close" onClick={onClose} aria-label="Close definition">
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
      <p className="tx-pop-def">{entry.def}</p>
    </>
  );
}

/** Keep Tab inside the dialog. */
function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const f = [...e.currentTarget.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")];
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function TermPopover({ entry, anchor, onClose }: { entry: GlossaryEntry; anchor: React.RefObject<HTMLElement>; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; arrow: number } | null>(null);
  const reduced = useReducedMotion();
  const titleId = `gl-${normTerm(entry.term).replace(/[^a-z0-9]+/g, "-")}`;
  useEscape(onClose);

  const place = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect(); const el = box.current;
    if (!a || !el) return;
    const W = el.offsetWidth, H = el.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10;
    const above = a.bottom + gap + H > vh - 16 && a.top - gap - H > 16;
    const cx = a.left + a.width / 2;
    const left = Math.max(16, Math.min(vw - W - 16, cx - W / 2));
    setPos({ left, top: above ? a.top - gap - H : a.bottom + gap, above, arrow: Math.max(18, Math.min(W - 18, cx - left)) });
  }, [anchor]);

  useLayoutEffect(() => { place(); }, [place]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(".tx-pop-close")?.focus({ preventScroll: true });
    const onScroll = () => place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    addEventListener("scroll", onScroll, true); addEventListener("resize", onScroll);
    document.addEventListener("pointerdown", onDown, true);
    return () => { removeEventListener("scroll", onScroll, true); removeEventListener("resize", onScroll); document.removeEventListener("pointerdown", onDown, true); };
  }, [place, onClose, anchor]);

  return (
    <motion.div
      ref={box} role="dialog" aria-modal="false" aria-labelledby={titleId} className={`tx-pop ${pos?.above ? "above" : "below"}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, ["--arrow" as string]: `${pos?.arrow ?? 24}px` }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: pos?.above ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: { duration: 0.12 } }}
      transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 34 }}
      onKeyDown={trapTab}
    >
      <TermBody entry={entry} onClose={onClose} titleId={titleId} />
    </motion.div>
  );
}

function TermSheet({ entry, onClose }: { entry: GlossaryEntry; onClose: () => void }) {
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = `gls-${normTerm(entry.term).replace(/[^a-z0-9]+/g, "-")}`;
  useEscape(onClose);
  useEffect(() => { panel.current?.querySelector<HTMLElement>(".tx-pop-close")?.focus({ preventScroll: true }); }, []);
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 80 || info.velocity.y > 500) onClose(); };
  return (
    <div className="tx-sheet-root">
      <motion.div className="tx-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <motion.div
        ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="tx-sheet"
        initial={reduced ? { opacity: 0 } : { y: "100%" }} animate={reduced ? { opacity: 1 } : { y: 0 }} exit={reduced ? { opacity: 0 } : { y: "100%" }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 38 }}
        drag={reduced ? false : "y"} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}
        onKeyDown={trapTab}
      >
        <div className="tx-grabber" aria-hidden="true" />
        <TermBody entry={entry} onClose={onClose} titleId={titleId} />
      </motion.div>
    </div>
  );
}
