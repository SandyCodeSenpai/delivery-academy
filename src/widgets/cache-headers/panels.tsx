import { useEffect, useRef } from "react";
import {
  CLIENTS, OBJ, OUTCOME_COLOR, OUTCOME_LABEL, browserPolicy, cdnPolicy, fmtDur, headerLines, variantCount,
  type Headers, type Policy, type Result,
} from "./sim";

/** The response headers as the origin sends them. Changed lines flash once. */
export function HeaderBlock({ h }: { h: Headers }) {
  const prev = useRef<Record<string, string>>({});
  const lines = headerLines(h);
  const changed = new Set(lines.filter((l) => prev.current[l.name] !== undefined && prev.current[l.name] !== l.value).map((l) => l.name));
  const added = new Set(lines.filter((l) => Object.keys(prev.current).length > 0 && prev.current[l.name] === undefined).map((l) => l.name));
  useEffect(() => { prev.current = Object.fromEntries(lines.map((l) => [l.name, l.value])); });
  return (
    <div className="ch-group" style={{ gap: 6 }}>
      <div className="ch-headers-cap">Origin response <span className="ch-path">GET {OBJ[h.obj].path}</span></div>
      <pre className="ch-headers" aria-label="Response headers">
        <span className="line status">HTTP/2 200</span>
        {lines.map((l) => (
          <span key={`${l.name}:${l.value}`} className={`line ${changed.has(l.name) || added.has(l.name) ? "flash" : ""}`}>
            <span className="n">{l.name}</span>: <span className="v">{l.value.split(", ").map((d, i, a) => <span key={i}><span className="d">{d}{i < a.length - 1 ? "," : ""}</span>{i < a.length - 1 ? " " : ""}</span>)}</span>
          </span>
        ))}
      </pre>
    </div>
  );
}

/** One-paragraph plain-English reading of what the CDN will do, plus warnings for traps. */
export function PlainReading({ h }: { h: Headers }) {
  const c = cdnPolicy(h);
  const parts: string[] = [];
  let warn: { text: string; bad?: boolean }[] = [];
  if (!c.stores) {
    parts.push(c.noStoreReason === "no-store" ? "stores nothing. Every request goes to the origin." : "may not store it (private). Every request goes to the origin.");
  } else {
    parts.push(c.ttlFrom === "no-cache" ? "stores it but must revalidate before every reuse." : `serves it fresh for ${fmtDur(c.ttl)} (from ${c.ttlFrom}).`);
    if (c.swr > 0) parts.push(`Then, for ${fmtDur(c.swr)}, it serves the stale copy at once and refreshes in the background.`);
    parts.push(h.etag ? "To revalidate it sends If-None-Match and hopes for a 304." : "With no ETag it cannot ask \"has it changed?\", so it downloads the full body again.");
    parts.push(c.sie > 0 ? `If the origin fails, it may serve stale for up to ${fmtDur(c.sie)}.` : "If the origin fails once the copy is stale, viewers get a 504.");
  }
  if (h.noStore && h.maxAge > 0) warn.push({ text: "no-store wins: max-age is ignored.", bad: true });
  if (c.staleBlockedBy === "s-maxage") warn.push({ text: "s-maxage implies proxy-revalidate (RFC 9111): once stale, the CDN must revalidate, so swr and stale-if-error do not apply at the CDN. Many CDNs relax this; check yours." });
  if (c.staleBlockedBy === "no-cache") warn.push({ text: "no-cache forbids serving stale, so swr and stale-if-error do nothing." });
  if (h.priv && h.obj === "segment") warn.push({ text: "private on a segment silently kills CDN caching.", bad: true });
  if (h.vary === "ua") warn.push({ text: `Vary: User-Agent stores one copy per device string (${variantCount(h)} here, thousands in real traffic).`, bad: true });
  if (h.vary === "ae" && h.obj === "segment") warn.push({ text: "Segments are not compressed, so Vary: Accept-Encoding only splits the cache." });
  if (h.immutable && h.obj === "live") warn.push({ text: "immutable on a live playlist is wrong: its body changes every segment." });
  warn = warn.slice(0, 3);
  return (
    <div className="ch-group" style={{ gap: 6 }}>
      <p className="ch-plain" style={{ margin: 0 }}><b>The CDN</b> {parts.join(" ")}</p>
      {warn.map((w) => <div key={w.text} className={`ch-warn ${w.bad ? "bad" : ""}`}>{w.text}</div>)}
    </div>
  );
}

export function ResultsList({ results, revealed, live, follow, tall }: { results: Result[]; revealed: Set<number>; live: boolean; follow: boolean; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = results.filter((r) => revealed.has(r.req.id));
  useEffect(() => { if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [shown.length, follow]);
  return (
    <div className={`ch-results ${tall ? "tall" : ""}`} ref={ref} aria-live={live ? "polite" : "off"}>
      <div className="ch-results-title">What each viewer got</div>
      {shown.length === 0 && <div className="ch-results-empty">Press Replay to send the requests.</div>}
      {shown.map((r) => {
        const c = OUTCOME_COLOR[r.outcome];
        const lag = r.servedVersion !== null && r.servedVersion < r.originVersion ? ` (served v${r.servedVersion}; origin has v${r.originVersion})` : "";
        return (
          <div key={r.req.id} className="ch-row">
            <span className="ch-row-meta">{r.n} · t={r.req.t} s · {CLIENTS[r.req.client].name}</span>
            <span className="ch-tag" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, var(--surface))` }}>{OUTCOME_LABEL[r.outcome]}</span>
            <span className="ch-row-note">{r.note}{lag}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- full mode: browser cache vs CDN cache ---------- */

function Life({ pol }: { pol: Policy }) {
  if (!pol.stores) return <div className="ch-life" aria-hidden="true" />;
  // Proportions on a log-ish scale so 2 s and 1 yr both read; labels carry the real numbers.
  const w = (s: number) => (s > 0 ? Math.log10(s + 1) + 0.6 : 0);
  return (
    <>
      <div className="ch-life" aria-hidden="true">
        <i style={{ flexGrow: Math.max(w(pol.ttl), 0.15), background: "var(--good)" }} />
        {pol.swr > 0 && <i style={{ flexGrow: w(pol.swr), background: "var(--p2)" }} />}
        {pol.sie > 0 && <i style={{ flexGrow: w(pol.sie), background: "var(--p1)" }} />}
        <i style={{ flexGrow: 0.8, background: "var(--surface-3)" }} />
      </div>
      <div className="ch-life-legend">
        <span>fresh {fmtDur(pol.ttl)}</span>
        {pol.swr > 0 && <span>+ swr {fmtDur(pol.swr)}</span>}
        {pol.sie > 0 && <span>+ if error {fmtDur(pol.sie)}</span>}
        <span>then must revalidate</span>
      </div>
    </>
  );
}

export function Compare({ h }: { h: Headers }) {
  const b = browserPolicy(h), c = cdnPolicy(h);
  const v = variantCount(h);
  const stores = (p: Policy) => (p.stores ? "yes" : `no (${p.noStoreReason})`);
  const fresh = (p: Policy) => (p.ttlFrom === "no-cache" ? "0 s, revalidate every use" : `${fmtDur(p.ttl)} (${p.ttlFrom})`);
  const swr = (p: Policy) => (p.swr > 0 ? `up to ${fmtDur(p.swr)}` : p.staleBlockedBy ? `no (${p.staleBlockedBy})` : "no");
  const sie = (p: Policy) => (p.sie > 0 ? `may serve stale up to ${fmtDur(p.sie)}` : "error");
  return (
    <div className="ch-group">
      <div className="ch-group-title">Same headers, two caches</div>
      <div className="ch-compare">
        <section className="ch-card" aria-label="Browser cache">
          <h4>Browser cache<small>Private: one viewer's device</small></h4>
          <Life pol={b} />
          <dl className="ch-kv">
            <dt>Stores a copy</dt><dd className={b.stores ? "good" : "bad"}>{stores(b)}</dd>
            <dt>Fresh for</dt><dd>{fresh(b)}</dd>
            <dt>Reads s-maxage</dt><dd>no, browsers ignore it</dd>
            <dt>Serve stale while refreshing</dt><dd>{swr(b)}</dd>
            <dt>If the CDN fails</dt><dd className={b.sie > 0 ? "" : "warn"}>{sie(b)}</dd>
            <dt>Revalidates with</dt><dd>the CDN</dd>
            <dt>On reload</dt><dd>{h.immutable ? "no revalidation while fresh (immutable)" : "may revalidate"}</dd>
          </dl>
        </section>
        <section className="ch-card cdn" aria-label="CDN cache">
          <h4>CDN cache<small>Shared: every viewer behind this PoP</small></h4>
          <Life pol={c} />
          <dl className="ch-kv">
            <dt>Stores a copy</dt><dd className={c.stores ? "good" : "bad"}>{stores(c)}</dd>
            <dt>Fresh for</dt><dd>{fresh(c)}</dd>
            <dt>Copies per URL</dt><dd className={v > 2 ? "bad" : ""}>{c.stores ? (h.vary === "none" ? "1" : `${v} (Vary: ${h.vary === "ae" ? "Accept-Encoding" : "User-Agent"})`) : "0"}</dd>
            <dt>Serve stale while refreshing</dt><dd>{swr(c)}</dd>
            <dt>If the origin fails</dt><dd className={c.sie > 0 ? "" : "warn"}>{sie(c)}</dd>
            <dt>Revalidates with</dt><dd>the origin, {h.etag ? "If-None-Match, 304" : "no validator, full 200"}</dd>
            <dt>immutable</dt><dd>{h.immutable ? "ignored (a browser hint)" : "not set"}</dd>
          </dl>
        </section>
      </div>
      <p className="ch-compare-note" style={{ margin: 0 }}>
        {h.priv && !h.noStore
          ? "private splits the two: the browser may keep it, the CDN must not. Right for per-user manifests, wrong for segments."
          : h.sMaxage !== null && h.sMaxage !== h.maxAge
            ? `s-maxage gives the CDN its own lifetime (${fmtDur(h.sMaxage)}) while browsers keep max-age (${fmtDur(h.maxAge)}). Useful for manifests you purge on change.`
            : "Without s-maxage, both caches use max-age. Add s-maxage to give the CDN a longer life than browsers."}
      </p>
    </div>
  );
}
