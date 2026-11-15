/* Diagram engine: renders every `Visual` kind. Owned by the diagram-engine agent. */
import { useState, type ReactNode } from "react";
import type { Visual as V } from "@/content/types";
import { FlowDiagram } from "./flow";
import { SequenceDiagram } from "./sequence";
import { Inline } from "./text";
import "./diagram.css";

export function Visual({ visual }: { visual: V }) {
  let body: ReactNode;
  switch (visual.kind) {
    case "flow": body = <div className="dg-canvas"><FlowDiagram spec={visual.spec} /></div>; break;
    case "sequence": body = <div className="dg-canvas"><SequenceDiagram spec={visual.spec} /></div>; break;
    case "table": body = <Table headers={visual.headers} rows={visual.rows} />; break;
    case "code": body = <Code lang={visual.lang} code={visual.code} />; break;
    case "stats": body = <Stats items={visual.items} />; break;
    case "compare": body = <Compare left={visual.left} right={visual.right} />; break;
    default: body = null;
  }
  return (
    <figure className={`dg dg-k-${visual.kind}`}>
      {body}
      {visual.caption && <figcaption className="dg-caption"><Inline text={visual.caption} /></figcaption>}
    </figure>
  );
}

/* ---------------- table ---------------- */
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length));
  return (
    <div className="dg-table-wrap" tabIndex={0} role="region" aria-label="Table, scrolls sideways on small screens">
      <table className="dg-table" style={{ minWidth: cols > 2 ? cols * 120 : undefined }}>
        {headers.length > 0 && (
          <thead><tr>{headers.map((h, i) => <th key={i} scope="col"><Inline text={h} /></th>)}</tr></thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{Array.from({ length: cols }, (_, j) => j === 0
              ? <th key={j} scope="row"><Inline text={r[j] ?? ""} /></th>
              : <td key={j} className={/^[\s$~≈<>+\-]*[\d.,]+\s*(%|ms|s|x|Mbps|Gbps|Tbps|GB|TB|PB|MB|KB)?$/.test(r[j] ?? "") ? "is-num" : undefined}><Inline text={r[j] ?? ""} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- code ---------------- */
type Tok = { t: string; c?: "com" | "str" | "key" | "num" | "tag" };
function highlight(code: string, lang: string): Tok[][] {
  const hls = /m3u8|hls/i.test(lang);
  const hashComments = /^(sh|bash|shell|zsh|yaml|yml|py|python|vcl|nginx|conf|toml|ini|dockerfile|ruby|rb|text|txt|promql)$/i.test(lang);
  const slashComments = /^(js|javascript|ts|typescript|tsx|jsx|go|java|c|cpp|rust|rs|json5|swift|kotlin|vcl|scala|csharp|cs)$/i.test(lang);
  const http = /^(http|https|headers?)$/i.test(lang);
  return code.replace(/\t/g, "  ").split("\n").map((line) => {
    const out: Tok[] = [];
    if (hls) {
      if (/^\s*#EXT/.test(line)) {
        const m = /^(\s*#EXT[^:]*)(:?)(.*)$/.exec(line)!;
        out.push({ t: m[1], c: "tag" }, { t: m[2] });
        tokenizeRest(m[3], out, /[A-Z0-9-]+(?==)/g);
        return out;
      }
      if (/^\s*#/.test(line)) return [{ t: line, c: "com" }];
      return [{ t: line, c: "str" }];
    }
    if (http) {
      const m = /^([A-Za-z0-9-]+)(:)(.*)$/.exec(line);
      if (m) { out.push({ t: m[1], c: "key" }, { t: m[2] }); tokenizeRest(m[3], out); return out; }
      const req = /^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH|HTTP\/[\d.]+)(\s.*)?$/.exec(line);
      if (req) { out.push({ t: req[1], c: "tag" }); tokenizeRest(req[2] ?? "", out); return out; }
    }
    // comments
    let body = line, comment = "";
    const cm = (hashComments ? /(^|\s)#.*$/ : slashComments ? /(^|\s)\/\/.*$/ : /(^|\s)(\/\/|#|--)\s.*$/).exec(line);
    if (cm && !/["'][^"']*$/.test(line.slice(0, cm.index))) { body = line.slice(0, cm.index + cm[1].length); comment = line.slice(cm.index + cm[1].length); }
    // keys: `key:` at line start (yaml), `"key":` (json), `key =` (toml/hcl)
    const km = /^(\s*-?\s*)("[^"]+"|[A-Za-z_][\w.-]*)(\s*)(:(?!\/)|=)(.*)$/.exec(body);
    if (km) { out.push({ t: km[1] }, { t: km[2], c: "key" }, { t: km[3] + km[4] }); tokenizeRest(km[5], out); }
    else tokenizeRest(body, out);
    if (comment) out.push({ t: comment, c: "com" });
    return out;
  });
}
function tokenizeRest(s: string, out: Tok[], keyRe?: RegExp) {
  const re = new RegExp(`("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(\\b\\d+(?:\\.\\d+)?(?:ms|s|m|h|d|k|M|G|%)?\\b)${keyRe ? `|(${keyRe.source})` : ""}`, "g");
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    out.push({ t: m[0], c: m[1] ? "str" : m[2] ? "num" : "key" });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
}

function Code({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const lines = highlight(code.replace(/\n+$/, ""), lang);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="dg-code">
      <div className="dg-code-bar">
        <span className="dg-code-lang">{lang || "text"}</span>
        <button type="button" className="dg-code-copy" onClick={copy} aria-label="Copy code">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {copied ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" /><path d="M15.5 8.5V6.5A2.5 2.5 0 0 0 13 4H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2" /></>}
          </svg>
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="dg-code-pre"><code>{lines.map((l, i) => (
        <span key={i} className="dg-code-line">{l.map((t, j) => t.c ? <span key={j} className={`hl-${t.c}`}>{t.t}</span> : t.t)}{"\n"}</span>
      ))}</code></pre>
    </div>
  );
}

/* ---------------- stats ---------------- */
function Stats({ items }: { items: { value: string; label: string; note?: string }[] }) {
  return (
    <div className={`dg-stats n-${Math.min(items.length, 4)}`}>
      {items.map((s, i) => (
        <div key={i} className="dg-stat">
          <div className="dg-stat-value">{s.value}</div>
          <div className="dg-stat-label"><Inline text={s.label} /></div>
          {s.note && <div className="dg-stat-note"><Inline text={s.note} /></div>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- compare ---------------- */
function Compare({ left, right }: { left: { title: string; points: string[] }; right: { title: string; points: string[] } }) {
  const col = (side: "l" | "r", c: { title: string; points: string[] }) => (
    <div className={`dg-cmp-col side-${side}`}>
      <div className="dg-cmp-title"><span className="dg-cmp-mark" aria-hidden="true">{side === "l" ? "A" : "B"}</span><Inline text={c.title} /></div>
      <ul>{c.points.map((p, i) => <li key={i}><Inline text={p} /></li>)}</ul>
    </div>
  );
  return (
    <div className="dg-cmp">
      {col("l", left)}
      <div className="dg-cmp-vs" aria-hidden="true">vs</div>
      {col("r", right)}
    </div>
  );
}
