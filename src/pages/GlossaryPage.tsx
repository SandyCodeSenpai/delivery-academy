import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/ui";
import { GLOSS } from "./course";
import { PageHead } from "./common";
import { takeGlossaryFocus } from "./glossaryFocus";

const letterOf = (t: string) => { const c = t.trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
const slug = (t: string) => "g-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Render a definition's lite markdown (bold, code, [[term]] links). */
function Def({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  text.split(re).forEach((part, i) => {
    if (part.startsWith("**")) out.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    else if (part.startsWith("`")) out.push(<code key={i}>{part.slice(1, -1)}</code>);
    else if (part.startsWith("[[")) { const [shown, term] = part.slice(2, -2).split("|"); out.push(<a key={i} href={`#glossary`} onClick={(e) => { e.preventDefault(); document.getElementById(slug(term ?? shown))?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>{shown}</a>); }
    else out.push(part.replace(/\*([^*]+)\*/g, "$1"));
  });
  return <>{out}</>;
}

export default function GlossaryPage() {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const sorted = useMemo(() => [...GLOSS].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base", numeric: true })), []);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sorted;
    const starts = sorted.filter((g) => g.term.toLowerCase().startsWith(t));
    const inTerm = sorted.filter((g) => !starts.includes(g) && g.term.toLowerCase().includes(t));
    const inDef = sorted.filter((g) => !starts.includes(g) && !inTerm.includes(g) && g.def.toLowerCase().includes(t));
    return [...starts, ...inTerm, ...inDef];
  }, [q, sorted]);
  const groups = useMemo(() => {
    if (q.trim()) return [{ letter: "", items: filtered }];
    const m = new Map<string, typeof filtered>();
    for (const g of filtered) { const l = letterOf(g.term); if (!m.has(l)) m.set(l, []); m.get(l)!.push(g); }
    return LETTERS.filter((l) => m.has(l)).map((l) => ({ letter: l, items: m.get(l)! }));
  }, [filtered, q]);
  const present = new Set(sorted.map((g) => letterOf(g.term)));

  useEffect(() => {
    const t = takeGlossaryFocus();
    if (!t) return;
    setFocus(t);
    requestAnimationFrame(() => document.getElementById(slug(t))?.scrollIntoView({ block: "center" }));
    const id = setTimeout(() => setFocus(null), 2400);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="page glossary">
      <PageHead eyebrow={`${sorted.length} terms`} title="Glossary" sub="Every term used in the course, in plain words." />
      <div className="gl-tools">
        <label className="gl-search">
          <Icon name="search" size={18} stroke={2} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a term, for example TTL" aria-label="Find a term" spellCheck={false} />
          {q && <button type="button" className="gl-clear" onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size={14} stroke={2.4} /></button>}
        </label>
        {!q.trim() && (
          <nav className="az" aria-label="Jump to letter">
            {LETTERS.map((l) => present.has(l)
              ? <a key={l} href="#glossary" onClick={(e) => { e.preventDefault(); document.getElementById(`gl-${l}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>{l}</a>
              : <span key={l} aria-hidden="true">{l}</span>)}
          </nav>
        )}
      </div>
      {q.trim() && <p className="gl-count" role="status">{filtered.length === 0 ? `No terms match "${q.trim()}".` : `${filtered.length} ${filtered.length === 1 ? "term" : "terms"}`}</p>}
      {groups.map((g) => (
        <section key={g.letter || "results"} className="gl-group" id={g.letter ? `gl-${g.letter}` : undefined} aria-label={g.letter ? `Terms starting with ${g.letter}` : "Results"}>
          {g.letter && <h2 className="gl-letter">{g.letter}</h2>}
          <dl className="gl-list">
            {g.items.map((e) => (
              <div key={e.term} id={slug(e.term)} className={`gl-item${focus === e.term ? " focus" : ""}`}>
                <dt>{e.term}</dt>
                <dd><Def text={e.def} /></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
