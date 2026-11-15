/** Glossary lookup for [[term]] links: case-insensitive, with short forms and simple plurals. */
import { GLOSSARY } from "@/content/glossary";
import type { GlossaryEntry } from "@/content/types";

export const normTerm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
const isAcronym = (s: string) => /^[A-Z0-9][A-Z0-9 /.-]*$/.test(s.trim());
let INDEX: Map<string, GlossaryEntry> | null = null;

function glossaryIndex(): Map<string, GlossaryEntry> {
  if (INDEX) return INDEX;
  const m = new Map<string, GlossaryEntry>();
  const add = (k: string, e: GlossaryEntry) => { const n = normTerm(k); if (n && !m.has(n)) m.set(n, e); };
  // Full terms win over any alias.
  for (const e of GLOSSARY) add(e.term, e);
  for (const e of GLOSSARY) {
    const p = e.term.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!p) continue;
    const [, base, paren] = p;
    add(base, e);
    // "ABR (adaptive bitrate)" and "Time to first byte (TTFB)": both halves name the term.
    // "Drift (config)" or "cenc (mode)": the parenthesis is only a qualifier, so skip it.
    if (isAcronym(base) || isAcronym(paren)) add(paren, e);
  }
  for (const e of GLOSSARY) {
    const base = e.term.replace(/\s*\([^)]*\)\s*$/, "");
    if (base.includes(" / ")) base.split(" / ").forEach((x) => add(x, e));
  }
  INDEX = m;
  return m;
}

/** Find a glossary entry by term, short form or simple plural. */
export function findGlossary(term: string): GlossaryEntry | undefined {
  const m = glossaryIndex();
  const n = normTerm(term);
  const tries = [n, n.replace(/-/g, " "), n.replace(/ /g, "-")];
  if (n.endsWith("ies")) tries.push(n.slice(0, -3) + "y");
  if (n.endsWith("es")) tries.push(n.slice(0, -2));
  if (n.endsWith("s")) tries.push(n.slice(0, -1));
  for (const t of tries) { const e = m.get(t); if (e) return e; }
  return undefined;
}

