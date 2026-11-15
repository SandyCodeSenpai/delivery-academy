/**
 * One press of Play (widget id "press-play", Chapter 1).
 *
 * Steps through everything between a viewer pressing Play and the first frame:
 * playback API, steering, manifest, DRM license, first segments (HIT, or MISS through shield and origin), first frame.
 * Control-plane calls and data-plane byte fetches use different colors. A timeline adds up the milliseconds.
 * After the first walk-through the reader predicts which change hurts startup most, then flips the toggles.
 *
 * Props
 * - onComplete?: () => void   Called once, the first time the reader reaches step 6 (the first frame),
 *                              by Step or by Play all.
 * - compact?: boolean          true in a lesson (about 640px): swimlane, short caption, timeline, prediction.
 *                              false on the lab page: adds a side panel that explains each step in depth.
 * - autoplay?: boolean         If true, runs Play all once on mount.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Chip, Stage, Toggle, WidgetFrame } from "@/ui";
import { useReducedMotion, useWidth } from "@/lib/hooks";
import { clamp } from "@/lib/format";
import type { WidgetProps } from "../types";
import {
  ALL_TOGGLES, ASSUMPTIONS, NO_TOGGLES, STEPS, TOGGLES, computeSteps, fmtTime, soloCosts, totalMs,
  type Plane, type StepCalc, type ToggleKey, type Toggles,
} from "./model";
import { Swimlane } from "./Swimlane";
import { Timeline } from "./Timeline";
import "./press-play.css";

const N = STEPS.length;
const PLANE_LABEL: Record<Plane, string> = { control: "Control plane", data: "Data plane", player: "On the device" };

export default function PressPlay(props: WidgetProps) {
  const compact = props.compact !== false;
  const autoplay = props.autoplay === true;
  const onComplete = props.onComplete;
  const reduced = useReducedMotion();

  const [pos, setPos] = useState(0);            // steps done, 0..N
  const [animKey, setAnimKey] = useState(0);    // bumps on every forward step, so only that step animates
  const [playing, setPlaying] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [pick, setPick] = useState<ToggleKey | null>(null);
  const [toggles, setToggles] = useState<Toggles>(NO_TOGGLES);
  const completed = useRef(false);

  const calcs = useMemo(() => computeSteps(toggles), [toggles]);
  const best = useMemo(() => totalMs(NO_TOGGLES), []);
  const axisMax = useMemo(() => Math.ceil(totalMs(ALL_TOGGLES) / 500) * 500, []);
  const solo = useMemo(() => soloCosts(), []);

  const durFor = useCallback((i: number) => (reduced ? 0 : clamp(calcs[i].ms * 1.4, 600, 1500)), [calcs, reduced]);

  const forward = useCallback(() => {
    setPos((p) => Math.min(N, p + 1));
    setAnimKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (pos >= N && !completed.current) {
      completed.current = true;
      setReachedEnd(true);
      onComplete?.();
    }
  }, [pos, onComplete]);

  // Play all: advance one step, wait for its animation, then the next.
  useEffect(() => {
    if (!playing) return;
    if (pos >= N) { setPlaying(false); return; }
    const wait = pos === 0 ? 200 : reduced ? 700 : durFor(pos - 1) + 350;
    const t = setTimeout(forward, wait);
    return () => clearTimeout(t);
  }, [playing, pos, forward, durFor, reduced]);

  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => setPlaying(true), 400);
    return () => clearTimeout(t);
  }, [autoplay]);

  const onStep = () => { setPlaying(false); forward(); };
  const onBack = () => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); };
  const onPlayAll = () => {
    if (playing) { setPlaying(false); return; }
    if (pos >= N) setPos(0);
    setPlaying(true);
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const stageW = useWidth(stageRef);
  const cur = pos > 0 ? pos - 1 : -1;
  const anyOn = Object.values(toggles).some(Boolean);

  const stage = (
    <div className="pp-main">
      <Stage className="pp-stage">
        <div className="pp-legend" aria-label="Legend">
          <span><i className="pp-sw pp-sw-ctl" />Control plane: decisions, small, per viewer</span>
          <span><i className="pp-sw pp-sw-data" />Data plane: bytes from the CDN, cacheable</span>
          <span className="pp-legend-lines"><i className="pp-ln" />request <i className="pp-ln pp-ln-dash" />reply</span>
        </div>
        <div ref={stageRef} className="pp-swim-wrap">
          {stageW > 0 && (
            <Swimlane width={stageW} pos={pos} animKey={animKey} miss={toggles.miss} reduced={reduced} durFor={durFor} />
          )}
        </div>
      </Stage>

      <Caption cur={cur} calc={cur >= 0 ? calcs[cur] : null} toggles={toggles} compact={compact} reduced={reduced} />

      <div className="pp-transport">
        <Button size="m" onClick={onBack} disabled={pos === 0} aria-label="Back one step">Back</Button>
        <Button size="m" variant="primary" onClick={onStep} disabled={pos >= N}>{pos === 0 ? "Press Play" : "Step"}</Button>
        <span className="pp-spacer" />
        <Button size="m" variant="ghost" onClick={onPlayAll}>{playing ? "Pause" : pos >= N ? "Replay all" : "Play all"}</Button>
      </div>

      <Timeline calcs={calcs} pos={pos} axisMax={axisMax} best={pick && anyOn ? best : null} reduced={reduced} />

      <Experiment reachedEnd={reachedEnd} pick={pick} setPick={setPick} toggles={toggles} setToggles={setToggles}
        solo={solo} best={best} total={calcs.reduce((s, c) => s + c.ms, 0)} reduced={reduced} />
    </div>
  );

  if (compact) {
    return (
      <div className="pp-root">
        {stage}
        <details className="pp-assume pp-assume-compact">
          <summary>Assumptions behind the numbers</summary>
          <ul>{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
        </details>
      </div>
    );
  }
  return (
    <div className="pp-root pp-full">
      <WidgetFrame stage={stage} controls={<SidePanel cur={cur} calc={cur >= 0 ? calcs[cur] : null} />} />
    </div>
  );
}

function Caption({ cur, calc, toggles, compact, reduced }: { cur: number; calc: StepCalc | null; toggles: Toggles; compact: boolean; reduced: boolean }) {
  const s = cur >= 0 ? STEPS[cur] : null;
  return (
    <div className="pp-caption" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={cur} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduced ? 0 : 0.2 }}>
          {s && calc ? (
            <>
              <div className="pp-eyebrow">
                <span>Step {cur + 1} of {N}</span>
                <span className={`pp-plane-chip pp-chip-${s.plane}`}>{PLANE_LABEL[s.plane]}</span>
                <span className="pp-eyebrow-ms">{fmtTime(calc.ms)}</span>
              </div>
              <h4 className="pp-cap-title">{s.title}</h4>
              <p className="pp-cap-text">{s.short(toggles)}</p>
              {compact && (
                <div className="pp-parts">
                  {calc.parts.filter((p) => p.ms > 0).map((p) => (
                    <span key={p.label} className="pp-part">{p.label} <b>{fmtTime(p.ms)}</b></span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="pp-eyebrow"><span>Ready</span></div>
              <h4 className="pp-cap-title">A viewer presses Play</h4>
              <p className="pp-cap-text">Six things happen before the first frame appears. Some are decisions in the cloud, some are bytes from the CDN. Step through them and watch the time add up.</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Experiment(p: {
  reachedEnd: boolean; pick: ToggleKey | null; setPick: (k: ToggleKey) => void;
  toggles: Toggles; setToggles: (t: Toggles) => void; solo: { key: ToggleKey; ms: number }[];
  best: number; total: number; reduced: boolean;
}) {
  const { reachedEnd, pick, setPick, toggles, setToggles, solo, best, total, reduced } = p;
  const meta = (k: ToggleKey) => TOGGLES.find((t) => t.key === k)!;
  const lower = (k: ToggleKey) => { const l = meta(k).label; return l[0].toLowerCase() + l.slice(1); };
  const top = solo[0];
  const maxSolo = top.ms;

  if (!reachedEnd && !pick) {
    return (
      <div className="pp-exp pp-exp-locked">
        Step through to the first frame. Then you will predict what slows it down most.
      </div>
    );
  }

  if (!pick) {
    return (
      <motion.div className="pp-exp" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="pp-exp-kicker">Predict</div>
        <h4 className="pp-exp-q">Which change hurts startup most?</h4>
        <p className="pp-exp-sub">Each change is applied alone to the start you just watched ({fmtTime(best)}).</p>
        <div className="pp-options" role="group" aria-label="Your prediction">
          {TOGGLES.map((t) => (
            <Button key={t.key} size="s" className="pp-option" onClick={() => setPick(t.key)}>{t.pick}</Button>
          ))}
        </div>
      </motion.div>
    );
  }

  const right = pick === top.key;
  const pickMs = solo.find((s) => s.key === pick)!.ms;
  const active = solo.filter((s) => toggles[s.key]);
  const sumSolo = active.reduce((s, v) => s + v.ms, 0);
  const combined = total - best;
  const extra = combined - sumSolo;

  return (
    <motion.div className="pp-exp" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="pp-verdict">
        <Chip tone={right ? "good" : "warn"}>{right ? "Correct" : "Not quite"}</Chip>
        <span>
          {right
            ? <>{meta(top.key).label} adds <b>{fmtTime(top.ms)}</b> on its own, more than any other change.</>
            : <>You picked {lower(pick)} (+{fmtTime(pickMs)}). The biggest is {lower(top.key)}: <b>+{fmtTime(top.ms)}</b>.</>}
        </span>
      </div>
      <p className="pp-exp-why">
        Distance is paid on every round trip: the TCP handshake, each request, and each round of TCP slow start while the first
        segment downloads. That is why CDNs put PoPs close to viewers. Next is the slow license server: one control-plane call that every start must wait for.
      </p>

      <div className="pp-rank-head"><span>Change</span><span>Cost on its own</span></div>
      <div className="pp-rank">
        {solo.map((s) => {
          const m = meta(s.key);
          return (
            <div key={s.key} className={`pp-rank-row ${toggles[s.key] ? "on" : ""}`}>
              <div className="pp-rank-toggle">
                <Toggle label={m.label} hint={m.hint} checked={toggles[s.key]} onChange={(v) => setToggles({ ...toggles, [s.key]: v })} />
              </div>
              <div className="pp-rank-bar" aria-hidden="true">
                <motion.i initial={reduced ? false : { width: 0 }} animate={{ width: `${(s.ms / maxSolo) * 100}%` }}
                  transition={{ duration: reduced ? 0 : 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
              <div className="pp-rank-ms">+{fmtTime(s.ms)}{s.key === pick && <span className="pp-yours">your pick</span>}</div>
            </div>
          );
        })}
      </div>
      <p className="pp-exp-foot">
        {active.length >= 2 && extra > 5
          ? <>Together these add <b>+{fmtTime(combined)}</b>, which is {fmtTime(extra)} more than their separate costs. They compound: a far viewer pays more for every handshake.</>
          : active.length > 0
            ? <>Startup is now <b>{fmtTime(total)}</b>. Try a far viewer with a new TLS connection: they compound.</>
            : <>Flip the switches and watch the timeline. All numbers are assumed, for one example viewer.</>}
      </p>
    </motion.div>
  );
}

function SidePanel({ cur, calc }: { cur: number; calc: StepCalc | null }) {
  const s = cur >= 0 ? STEPS[cur] : null;
  return (
    <aside className="pp-side" aria-live="polite">
      {s && calc ? (
        <>
          <div className="pp-eyebrow"><span>Step {cur + 1} of {N}</span><span className={`pp-plane-chip pp-chip-${s.plane}`}>{PLANE_LABEL[s.plane]}</span></div>
          <h4 className="pp-side-title">{s.title}</h4>
          <section><h5>What happens</h5><p>{s.what}</p></section>
          <section><h5>Who owns it</h5><p>{s.owner}</p></section>
          <section><h5>What can go wrong</h5><p>{s.wrong}</p></section>
          <section>
            <h5>Where the time goes</h5>
            <table className="pp-break">
              <tbody>
                {calc.parts.map((p) => (
                  <tr key={p.label} className={p.ms === 0 ? "zero" : ""}><td>{p.label}</td><td>{fmtTime(p.ms)}</td></tr>
                ))}
                <tr className="sum"><td>Step total</td><td>{fmtTime(calc.ms)}</td></tr>
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <>
          <div className="pp-eyebrow"><span>Two planes</span></div>
          <h4 className="pp-side-title">Decisions, then bytes</h4>
          <section>
            <p><b className="pp-t-ctl">Control plane</b> calls decide: may this viewer watch, which CDN, which keys. They are small, different for every viewer, run in cloud regions, and cannot be cached.</p>
            <p><b className="pp-t-data">Data plane</b> fetches move the content: manifests and segments. They are the same for many viewers, so CDN edges cache them.</p>
            <p>If the control plane is down, nobody can start. If the data plane is slow, starts work but playback stalls. When you get paged, ask first: which plane?</p>
          </section>
        </>
      )}
      <details className="pp-assume">
        <summary>Assumptions behind the numbers</summary>
        <ul>{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
    </aside>
  );
}
