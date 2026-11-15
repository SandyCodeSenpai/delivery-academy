import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Slider, Toggle, Stat, StatGrid, Stage, WidgetFrame, Chip, Button, Icon } from "@/ui";
import { clamp, fmtMoney, fmtNum } from "@/lib/format";
import { useWidth } from "@/lib/hooks";
import { CDNS, CDN_COLOR, COMMIT, MONTHLY_GB, REGIONS, cellQoe, frontier, runPolicy, type CdnId, type Weights } from "./model";
import { Predict, type PredictQ } from "./Predict";

const DEFAULT_W: Weights = { perf: 50, cost: 30, avail: 20 };
const NO_COMMITS: Record<CdnId, boolean> = { A: false, B: false, C: false };
const usd = (v: number) => `$${v.toFixed(4)}`;

const QUESTIONS: PredictQ[] = [
  {
    id: "cost",
    prompt: <>CDN C is the cheapest CDN in every region. If you drag <b>Cost</b> to 100 and <b>Performance</b> to 0, what share does C get?</>,
    options: ["100% in every region", "Most of the traffic, but A and B keep a small share", "About a third: price is only one signal"],
    answer: 1,
    explain: <>The policy outputs <b>shares</b>, not one winner. Every healthy CDN keeps a 5% floor, so its cache stays warm and you keep fresh data on it. Winner-take-all causes herding and leaves failover targets cold (9.9.4). Try it, and watch QoE fall.</>,
  },
  {
    id: "commit",
    prompt: <>At the default weights, CDN C gets about 18% of bytes, but its commit is 25%. Turn on C's commit. Where does the extra traffic go?</>,
    options: ["India, where C is already the best", "Spread evenly across all regions", "Cells where C's score is closest to the leader, so the least quality is lost"],
    answer: 2,
    explain: <>The commit is a constraint on top of the ranking. The policy takes traffic where C is nearly as good as the best CDN (here mostly North America, where C is much cheaper). India cannot take more: C already has 90% there, and A and B keep their floors. The striped part of each bar is traffic the commit forced.</>,
  },
];

export default function PolicyTab({ wide }: { wide: boolean }) {
  const [w, setW] = useState<Weights>(DEFAULT_W);
  const [commits, setCommits] = useState<Record<CdnId, boolean>>(NO_COMMITS);
  const res = useMemo(() => runPolicy(w, commits), [w, commits]);
  const free = useMemo(() => runPolicy(w, NO_COMMITS), [w]);
  const curve = useMemo(() => frontier(w, commits), [w, commits]);
  const freeCurve = useMemo(() => frontier(w, NO_COMMITS), [w]);
  const anyCommit = CDNS.some((c) => commits[c]);
  const set = (k: keyof Weights) => (v: number) => setW((p) => ({ ...p, [k]: v }));

  const stage = (
    <Stage className="mcdn-stage">
      <div className="mcdn-legend" aria-label="Share of all bytes per CDN">
        <span className="mcdn-legend-lead">All regions</span>
        {CDNS.map((c) => {
          const g = res.global[c];
          const met = !commits[c] || g >= COMMIT[c] - 0.002;
          return (
            <span key={c} className="mcdn-legend-item">
              <i style={{ background: CDN_COLOR[c] }} />CDN {c}
              <b>{fmtNum(g * 100)}%</b>
              {commits[c] && <Chip tone={met ? "good" : "bad"}>{met ? "commit met" : "short"} {fmtNum(COMMIT[c] * 100)}%</Chip>}
            </span>
          );
        })}
      </div>

      <div className={`mcdn-grid ${wide ? "is-wide" : "is-narrow"}`} role="table" aria-label="Regions against CDNs: assumed RUM numbers, price and resulting traffic share">
        {wide && (
          <div className="mcdn-grow mcdn-ghead" role="row">
            <span role="columnheader">Region</span>
            {CDNS.map((c) => <span key={c} role="columnheader"><i className="mcdn-sw" style={{ background: CDN_COLOR[c] }} />CDN {c}</span>)}
            <span role="columnheader">Traffic share</span>
          </div>
        )}
        {REGIONS.map((r, i) => {
          const sh = res.shares[i];
          const best = {
            thr: Math.max(...CDNS.map((c) => r.cells[c].thr)),
            err: Math.min(...CDNS.map((c) => r.cells[c].err)),
            price: Math.min(...CDNS.map((c) => r.cells[c].price)),
          };
          const bar = (
            <div className="mcdn-barwrap" role="cell">
              <div className="mcdn-bar" role="img" aria-label={`${r.name}: ${CDNS.map((c) => `CDN ${c} ${Math.round(sh[c] * 100)}%`).join(", ")}`}>
                {CDNS.map((c) => {
                  const f = Math.min(res.forced[i][c], sh[c]);
                  return (
                    <span key={c} className="mcdn-seg" style={{ width: `${sh[c] * 100}%`, "--c": CDN_COLOR[c] } as CSSProperties}>
                      {f > 0.004 && <span className="mcdn-forced" style={{ width: `${(f / sh[c]) * 100}%` }} />}
                      {sh[c] >= 0.14 && <span className="mcdn-seg-label">{Math.round(sh[c] * 100)}%</span>}
                    </span>
                  );
                })}
              </div>
              <div className="mcdn-bar-meta">QoE {fmtNum(res.regionQoe[i])} · {usd(res.regionPrice[i])}/GB</div>
            </div>
          );
          const cells = CDNS.map((c) => {
            const x = r.cells[c];
            return (
              <div key={c} role="cell" className="mcdn-cell" style={{ "--c": CDN_COLOR[c], "--s": `${Math.round(sh[c] * 100)}%` } as CSSProperties}
                title={`QoE score ${fmtNum(cellQoe(x))}`}>
                {!wide && <span className="mcdn-cell-cdn">{c}</span>}
                <span className={x.thr === best.thr ? "is-best" : ""}>{x.thr} Mbps</span>
                <span className={x.err === best.err ? "is-best" : ""}>{x.err.toFixed(2)}% err</span>
                <span className={x.price === best.price ? "is-best" : ""}>{usd(x.price)}</span>
              </div>
            );
          });
          return wide ? (
            <div key={r.id} className="mcdn-grow" role="row">
              <div role="rowheader" className="mcdn-rname">{r.name}<small>{fmtNum(r.weight * 100)}% of bytes</small></div>
              {cells}
              {bar}
            </div>
          ) : (
            <div key={r.id} className="mcdn-rcard" role="row">
              <div role="rowheader" className="mcdn-rname">{r.name}<small>{fmtNum(r.weight * 100)}% of bytes</small></div>
              {bar}
              <div className="mcdn-rcells">{cells}</div>
            </div>
          );
        })}
      </div>
      <p className="mcdn-note">
        <Chip>assumed</Chip> Median throughput and error rate from RUM, and price per GB, are made-up teaching numbers. Bold marks the best value in a region.
        {anyCommit && <> <span className="mcdn-hatch-key" aria-hidden="true" /> Striped = traffic a commit forced.</>}
      </p>
    </Stage>
  );

  const controls = (
    <div className="mcdn-ctl">
      <div className="mcdn-ctl-title">Policy weights</div>
      <div className="mcdn-ctl-grid">
      <Slider label="Performance" value={w.perf} min={0} max={100} step={5} onChange={set("perf")} hint="Throughput from RUM" />
      <Slider label="Cost" value={w.cost} min={0} max={100} step={5} onChange={set("cost")} hint="Price per GB" />
      <Slider label="Availability" value={w.avail} min={0} max={100} step={5} onChange={set("avail")} hint="Error rate" />
      </div>
      <div className="mcdn-ctl-title">Minimum commits <span className="mcdn-muted">share of 540 PB a month, assumed</span></div>
      <div className="mcdn-ctl-grid">
      {CDNS.map((c) => (
        <Toggle key={c} label={`CDN ${c} ≥ ${fmtNum(COMMIT[c] * 100)}%`} checked={commits[c]}
          onChange={(v) => setCommits((p) => ({ ...p, [c]: v }))} hint={`${fmtNum(COMMIT[c] * 540)} PB a month`} />
      ))}
      </div>
      <div><Button size="s" variant="ghost" onClick={() => { setW(DEFAULT_W); setCommits(NO_COMMITS); }}><Icon name="reset" size={15} />Reset</Button></div>
    </div>
  );

  const dQoe = res.qoe - free.qoe, dPrice = res.pricePerGb - free.pricePerGb;
  const footer = (
    <div className="mcdn-foot mcdn-pfoot">
      <StatGrid>
        <Stat label="Blended price" value={usd(res.pricePerGb)} unit="/GB" sub={anyCommit && Math.abs(dPrice) > 0.00001 ? `${dPrice > 0 ? "+" : "−"}${usd(Math.abs(dPrice))} from commits` : "weighted by region bytes"} />
        <Stat label="Blended QoE score" value={fmtNum(res.qoe, 1)} unit="/100" tone={res.qoe >= 78 ? "good" : res.qoe >= 70 ? "warn" : "bad"}
          sub={anyCommit && Math.abs(dQoe) > 0.05 ? `${dQoe > 0 ? "+" : "−"}${fmtNum(Math.abs(dQoe), 1)} from commits` : "throughput and errors"} />
        <Stat label="Monthly CDN bill" value={fmtMoney(res.pricePerGb * MONTHLY_GB)} sub="540 PB a month (assumed)" />
      </StatGrid>
      <Tradeoff curve={curve} freeCurve={anyCommit ? freeCurve : null} point={{ price: res.pricePerGb, qoe: res.qoe }} />
    </div>
  );

  return (
    <div className="mcdn-tab">
      <Predict questions={QUESTIONS} />
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}

/** Cost against QoE as the policy slides from "all performance" to "all cost". The dot is the current policy. */
function Tradeoff({ curve, freeCurve, point }: { curve: { price: number; qoe: number }[]; freeCurve: { price: number; qoe: number }[] | null; point: { price: number; qoe: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useWidth(ref);
  // viewBox width = real pixel width, so 12px text stays 12px at every size.
  const fs = 12, W = Math.max(240, px || 600), H = W < 480 ? 180 : 170, L = 34, R = 14, T = 12, B = 26;
  const x0 = 0.0035, x1 = 0.0065, y0 = 64, y1 = 84;
  const sx = (v: number) => L + ((clamp(v, x0, x1) - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + (1 - (clamp(v, y0, y1) - y0) / (y1 - y0)) * (H - T - B);
  const path = (c: { price: number; qoe: number }[]) => c.map((p, i) => `${i ? "L" : "M"}${sx(p.price).toFixed(1)},${sy(p.qoe).toFixed(1)}`).join("");
  const a = curve[0], b = curve[curve.length - 1];
  return (
    <figure className="mcdn-trade">
      <figcaption>
        <span className="mcdn-ctl-title">The trade-off</span>
        <span className="mcdn-muted">Each point is one policy, from all performance to all cost.</span>
      </figcaption>
      <div ref={ref} className="mcdn-trade-box">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Trade-off curve. Current policy: ${usd(point.price)} per GB, QoE ${fmtNum(point.qoe, 1)}.`}>
        {[64, 69, 74, 79, 84].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="mcdn-gridline" /><text x={L - 8} y={sy(v) + 4} textAnchor="end" className="mcdn-tick">{v}</text></g>
        ))}
        {(W < 480 ? [0.0035, 0.005, 0.0065] : [0.0035, 0.0045, 0.0055, 0.0065]).map((v) => <text key={v} x={sx(v)} y={H - 8} textAnchor={v === x0 ? "start" : v === x1 ? "end" : "middle"} className="mcdn-tick">${v.toFixed(4)}</text>)}
        <text x={L + 4} y={T + 2} className="mcdn-axis" dominantBaseline="hanging">QoE</text>
        <text x={W - R} y={H - B - 8} textAnchor="end" className="mcdn-axis">$/GB</text>
        {freeCurve && <path d={path(freeCurve)} className="mcdn-curve-free" />}
        <path d={path(curve)} className="mcdn-curve" />
        <circle cx={sx(a.price)} cy={sy(a.qoe)} r={3.5} className="mcdn-end" />
        <circle cx={sx(b.price)} cy={sy(b.qoe)} r={3.5} className="mcdn-end" />
        <text x={sx(a.price)} y={sy(a.qoe) - fs * 0.9} textAnchor="middle" className="mcdn-tick">all performance</text>
        <text x={sx(b.price)} y={sy(b.qoe) + fs * 1.6} textAnchor="middle" className="mcdn-tick">all cost</text>
        <g className="mcdn-dot" style={{ transform: `translate(${sx(point.price)}px, ${sy(point.qoe)}px)` }}>
          <circle r={11} className="mcdn-dot-halo" />
          <circle r={6} className="mcdn-dot-core" />
        </g>
      </svg>
      </div>
      {freeCurve && <div className="mcdn-trade-key"><span className="mcdn-key-dash" aria-hidden="true" />without commits</div>}
    </figure>
  );
}
