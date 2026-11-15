import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Segmented, Slider, Stage, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtMoney, fmtNum } from "@/lib/format";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { PRICES, REF_PEAK_TBPS, TARGET_GBPS, computeOffload, fmtGbps, pct } from "./model";
import { Sankey } from "./Sankey";
import { useTween } from "./useTween";
import { Predict, type PredictQuestion } from "./Predict";

const METER_MAX = 500;

export function OffloadTab({ onComplete }: { onComplete?: () => void }) {
  const [peak, setPeak] = useState(8);
  const [edgeHit, setEdgeHit] = useState(95);
  const [shieldOn, setShieldOn] = useState(false);
  const [shieldHit, setShieldHit] = useState(80);
  const [pops, setPops] = useState(100);
  const [priceId, setPriceId] = useState("blended");
  const [objectMB, setObjectMB] = useState(2.5);
  const [done, setDone] = useState(false);

  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const width = useWidth(stageRef);
  const price = PRICES.find((p) => p.id === priceId) ?? PRICES[2];

  const r = useMemo(
    () => computeOffload({ peakTbps: peak, edgeHit: edgeHit / 100, shieldOn, shieldHit: shieldHit / 100, pops, pricePerGB: price.perGB, objectMB }),
    [peak, edgeHit, shieldOn, shieldHit, pops, price.perGB, objectMB],
  );
  const over = r.originGbps >= TARGET_GBPS;
  const tw = useTween({ edgeIn: r.edgeInGbps, toShield: r.toShieldGbps, origin: r.originGbps, shieldOn: shieldOn ? 1 : 0 }, reduced);

  // Completion: first time the origin is under the target at the 8 Tbps reference peak.
  const doneRef = useRef(false);
  useEffect(() => {
    if (!doneRef.current && peak === REF_PEAK_TBPS && r.originGbps < TARGET_GBPS) {
      doneRef.current = true;
      setDone(true);
      onComplete?.();
    }
  }, [peak, r.originGbps, onComplete]);

  // "Down 60% from 400 Gbps": compare with the value before the current burst of changes.
  const burst = useRef({ base: r.originGbps, last: r.originGbps, t: 0 });
  const [from, setFrom] = useState<number | null>(null);
  useEffect(() => {
    const b = burst.current, now = performance.now();
    if (now - b.t > 1200) b.base = b.last;
    b.last = r.originGbps; b.t = now;
    setFrom(Math.abs(b.base - r.originGbps) > 0.5 && b.base > 0 ? b.base : null);
  }, [r.originGbps]);

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, reduced ? 0 : ms)); };

  const questions: PredictQuestion[] = [
    {
      id: "edge-98",
      prompt: "Edge hit ratio goes from 95% to 98%. How much does origin load drop?",
      options: ["About 3%", "About 30%", "About 60%", "About 98%"],
      answer: 2,
      explain: <>Misses fall from 5% to 2% of traffic. 2 is 40% of 5, so the origin sees 60% less. Near 100%, each point of hit ratio is worth far more than it looks.</>,
      showLabel: "Show 95% then 98%",
      show: () => { setPeak(8); setPops(100); setEdgeHit(95); later(() => setEdgeHit(98), 900); },
    },
    {
      id: "shield-on",
      prompt: "Shield off, edge at 95%, so the origin serves 400 Gbps. Turn on a shield that hits 80% of edge misses. What reaches the origin?",
      options: ["320 Gbps", "200 Gbps", "80 Gbps", "0 Gbps"],
      answer: 2,
      explain: <>The shield serves 80% of the 400 Gbps of edge misses. Only 20% gets through: 80 Gbps. Misses multiply: 5% x 20% = 1% of peak, so offload is 99%.</>,
      showLabel: "Turn the shield on",
      show: () => { setPeak(8); setPops(100); setEdgeHit(95); setShieldHit(80); setShieldOn(false); later(() => setShieldOn(true), 700); },
    },
    {
      id: "pops",
      prompt: "The shield is on. You grow from 100 to 400 edge PoPs. What happens to origin load?",
      options: ["Rises about 50%", "Stays about the same", "Falls"],
      answer: 1,
      explain: <>Each PoP now sees fewer viewers, so edge misses rise (by about 50% in this simple model). But those extra misses are repeat fetches of objects another PoP already pulled, and the shield has them. Turn the shield off and every extra miss lands on the origin.</>,
      showLabel: "Go to 400 PoPs",
      show: () => { setShieldOn(true); setPops(100); later(() => setPops(400), 700); },
    },
  ];

  const meterPct = Math.min(100, (tw.origin / METER_MAX) * 100);
  const targetPct = (TARGET_GBPS / METER_MAX) * 100;

  const stage = (
    <div className="so-col">
      <Stage className="so-stage">
        <div ref={stageRef} className="so-measure">
          {width > 0 && (
            <Sankey width={width} edgeIn={tw.edgeIn} toShield={tw.toShield} origin={tw.origin} shieldOn={tw.shieldOn}
              pops={pops} over={over} motion={!reduced} />
          )}
        </div>
        <div className={`so-meter ${over ? "bad" : "good"}`}>
          <div className="so-meter-top">
            <span>Origin load at peak</span>
            <strong>{fmtGbps(r.originGbps)}</strong>
          </div>
          <div className="so-meter-track" role="meter" aria-label="Origin load" aria-valuemin={0} aria-valuemax={METER_MAX} aria-valuenow={Math.round(r.originGbps)}
            aria-valuetext={`${fmtGbps(r.originGbps)}, target under ${TARGET_GBPS} Gbps`}>
            <div className="so-meter-fill" style={{ width: `${meterPct}%` }} />
            {from !== null && <div className="so-meter-prev" style={{ left: `${Math.min(100, (from / METER_MAX) * 100)}%` }} />}
            <div className="so-meter-target" style={{ left: `${targetPct}%` }} />
            {r.originGbps > METER_MAX && <span className="so-meter-off">off scale</span>}
          </div>
          <div className="so-meter-target-label" style={{ paddingLeft: `${targetPct}%` }}>Keep the origin under {TARGET_GBPS} Gbps</div>
          <p className="so-meter-msg" aria-live="polite">
            {from !== null && <span className="so-delta">{r.originGbps < from ? "Down" : "Up"} {fmtNum(Math.abs(1 - r.originGbps / from) * 100, 0)}% from {fmtGbps(from)}. </span>}
            {over
              ? <>Over target by {fmtGbps(r.originGbps - TARGET_GBPS)}. {shieldOn ? "Raise the hit ratios, or cut PoPs." : "Try turning on the shield."}</>
              : <>Under target. The origin serves {pct(1 - r.offload)} of peak traffic.</>}
          </p>
        </div>
        <p className="so-scale-note">Band widths use a square-root scale so the small origin flow stays visible.</p>
      </Stage>
      <StatGrid>
        <Stat label="Origin" value={fmtGbps(r.originGbps).split(" ")[0]} unit={fmtGbps(r.originGbps).split(" ")[1]} tone={over ? "bad" : "good"} sub={`target < ${TARGET_GBPS} Gbps`} />
        <Stat label="Origin requests" value={fmtRps(r.originRps)} unit="/s" sub={`at ${fmtNum(objectMB, 1)} MB per object`} />
        <Stat label="Origin egress / month" value={fmtNum(r.monthlyTB, 0)} unit="TB" sub={`${fmtMoney(r.monthlyCost)} at ${price.short}/GB`} tone={r.monthlyCost > 0 ? "neutral" : "good"} />
        <Stat label="Offload" value={pct(r.offload)} tone={r.offload >= 0.99 ? "good" : r.offload >= 0.975 ? "warn" : "bad"} sub="bytes never at origin" />
      </StatGrid>
      {done && <div className="so-done"><Icon name="check" size={18} stroke={2.25} className="so-done-icon" /><span>You kept the origin under {TARGET_GBPS} Gbps at an 8 Tbps peak.</span></div>}
    </div>
  );

  const controls = (
    <div className="so-controls-wrap"><div className="so-controls">
      <Slider label="Peak egress" value={peak} min={1} max={12} step={0.5} onChange={setPeak} format={(v) => `${fmtNum(v, v % 1 ? 1 : 0)} Tbps`}
        hint="8 Tbps is about 2M viewers at 4 Mbps (assumed)." />
      <Slider label="Edge byte hit ratio" value={edgeHit} min={80} max={99.5} step={0.5} onChange={setEdgeHit} format={(v) => `${fmtNum(v, v % 1 ? 1 : 0)}%`}
        hint={pops === 100 ? "Share of bytes the edge serves from cache." : `At 100 PoPs. With ${pops} PoPs the edge actually hits ${pct(1 - r.edgeMissRatio)}.`} />
      <Toggle label="Origin shield" checked={shieldOn} onChange={setShieldOn} hint="A cache tier between all edge PoPs and the origin." />
      <Slider label="Shield hit ratio on edge misses" value={shieldHit} min={50} max={95} step={1} onChange={setShieldHit} format={(v) => `${v}%`} disabled={!shieldOn}
        hint={shieldOn ? "It only sees the long tail, so 80% is excellent." : "Turn the shield on to use this."} />
      <Slider label="Edge PoPs" value={pops} min={25} max={400} step={25} onChange={setPops}
        hint="Simplified model: edge misses grow as (PoPs / 100)^0.3, because each PoP sees fewer viewers and the long tail is colder." />
      <div className="so-price">
        <Segmented label="Origin egress price per GB" value={priceId} onChange={setPriceId}
          options={PRICES.map((p) => ({ value: p.id, label: p.short }))} />
        <div className="ui-hint so-price-hint"><strong>{price.label}.</strong> {price.note}</div>
      </div>
      <Slider label="Average object size" value={objectMB} min={0.5} max={8} step={0.5} onChange={setObjectMB} format={(v) => `${fmtNum(v, 1)} MB`}
        hint="Turns Gbps into requests. 2.5 MB is one 5 s segment at 4 Mbps." />
    </div></div>
  );

  return <WidgetFrame stage={stage} controls={controls} footer={<Predict questions={questions} />} />;
}

function fmtRps(v: number): string {
  if (v >= 100_000) return `${fmtNum(v / 1000, 0)}k`;
  if (v >= 10_000) return `${fmtNum(v / 1000, 1)}k`;
  return fmtNum(v, 0);
}
