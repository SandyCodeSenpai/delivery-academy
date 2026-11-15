import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon, Kbd, Sheet, type IconName } from "@/ui";
import { WIDGET_LIST } from "@/widgets/registry";
import { ALL_LESSONS, COURSE, GLOSS, lessonHref, partColor, plain, stepText } from "./course";
import { setGlossaryFocus } from "./glossaryFocus";

interface Doc { kind: "chapter" | "lesson" | "step" | "term" | "lab"; title: string; sub: string; href: string; color?: string; hay: string; titleHay: string; term?: string }

let INDEX: Doc[] | null = null;
function buildIndex(): Doc[] {
  if (INDEX) return INDEX;
  const docs: Doc[] = [];
  for (const ch of COURSE) {
    const t = plain(ch.title);
    docs.push({ kind: "chapter", title: t, sub: `Chapter ${ch.n} · ${plain(ch.hook)}`, href: `#ch${ch.n}`, color: partColor(ch.part), hay: `${t} ${ch.short} ${plain(ch.hook)}`.toLowerCase(), titleHay: `${t} ${ch.short}`.toLowerCase() });
  }
  for (const f of ALL_LESSONS) {
    const t = plain(f.lesson.title);
    docs.push({ kind: "lesson", title: t, sub: `Chapter ${f.ch.n}, lesson ${f.idx} · ${plain(f.lesson.goal)}`, href: lessonHref(f.ch.n, f.idx), color: partColor(f.ch.part), hay: `${t} ${plain(f.lesson.goal)}`.toLowerCase(), titleHay: t.toLowerCase() });
    f.lesson.steps.forEach((s) => {
      const text = stepText(s);
      if (text) docs.push({ kind: "step", title: t, sub: text, href: lessonHref(f.ch.n, f.idx), color: partColor(f.ch.part), hay: text.toLowerCase(), titleHay: "" });
    });
  }
  for (const w of WIDGET_LIST) docs.push({ kind: "lab", title: w.title, sub: w.summary, href: `#lab-${w.id}`, hay: `${w.title} ${w.summary} lab`.toLowerCase(), titleHay: w.title.toLowerCase() });
  for (const g of GLOSS) docs.push({ kind: "term", title: g.term, sub: plain(g.def), href: "#glossary", hay: `${g.term} ${plain(g.def)}`.toLowerCase(), titleHay: g.term.toLowerCase(), term: g.term });
  INDEX = docs;
  return docs;
}

const KIND_RANK: Record<Doc["kind"], number> = { term: 0, chapter: 1, lesson: 2, lab: 3, step: 5 };
const KIND_LABEL: Record<Doc["kind"], string> = { chapter: "Chapter", lesson: "Lesson", step: "In a lesson", term: "Glossary", lab: "Lab" };
const KIND_ICON: Record<Doc["kind"], IconName> = { chapter: "list", lesson: "play", step: "info", term: "book", lab: "flask" };

function search(q: string): Doc[] {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out: { d: Doc; s: number }[] = [];
  for (const d of buildIndex()) {
    if (!tokens.every((t) => d.hay.includes(t))) continue;
    let s = KIND_RANK[d.kind];
    if (d.titleHay.startsWith(tokens.join(" "))) s -= 4;
    else if (tokens.every((t) => d.titleHay.includes(t))) s -= 2;
    out.push({ d, s });
  }
  out.sort((a, b) => a.s - b.s);
  // Keep step matches from flooding: at most one per lesson.
  const seen = new Set<string>();
  return out.map((x) => x.d).filter((d) => { if (d.kind !== "step") return true; if (seen.has(d.href)) return false; seen.add(d.href); return true; }).slice(0, 40);
}

/** Return a window of text around the first match. */
function snippet(text: string, q: string, len = 120) {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean)[0] ?? "";
  const i = t ? text.toLowerCase().indexOf(t) : -1;
  if (i < 0 || text.length <= len) return text.length > len ? text.slice(0, len) + "…" : text;
  const start = Math.max(0, i - 40);
  return (start > 0 ? "…" : "") + text.slice(start, start + len) + (start + len < text.length ? "…" : "");
}
function Highlight({ text, q }: { text: string; q: string }) {
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 0).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

const SUGGEST = [
  { label: "Delivery Playground", href: "#lab-playground", icon: "flask" as IconName },
  { label: "All labs", href: "#labs", icon: "grid" as IconName },
  { label: "Course overview", href: "#course", icon: "list" as IconName },
  { label: "Glossary", href: "#glossary", icon: "book" as IconName },
];

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => search(q), [q]);
  const items = q.trim() ? results.map((d) => ({ href: d.href, term: d.term })) : SUGGEST.map((s) => ({ href: s.href, term: undefined }));

  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const choose = (i: number) => {
    const it = items[i]; if (!it) return;
    if (it.term) setGlossaryFocus(it.term);
    onClose();
    if (location.hash.slice(1) === it.href.slice(1)) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = it.href.slice(1);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Search the course" width={620}>
      <div className="pal" onKeyDown={onKey}>
        <div className="pal-input">
          <Icon name="search" size={20} stroke={2} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chapters, lessons, labs and terms"
            aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={items.length ? `pal-opt-${sel}` : undefined} spellCheck={false} autoComplete="off" />
          <button type="button" className="pal-close" onClick={onClose}>Close</button>
        </div>
        <div className="pal-list" id="pal-list" role="listbox" aria-label="Results" ref={listRef}>
          {!q.trim() && <div className="pal-group">Go to</div>}
          {!q.trim() && SUGGEST.map((s, i) => (
            <div key={s.href} id={`pal-opt-${i}`} data-i={i} role="option" aria-selected={sel === i} className={`pal-item${sel === i ? " on" : ""}`} onMouseMove={() => setSel(i)} onClick={() => choose(i)}>
              <span className="pal-ico"><Icon name={s.icon} size={18} /></span><span className="pal-main"><span className="pal-title">{s.label}</span></span>
            </div>
          ))}
          {q.trim() && results.length === 0 && <div className="pal-empty">No results for "{q.trim()}". Try a shorter word, such as "cache" or "DNS".</div>}
          {q.trim() && results.map((d, i) => (
            <div key={`${d.kind}-${d.href}-${i}`} id={`pal-opt-${i}`} data-i={i} role="option" aria-selected={sel === i} className={`pal-item${sel === i ? " on" : ""}`}
              onMouseMove={() => setSel(i)} onClick={() => choose(i)} style={{ "--pc": d.color ?? "var(--muted)" } as CSSProperties}>
              <span className={`pal-ico k-${d.kind}`}><Icon name={KIND_ICON[d.kind]} size={18} /></span>
              <span className="pal-main">
                <span className="pal-title"><Highlight text={d.title} q={q} /></span>
                <span className="pal-sub"><Highlight text={snippet(d.sub, q)} q={q} /></span>
              </span>
              <span className="pal-kind">{KIND_LABEL[d.kind]}</span>
            </div>
          ))}
        </div>
        <div className="pal-foot" aria-hidden="true">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span><span><Kbd>Enter</Kbd> open</span><span><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </Sheet>
  );
}
