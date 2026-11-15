/**
 * Delivery bill calculator (Chapter 16, "The Economics of Delivery").
 *
 * Props
 *  - onComplete?: () => void
 *      Called once when the challenge is met: in challenge mode, the monthly bill is at or below 70% of the
 *      challenge's starting bill, AND quality is untouched (viewing volume not reduced, regional audience mix
 *      not changed). Contract terms (price model, rates, billing, commit, fill path) are locked during the challenge.
 *  - start?: "book" | "negotiated" | "challenge"
 *      Opening setup. "book" (default) = the book's worked bill at list, 2026 (about $17M/month).
 *      "negotiated" = the same traffic at the book's illustrative $0.002/GB (survey range).
 *      "challenge" = opens straight into the "Cut the bill 30%" challenge.
 *  - compact?: boolean (from the harness/lesson player; layout adapts with container queries).
 *
 * All prices come from Chapter 16 and carry a label: "list, 2026", "survey", "reported 2026",
 * "illustrative" or "assumed". The model lives in ./model.ts.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { WidgetProps } from "../types";
import { Button, Callout, Chip, Eyebrow, Icon, ProgressBar, Segmented, Slider, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtMoney, fmtNum } from "@/lib/format";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import {
  BOOK_MIX, BOOK_STATE, CHALLENGE_STATE, K, NEGOTIATED_STATE, REGIONS, SURVEY, compute, levers,
  type Bill, type Billing, type OriginPath, type Packaging, type PriceModel, type RegionId, type State,
} from "./model";
import { Predict } from "./predict";
import "./cost.css";

type Start = "book" | "negotiated" | "challenge";
type Tab = "traffic" | "contract" | "cache" | "catalog";
interface Challenge { baseState: State; base: Bill; done: boolean }

const START: Record<Start, State> = { book: BOOK_STATE, negotiated: NEGOTIATED_STATE, challenge: CHALLENGE_STATE };
const TARGET = 0.3;

const usd = (v: number, d = 4) => `$${v.toFixed(d)}`;
const rate = (v: number) => (v >= 0.01 ? usd(v, 3) : usd(v, 4));
const pct = (v: number, d = 0) => `${fmtNum(v * 100, d)}%`;

const LINES = [
  { key: "delivery", label: "CDN delivery", color: "var(--p5)" },
  { key: "origin", label: "Origin egress", color: "var(--p2)" },
  { key: "storage", label: "Storage", color: "var(--p6)" },
  { key: "packaging", label: "Packaging (JIT)", color: "var(--p3)" },
] as const;

function useTween(v: number, off: boolean) {
  const [d, setD] = useState(v);
  const cur = useRef(v);
  useEffect(() => {
    if (off) { cur.current = v; setD(v); return; }
    const a = cur.current, t0 = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3);
      cur.current = a + (v - a) * e; setD(cur.current);
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [v, off]);
  return d;
}

function priceLabel(s: State) {
  if (s.price === "list") return "list, 2026";
  if (s.billing === "p95") return "illustrative $/Mbps";
  return "survey";
}

export default function CostWidget(props: WidgetProps) {
  const start: Start = props.start === "negotiated" || props.start === "challenge" ? props.start : "book";
  const reduce = useReducedMotion();
  const [s, setS] = useState<State>(START[start]);
  const [tab, setTab] = useState<Tab>(start === "challenge" ? "cache" : "contract");
  const [touched, setTouched] = useState(false);
  const [ch, setCh] = useState<Challenge | null>(() => (start === "challenge" ? { baseState: CHALLENGE_STATE, base: compute(CHALLENGE_STATE), done: false } : null));
  const completed = useRef(false);

  const bill = useMemo(() => compute(s), [s]);
  const locked = !!ch;
  const lv = useMemo(() => levers(s, bill, locked), [s, bill, locked]);

  const set = (patch: Partial<State>) => { setTouched(true); setS((p) => ({ ...p, ...patch })); };

  // Challenge evaluation.
  const quality = ch ? qualityIssues(ch.baseState, s) : [];
  const cut = ch ? 1 - bill.total / ch.base.total : 0;
  const met = !!ch && cut >= TARGET - 1e-9 && quality.length === 0;
  useEffect(() => {
    if (met && ch && !ch.done) {
      setCh({ ...ch, done: true });
      if (!completed.current) { completed.current = true; props.onComplete?.(); }
    }
  }, [met, ch, props]);

  const startChallenge = () => { setTouched(true); setS(CHALLENGE_STATE); setCh({ baseState: CHALLENGE_STATE, base: compute(CHALLENGE_STATE), done: false }); setTab("cache"); };
  const exitChallenge = () => { setCh(null); };
  const load = (next: State) => { setTouched(true); setCh(null); setS(next); };

  const stage = <BillView s={s} bill={bill} reduce={reduce} ch={ch} />;
  const controls = (
    <div className="cb-controls">
      <div className={`cb-tabs ${touched ? "" : "cb-pulse"} ${reduce ? "rm" : ""}`}>
        <Segmented<Tab> value={tab} onChange={(t) => { setTouched(true); setTab(t); }}
          options={[{ value: "traffic", label: "Traffic" }, { value: "contract", label: "Contract" }, { value: "cache", label: "Cache" }, { value: "catalog", label: "Catalog" }]} />
      </div>
      {tab === "traffic" && <TrafficTab s={s} set={set} bill={bill} />}
      {tab === "contract" && <ContractTab s={s} set={set} bill={bill} locked={locked} />}
      {tab === "cache" && <CacheTab s={s} set={set} bill={bill} locked={locked} />}
      {tab === "catalog" && <CatalogTab s={s} set={set} bill={bill} />}
    </div>
  );
  const footer = (
    <div className="cb-footer">
      <ChallengeCard ch={ch} bill={bill} cut={cut} quality={quality} lv={lv} s={s} onStart={startChallenge} onExit={exitChallenge}
        onReset={() => ch && setS(ch.baseState)} />
      <LeversCard lv={lv} onApply={(n) => { setTouched(true); setS(n); }} reduce={reduce} locked={locked} />
      <Predict onLoad={load} />
      <Callout type="industry">
        <p><b>List prices are a ceiling, not the market.</b> Big streaming customers sign private contracts that are often ten times or more below list. Surveys put very large deals near $0.001 per GB in 2019 and as low as $0.0006 in 2020, against CloudFront's lowest US list rate of $0.020 in 2026. The traffic model is the book's assumption, not Crunchyroll data. Do not quote any number here as Crunchyroll's bill.</p>
      </Callout>
    </div>
  );

  return (
    <div className={`cb ${reduce ? "rm" : ""}`}>
      <header className="cb-head">
        <Eyebrow dot="var(--p5)">Chapter 16 · Economics of delivery</Eyebrow>
        <p className="cb-task">{ch ? "Challenge: cut the bill 30% without hurting quality. The contract is fixed this month." : "Switch the price model between list and negotiated. Then find the levers that matter."}</p>
      </header>
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}

function qualityIssues(base: State, s: State): string[] {
  const out: string[] = [];
  if (s.volumePB < base.volumePB - 1e-6) out.push(`Viewing volume is below ${base.volumePB} PB. Fewer bytes from a lower bitrate means a worse picture. Put it back.`);
  const moved = REGIONS.some((r) => Math.abs(s.mix[r.id] - base.mix[r.id]) > 0.5);
  if (moved) out.push("The regional mix changed. Serving fewer viewers in costly regions is not a quality-neutral fix. Restore the mix.");
  return out;
}

/* ------------------------------------------------------------------ Stage */

function BillView({ s, bill, reduce, ch }: { s: State; bill: Bill; reduce: boolean; ch: Challenge | null }) {
  const total = useTween(bill.total, reduce);
  const max = Math.max(1, bill.total);
  return (
    <div className="cb-stage">
      <div className="cb-hero">
        <div>
          <div className="cb-hero-label">Monthly bill</div>
          <div className="cb-hero-num" aria-live="polite">{fmtMoney(total)}<span>/month</span></div>
          <div className="cb-hero-sub">
            <Chip tone={s.price === "list" ? "warn" : "accent"}>{priceLabel(s)}</Chip>
            {ch && <Chip tone={bill.total <= ch.base.total * (1 - TARGET) ? "good" : "neutral"}>{pct(1 - bill.total / ch.base.total)} vs start</Chip>}
          </div>
        </div>
        <div className="cb-hero-side">
          <div className="cb-hero-label">Per viewer-hour</div>
          <div className="cb-hero-num small">{usd(bill.perHour, bill.perHour >= 0.01 ? 3 : 4)}</div>
          <div className="cb-mini">{fmtNum(bill.hours / 1e6)}M hours · {K.gbPerHour} GB/hour</div>
        </div>
      </div>

      <div className="cb-bar" role="img" aria-label={`Bill split: ${LINES.map((l) => `${l.label} ${fmtMoney(bill[l.key])}`).join(", ")}`}>
        {LINES.map((l) => (
          <span key={l.key} style={{ width: `${(bill[l.key] / max) * 100}%`, background: l.color, minWidth: bill[l.key] > 0 ? 3 : 0 } as CSSProperties} />
        ))}
      </div>
      <ul className="cb-legend">
        {LINES.map((l) => (
          <li key={l.key}>
            <i style={{ background: l.color }} />
            <span className="cb-legend-name">{l.label}</span>
            <span className="cb-legend-val">{fmtMoney(bill[l.key])}</span>
            <span className="cb-legend-pct">{bill[l.key] > 0 && bill[l.key] / max < 0.005 ? "<1%" : pct(bill[l.key] / max)}</span>
          </li>
        ))}
      </ul>

      <Headline total={bill.total} />

      <div className="cb-stats"><StatGrid>
        <Stat label="Delivered" value={fmtNum(bill.deliveredPB)} unit="PB" sub={s.hevc + s.av1 > 0 ? `${fmtNum(s.volumePB - bill.deliveredPB)} PB saved by codecs` : "all H.264"} />
        <Stat label="Origin fills" value={fmtNum(bill.fillsPB, 1)} unit="PB" sub={`hit ratio ${pct(s.hit, 1)}`} />
        <Stat label="All-in $/GB" value={rate(bill.blendedPerGB)} sub="whole bill / delivered" />
      </StatGrid></div>

      <Regions bill={bill} />
    </div>
  );
}

/** Log-scale track: the book's list and negotiated headline, with the reader's bill as a marker. */
function Headline({ total }: { total: number }) {
  const lo = Math.log10(3e5), hi = Math.log10(3e7);
  const x = (v: number) => `${((Math.log10(Math.min(3e7, Math.max(3e5, v))) - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="cb-headline">
      <div className="cb-headline-title">Book headline (Section 16.11): about <b>$17M/month at list</b> vs roughly <b>$1M to $3.5M negotiated</b></div>
      <div className="cb-track" role="img" aria-label={`Your bill ${fmtMoney(total)} on a scale from $0.3M to $30M. Book: negotiated $1M to $3.5M, list about $17M.`}>
        <div className="cb-track-line" />
        <div className="cb-band" style={{ left: x(1e6), width: `calc(${x(3.5e6)} - ${x(1e6)})` }} />
        <div className="cb-tick" style={{ left: x(17e6) }} />
        <div className="cb-you" style={{ left: x(total) }}><span>{fmtMoney(total)}</span></div>
      </div>
      <div className="cb-track-labels">
        <span style={{ left: `calc((${x(1e6)} + ${x(3.5e6)}) / 2)` }}>negotiated<br />survey</span>
        <span style={{ left: x(17e6) }}>list, 2026<br />$17M</span>
      </div>
      <div className="cb-track-axis"><span>$0.3M</span><span>$3M</span><span>$30M</span></div>
    </div>
  );
}

function Regions({ bill }: { bill: Bill }) {
  const bytes = bill.regions.reduce((a, r) => a + r.pb, 0) || 1;
  const cost = bill.regions.reduce((a, r) => a + r.cost, 0) || 1;
  const src = { list: "list, 2026", survey: "survey", override: "your rate", p95: "95th pct" } as const;
  return (
    <div className="cb-regions">
      <div className="cb-regions-head"><span>Delivery by region{bill.commitWaste > 0 || bill.overageCost > 0 ? <small className="cb-note">before commit and overage</small> : null}</span><span className="cb-key"><i className="b" />bytes <i className="c" />cost</span></div>
      {bill.regions.map((r) => {
        const reg = REGIONS.find((x) => x.id === r.id)!;
        return (
          <div className="cb-reg" key={r.id}>
            <div className="cb-reg-top">
              <span className="cb-reg-name" title={reg.parts.map((p) => p.label).join(", ")}>{reg.short}</span>
              <span className="cb-reg-meta">{fmtNum(r.pb, r.pb < 10 ? 1 : 0)} PB · {rate(r.rate)}/GB <em>{src[r.src]}</em></span>
              <span className="cb-reg-cost">{fmtMoney(r.cost)}</span>
            </div>
            <div className="cb-reg-bars" aria-hidden="true">
              <span className="b" style={{ width: `${(r.pb / bytes) * 100}%` }} />
              <span className="c" style={{ width: `${(r.cost / cost) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */

type TabProps = { s: State; set: (p: Partial<State>) => void; bill: Bill };

function TrafficTab({ s, set, bill }: TabProps) {
  const setShare = (id: RegionId, v: number) => {
    const others = REGIONS.filter((r) => r.id !== id);
    const rest = others.reduce((a, r) => a + s.mix[r.id], 0);
    const mix = { ...s.mix, [id]: v };
    for (const r of others) mix[r.id] = rest > 0 ? (s.mix[r.id] / rest) * (100 - v) : (100 - v) / others.length;
    set({ mix });
  };
  return (
    <div className="cb-tab">
      <Slider label="Viewing volume" value={s.volumePB} min={100} max={1000} step={10} onChange={(v) => set({ volumePB: v })}
        format={(v) => `${v} PB`} hint={`Measured as if all H.264. 540 PB is the book's assumed model, about ${fmtNum(bill.hours / 1e6)}M viewer-hours.`} />
      <div className="cb-sub">Regional mix of bytes <span className="cb-note">assumed; always adds to 100%</span></div>
      {REGIONS.map((r) => (
        <Slider key={r.id} label={r.name} value={Math.round(s.mix[r.id] * 10) / 10} min={0} max={100} step={1}
          onChange={(v) => setShare(r.id, v)} format={(v) => `${fmtNum(v)}%`} />
      ))}
      <Button size="s" variant="ghost" onClick={() => set({ mix: { ...BOOK_MIX } })}><Icon name="reset" size={16} />Book mix</Button>
    </div>
  );
}

function ContractTab({ s, set, bill, locked }: TabProps & { locked: boolean }) {
  const p95 = s.price === "negotiated" && s.billing === "p95";
  const near = SURVEY.reduce((b, x) => (Math.abs(Math.log(x.rate / s.negRate)) < Math.abs(Math.log(b.rate / s.negRate)) ? x : b), SURVEY[0]);
  return (
    <div className="cb-tab">
      {locked && <div className="cb-lock"><Icon name="lock" size={16} />Contract is fixed during the challenge.</div>}
      <Segmented<PriceModel> label="Price model" value={s.price} disabled={locked} onChange={(v) => set({ price: v, billing: v === "list" ? "gb" : s.billing })}
        options={[{ value: "list", label: "List (CloudFront 2026)" }, { value: "negotiated", label: "Negotiated (survey)" }]} />
      {s.price === "list" ? (
        <p className="cb-note-p">CloudFront pay-as-you-go tiers, <b>list, 2026</b>. Tiers apply per region per month; at these volumes almost every byte lands in the "over 5 PB" tier ($0.020 US and Europe, $0.040 South America, $0.060 Asia, $0.072 India, $0.080 Australia). Requests at $0.0100 to $0.0220 per 10,000, list, 2026.</p>
      ) : (
        <Segmented<Billing> label="Billing method" value={s.billing} disabled={locked} onChange={(v) => set({ billing: v })}
          options={[{ value: "gb", label: "Per GB" }, { value: "p95", label: "95th percentile" }]} />
      )}
      {s.price === "list" && <p className="cb-note-p dim">95th percentile billing is a contract term. Switch to Negotiated to use it.</p>}

      {s.price === "negotiated" && !p95 && (
        <>
          <Slider label="Contract rate" value={s.negRate} min={0.0006} max={0.007} step={0.0001} disabled={locked} onChange={(v) => set({ negRate: v })}
            format={(v) => `${usd(v)}/GB`} hint={`Survey: nearest point is ${usd(near.rate)} (${near.label}). Requests assumed bundled.`} />
          <Overrides s={s} set={set} bill={bill} locked={locked} />
        </>
      )}
      {p95 && <P95 s={s} set={set} bill={bill} locked={locked} />}

      {s.price === "negotiated" && (
        <div className="cb-group">
          <div className="cb-sub">Commit and overage</div>
          {p95 ? (
            <Slider label="Commit (billed rate)" value={s.commitTbps} min={0} max={8} step={0.1} disabled={locked} onChange={(v) => set({ commitTbps: v })}
              format={(v) => (v === 0 ? "none" : `${v.toFixed(1)} Tbps`)} hint={`Your billed 95th percentile: ${bill.billedTbps.toFixed(2)} Tbps`} />
          ) : (
            <Slider label="Commit (volume)" value={s.commitPB} min={0} max={800} step={10} disabled={locked} onChange={(v) => set({ commitPB: v })}
              format={(v) => (v === 0 ? "none" : `${v} PB`)} hint={`You deliver ${fmtNum(bill.deliveredPB)} PB this month`} />
          )}
          <Slider label="Overage premium" value={s.overagePct} min={0} max={100} step={5} disabled={locked} onChange={(v) => set({ overagePct: v })}
            format={(v) => `+${v}%`} hint="Price above the commit, vs the contract rate (assumed)" />
          {bill.commitWaste > 0 && <div className="cb-flag warn">Unused commit: {fmtMoney(bill.commitWaste)} paid for nothing.</div>}
          {bill.overageCost > 0 && <div className="cb-flag">Overage traffic costs {fmtMoney(bill.overageCost)} at +{s.overagePct}%.</div>}
        </div>
      )}
    </div>
  );
}

function Overrides({ s, set, bill, locked }: TabProps & { locked: boolean }) {
  return (
    <div className="cb-group">
      <div className="cb-sub">Per-region $/GB override <span className="cb-note">empty = contract rate</span></div>
      <div className="cb-ovr">
        {REGIONS.map((r) => {
          const v = s.override[r.id];
          const cur = bill.regions.find((x) => x.id === r.id)!.rate;
          return (
            <label key={r.id} className="cb-ovr-row">
              <span>{r.short}</span>
              <input type="text" inputMode="decimal" disabled={locked} placeholder={cur.toFixed(4)} defaultValue={v === undefined ? "" : String(v)}
                key={`${r.id}-${v === undefined ? "x" : "v"}-${s.price}`} aria-label={`${r.name} price per GB`}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  const n = Number(t);
                  const next = { ...s.override };
                  if (t === "" || !Number.isFinite(n) || n < 0) delete next[r.id]; else next[r.id] = Math.min(1, n);
                  set({ override: next });
                }} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** 95th percentile: editable traffic shape (load factor) with the book's effective $/GB formula. */
function P95({ s, set, bill, locked }: TabProps & { locked: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = Math.max(200, useWidth(ref) || 248), h = 96;
  // Daily shape: (1-k) + k*g(t), g = evening bump peaking at 21:00; mean/peak = load factor.
  const g = (t: number) => Math.pow((1 + Math.cos((2 * Math.PI * (t - 21)) / 24)) / 2, 3);
  const mg = 0.3125;
  const k = Math.min(1, (1 - s.loadFactor) / (1 - mg));
  const pts = Array.from({ length: 49 }, (_, i) => i / 2).map((t) => [t, 1 - k + k * g(t)] as const);
  const L = 4, R = 4, T = 14, B = 16;
  const sx = (t: number) => L + (t / 24) * (w - L - R), sy = (v: number) => T + (1 - v) * (h - T - B);
  const d = pts.map(([t, v], i) => `${i ? "L" : "M"}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  return (
    <div className="cb-group">
      <Slider label="$ per Mbps per month" value={s.perMbps} min={0.05} max={1} step={0.01} disabled={locked} onChange={(v) => set({ perMbps: v })}
        format={(v) => `$${v.toFixed(2)}`} hint="Illustrative, not a quoted market rate (the book uses $0.20)" />
      <Slider label="Traffic shape (load factor)" value={s.loadFactor} min={0.35} max={0.85} step={0.01} disabled={locked} onChange={(v) => set({ loadFactor: v })}
        format={(v) => v.toFixed(2)} hint="Average traffic / billed 95th percentile. Book model: 0.42" />
      <div ref={ref} className="cb-shape">
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`One day of traffic. Average is ${pct(s.loadFactor)} of the billed peak.`}>
          <path d={`${d}L${sx(24)},${sy(0)}L${sx(0)},${sy(0)}Z`} className="cb-shape-area" />
          <path d={d} className="cb-shape-line" />
          <line x1={L} x2={w - R} y1={sy(1)} y2={sy(1)} className="cb-shape-p95" />
          <line x1={L} x2={w - R} y1={sy(s.loadFactor)} y2={sy(s.loadFactor)} className="cb-shape-avg" />
          <text x={L} y={sy(1) - 4} className="cb-shape-t">billed (95th pct)</text>
          <text x={sx(9)} y={sy(s.loadFactor) - 4} textAnchor="middle" className="cb-shape-t">average</text>
          <text x={L} y={h - 3} className="cb-shape-t">00:00</text>
          <text x={sx(21)} y={h - 3} textAnchor="middle" className="cb-shape-t">21:00</text>
        </svg>
      </div>
      <div className="cb-formula" aria-label="Effective price per GB formula">
        <div>effective $/GB = $/Mbps ÷ (324 × load factor)</div>
        <div>= {s.perMbps.toFixed(2)} ÷ (324 × {s.loadFactor.toFixed(2)}) = <b>{usd(bill.effPerGB95, 5)}</b></div>
        <small>324 GB = one Mbps flat out for 30 days. Billed rate: {bill.billedTbps.toFixed(2)} Tbps.</small>
      </div>
    </div>
  );
}

function CacheTab({ s, set, bill, locked }: TabProps & { locked: boolean }) {
  const miss = bill.deliveredPB * (1 - s.hit);
  const ORIGINS: Record<OriginPath, { price: string; tag: string; note: string }> = {
    cf: { price: "$0/GB", tag: "list, 2026", note: "Free for origin fetches from any AWS origin." },
    s3: { price: "~$0.05/GB", tag: "list, 2026", note: "S3's top internet egress tier; first 10 TB is $0.09. Confirm the current tier." },
    gcs: { price: "$0.08/GB", tag: "reported 2026", note: "CDN Interconnect, North America. Third-party report of the May 2026 rise; verify with Google." },
  };
  const o = ORIGINS[s.origin];
  return (
    <div className="cb-tab">
      <Slider label="Edge hit ratio (by bytes)" value={s.hit} min={0.8} max={0.995} step={0.005} onChange={(v) => set({ hit: v })}
        format={(v) => pct(v, 1)} hint="Book model: 95%" />
      <div className="cb-flow" aria-label="Where the bytes come from">
        <div><b>{fmtNum(bill.deliveredPB)} PB</b><span>delivered</span></div>
        <Icon name="chevron-right" size={16} />
        <div><b>{fmtNum(miss, 1)} PB</b><span>edge misses</span></div>
        <Icon name="chevron-right" size={16} />
        <div className="hot"><b>{fmtNum(bill.fillsPB, 1)} PB</b><span>leave origin</span></div>
      </div>
      <p className="cb-note-p dim">Shield catches 80% of edge misses (assumed). Every fill also passes through the JIT packager if you use one.</p>
      {locked && <div className="cb-lock"><Icon name="lock" size={16} />Fill path follows the CDN contract, so it is fixed in the challenge.</div>}
      <Segmented<OriginPath> label="Origin to CDN path" value={s.origin} disabled={locked} onChange={(v) => set({ origin: v })}
        options={[{ value: "cf", label: "S3 → CloudFront" }, { value: "s3", label: "S3 → other CDN" }, { value: "gcs", label: "GCS → partner" }]} />
      <div className="cb-price"><b>{o.price}</b><Chip>{o.tag}</Chip><span>{o.note}</span></div>
      <div className="cb-price"><b>{fmtMoney(bill.origin)}</b><span>origin egress this month{s.origin === "cf" && s.price === "list" ? ", incl. Origin Shield requests at $0.0075 per 10,000 (list, 2026)" : ""}</span></div>
    </div>
  );
}

function CatalogTab({ s, set, bill }: TabProps) {
  const h264 = 100 - s.hevc - s.av1;
  const setCodec = (c: "hevc" | "av1", v: number) => {
    const other = c === "hevc" ? s.av1 : s.hevc;
    set({ [c]: Math.min(v, 100 - other) } as Partial<State>);
  };
  return (
    <div className="cb-tab">
      <Slider label="Catalog" value={s.episodes} min={10_000} max={100_000} step={5_000} onChange={(v) => set({ episodes: v })}
        format={(v) => `${fmtNum(v)} episodes`} hint="Book: 50,000+ episodes; 4.3 GB per packaged copy, 27 GB mezzanine" />
      <Segmented<Packaging> label="Packaging" value={s.packaging} onChange={(v) => set({ packaging: v })}
        options={[{ value: "hlsdash", label: "HLS + DASH" }, { value: "cmaf", label: "One CMAF" }, { value: "jit", label: "Managed JIT" }]} />
      <p className="cb-note-p dim">
        {s.packaging === "hlsdash" && "Two static copies (cbcs + cenc), stored in two clouds."}
        {s.packaging === "cmaf" && "One static CMAF copy with cbcs serves HLS and DASH players. It also raises hit-ratio potential; move the Cache slider to model that."}
        {s.packaging === "jit" && <>One intermediate copy. MediaPackage VOD charges <b>$0.050 per GB</b> packaged (list, 2026) on every origin fill: {fmtMoney(bill.packaging)} this month.</>}
      </p>
      <Toggle label="Mezzanines in Glacier Instant Retrieval" checked={s.mezzCold} onChange={(v) => set({ mezzCold: v })}
        hint={`$0.004 vs $0.022 per GB-month, list, 2026 · ${fmtNum(bill.storageTB.mezz / 1000, 2)} PB`} />
      <div className="cb-price"><b>{fmtMoney(bill.storage)}</b><span>storage: {fmtNum(bill.storageTB.packaged)} TB packaged × 2 clouds + mezzanines</span></div>

      <div className="cb-group">
        <div className="cb-sub">Codec mix <span className="cb-note">savings assumed</span></div>
        <div className="cb-codec" role="img" aria-label={`H.264 ${h264}%, HEVC ${s.hevc}%, AV1 ${s.av1}%`}>
          <span style={{ width: `${h264}%` }} className="h">{h264 >= 14 ? `H.264 ${h264}%` : ""}</span>
          <span style={{ width: `${s.hevc}%` }} className="v">{s.hevc >= 14 ? `HEVC ${s.hevc}%` : ""}</span>
          <span style={{ width: `${s.av1}%` }} className="a">{s.av1 >= 14 ? `AV1 ${s.av1}%` : ""}</span>
        </div>
        <Slider label="HEVC share" value={s.hevc} min={0} max={K.codecMax} step={5} onChange={(v) => setCodec("hevc", v)} format={(v) => `${v}%`}
          hint="Saves 20% of bytes vs H.264 at equal quality (assumed)" />
        <Slider label="AV1 share" value={s.av1} min={0} max={K.codecMax} step={5} onChange={(v) => setCodec("av1", v)} format={(v) => `${v}%`}
          hint="Saves 30% vs H.264 (book's illustration). Capped at 60%: device support" />
        <p className="cb-note-p dim">Each extra codec adds a ladder for popular titles (75 TB, assumed). Encode compute is not on this bill.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Footer cards */

function LeversCard({ lv, onApply, reduce, locked }: { lv: ReturnType<typeof levers>; onApply: (s: State) => void; reduce: boolean; locked: boolean }) {
  const on = lv.filter((l) => l.available && l.saving > 0.5);
  const off = lv.filter((l) => !(l.available && l.saving > 0.5));
  const top = Math.max(1, ...on.map((l) => l.saving));
  return (
    <section className="cb-card" aria-labelledby="cb-levers-h">
      <div className="cb-card-head">
        <h3 id="cb-levers-h" className="cb-h">Levers: what saves the most right now</h3>
      </div>
      <p className="cb-note-p dim">Each lever is one sensible step from your current settings, priced by running the model again.</p>
      <ol className={`cb-levers ${reduce ? "rm" : ""}`}>
        {on.map((l, i) => (
          <li key={l.id}>
            <div className="cb-lever-top">
              <span className="cb-lever-name">{i + 1}. {l.label}</span>
              <span className="cb-lever-val">−{fmtMoney(l.saving)}</span>
            </div>
            <div className="cb-lever-bar"><span style={{ width: `${Math.max(0, (l.saving / top) * 100)}%` }} /></div>
            <div className="cb-lever-foot">
              <Chip tone={l.kind === "eng" ? "accent" : "neutral"}>{l.kind === "eng" ? "engineering" : "contract"}</Chip>
              <span className="cb-lever-detail">{l.detail}</span>
              <Button size="s" variant="ghost" onClick={() => onApply(l.next)} aria-label={`Apply: ${l.label}`}>Apply</Button>
            </div>
          </li>
        ))}
      </ol>
      {off.length > 0 && <p className="cb-levers-off">Nothing to gain now: {off.map((l) => `${l.label} (${locked && l.kind === "contract" ? "locked in the challenge" : l.detail})`).join("; ")}.</p>}
    </section>
  );
}

function ChallengeCard({ ch, bill, cut, quality, lv, s, onStart, onExit, onReset }: {
  ch: Challenge | null; bill: Bill; cut: number; quality: string[]; lv: ReturnType<typeof levers>; s: State;
  onStart: () => void; onExit: () => void; onReset: () => void;
}) {
  if (!ch) {
    return (
      <section className="cb-card cb-challenge" aria-labelledby="cb-ch-h">
        <div className="cb-card-head"><h3 id="cb-ch-h" className="cb-h"><Icon name="target" size={18} />Challenge: cut the bill 30% without hurting quality</h3></div>
        <p className="cb-q small">A messy month: survey-rate contract ($0.003/GB, 450 PB commit), another CDN filling from S3, managed JIT packaging, 90% hit ratio. The contract is signed. Only engineering can help.</p>
        <div className="cb-row-end"><Button variant="primary" size="s" onClick={onStart}>Start challenge</Button></div>
      </section>
    );
  }
  const need = ch.base.total * TARGET;
  const saved = ch.base.total - bill.total;
  const best = lv.find((l) => l.available && l.saving > 0.5);
  const done = ch.done || (cut >= TARGET && quality.length === 0);
  const changes = describeChanges(ch.baseState, s);
  return (
    <section className={`cb-card cb-challenge ${done ? "done" : ""}`} aria-labelledby="cb-ch-h" aria-live="polite">
      <div className="cb-card-head">
        <h3 id="cb-ch-h" className="cb-h"><Icon name={done ? "check" : "target"} size={18} />{done ? "Challenge met" : "Cut the bill 30% without hurting quality"}</h3>
      </div>
      <div className="cb-ch-nums">
        <span>Start <b>{fmtMoney(ch.base.total)}</b></span>
        <span>Now <b>{fmtMoney(bill.total)}</b></span>
        <span>Target <b>{fmtMoney(ch.base.total - need)}</b></span>
      </div>
      <ProgressBar value={Math.max(0, cut) / TARGET} color={done ? "var(--good)" : "var(--p5)"} height={8} label="Progress to a 30% cut" />
      {quality.length > 0 ? (
        quality.map((q) => <div key={q} className="cb-flag bad">{q}</div>)
      ) : done ? (
        <div className="cb-flag good">You cut {pct(cut)} ({fmtMoney(saved)} a month) with engineering alone{changes.length ? `: ${changes.join("; ")}` : ""}. Same viewers, same picture.</div>
      ) : (
        <div className="cb-flag">
          {saved < 0 ? "The bill went up. " : `Cut so far: ${pct(Math.max(0, cut))} (${fmtMoney(Math.max(0, saved))}). Need ${fmtMoney(Math.max(0, need - saved))} more. `}
          {best ? <>Strongest next step: <b>{best.label.toLowerCase()}</b>, about {fmtMoney(best.saving)}.</> : "No single step helps from here. Undo something."}
        </div>
      )}
      <div className="cb-row-end">
        <Button size="s" variant="ghost" onClick={onReset}><Icon name="reset" size={16} />Reset</Button>
        <Button size="s" onClick={onExit}>Leave challenge</Button>
      </div>
    </section>
  );
}

function describeChanges(a: State, b: State): string[] {
  const out: string[] = [];
  if (b.hit !== a.hit) out.push(`hit ratio ${pct(a.hit, 1)} to ${pct(b.hit, 1)}`);
  if (b.packaging !== a.packaging) out.push(`packaging to ${b.packaging === "cmaf" ? "one CMAF copy" : b.packaging === "hlsdash" ? "HLS + DASH" : "JIT"}`);
  if (b.av1 !== a.av1) out.push(`AV1 ${b.av1}%`);
  if (b.hevc !== a.hevc) out.push(`HEVC ${b.hevc}%`);
  if (b.mezzCold !== a.mezzCold) out.push(b.mezzCold ? "mezzanines to Glacier IR" : "mezzanines to Standard");
  return out;
}
