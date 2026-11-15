/**
 * Health checks and failover (chapter 12).
 *
 * A primary and a secondary (an origin or a CDN) behind a health checker. The reader tunes the
 * check (interval, timeout, failure threshold N, recovery threshold M, jitter), picks a scenario and
 * watches 10 minutes play out: probe results as a dot strip, the health state, traffic shares,
 * errors served, time to detect and the number of flips. Toggles show static stability (a pre-scaled
 * secondary), retry storms (immediate retries vs backoff with jitter) and fail-open (Route 53 style
 * "all unhealthy, so treat all as healthy").
 *
 * Props:
 * - `onComplete?: () => void` Called once when the reader meets the challenge: with the current
 *   health-check settings, the flapping scenario causes 0 flips AND the hard outage is detected in
 *   under 60 s. Both are checked live against fresh simulations, whatever scenario is on screen.
 * - `scenario?: "outage" | "flapping" | "brownout" | "checker"` The scenario shown first.
 *   Default "flapping". The reader can still switch scenarios.
 * - `compact?: boolean` From WidgetProps. Lesson mode (about 640 px wide).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetProps } from "../types";
import { Button, Callout, Chip, Segmented, Slider, Stat, StatGrid, Toggle, WidgetFrame } from "@/ui";
import { fmtNum, fmtPct } from "@/lib/format";
import { useRaf, useReducedMotion, useWidth } from "@/lib/hooks";
import { DEFAULTS, DURATION, SCENARIOS, challenge, fmtClock, simulate, type RetryMode, type ScenarioId, type Settings } from "./sim";
import Diagram from "./Diagram";
import Timeline from "./Timeline";
import "./failover.css";

const SPEED = DURATION / 15; // 10 simulated minutes in 15 seconds
const isScenario = (v: unknown): v is ScenarioId => typeof v === "string" && v in SCENARIOS;
const FAULT_LABEL: Record<ScenarioId, string> = { outage: "outage", flapping: "primary down", brownout: "brownout", checker: "checker cut off" };

export default function FailoverWidget(props: WidgetProps) {
  const { onComplete, compact } = props;
  const initial: ScenarioId = isScenario(props.scenario) ? props.scenario : "flapping";
  const reduced = useReducedMotion();

  const [scenario, setScenario] = useState<ScenarioId>(initial);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [t, setT] = useState(() => (reduced ? DURATION : 0));
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => { if (isScenario(props.scenario)) setScenario(props.scenario); }, [props.scenario]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => {
    const n = { ...s, [k]: v };
    if (k === "interval") n.timeout = Math.min(n.timeout, n.interval);
    return n;
  });

  const sim = useMemo(() => simulate(scenario, settings), [scenario, settings]);
  const probesByDone = useMemo(() => [...sim.probes].sort((a, b) => a.done - b.done), [sim]);
  const peakSoFar = useMemo(() => { let m = 1; return sim.ticks.map((k) => (m = Math.max(m, k.mult))); }, [sim]);
  const ch = useMemo(() => challenge(settings), [settings]);

  // Challenge completion fires once.
  const fired = useRef(false);
  useEffect(() => { if (ch.done && !fired.current) { fired.current = true; onComplete?.(); } }, [ch.done, onComplete]);

  // Playback.
  useRaf((dt) => setT((v) => Math.min(DURATION, Math.max(0, v + Math.max(0, dt) * SPEED))), playing);
  useEffect(() => { if (playing && t >= DURATION) setPlaying(false); }, [playing, t]);

  const pickScenario = (v: ScenarioId) => { setScenario(v); if (reduced) setT(DURATION); else { setT(0); setPlaying(true); } };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (t >= DURATION) setT(0);
    setPlaying(true);
  };
  const scrub = useCallback((v: number) => { setPlaying(false); setT(v); }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const W = useWidth(stageRef);

  const i = Math.max(0, Math.min(DURATION - 1, Math.floor(t)));
  const tick = sim.ticks[i];
  const errSoFar = sim.cumErr[i] / (i + 1);
  const flipsSoFar = sim.flipTimes.filter((x) => x <= t).length;
  const detected = sim.detectAt !== null && sim.detectAt <= t;
  const lastEvent = [...sim.events].reverse().find((e) => e.t <= t);
  const faultStarted = sim.faults.length > 0 && t >= sim.faults[0][0];

  const errTone = errSoFar > 0.05 ? "bad" : errSoFar > 0.01 ? "warn" : "good";
  const detectStat = scenario === "checker"
    ? { label: "False alarm after", value: detected ? fmtNum(sim.detect ?? 0) : "none", unit: detected ? "s" : undefined, tone: detected ? "warn" as const : "good" as const, sub: "targets were fine" }
    : { label: "Time to detect", value: detected ? fmtNum(sim.detect ?? 0) : faultStarted ? "not yet" : "no fault yet", unit: detected ? "s" : undefined,
        tone: detected ? ((sim.detect ?? 0) < 60 ? "good" as const : "warn" as const) : "neutral" as const, sub: "fault start to unhealthy" };

  const stage = (
    <div className="fo-main">
      <div className="fo-head">
        <Segmented<ScenarioId> label="Scenario" value={scenario} onChange={pickScenario}
          options={(Object.keys(SCENARIOS) as ScenarioId[]).map((k) => ({ value: k, label: SCENARIOS[k].short }))} />
        <Button size="s" variant={playing ? "secondary" : "primary"} onClick={togglePlay} aria-label={playing ? "Pause" : t >= DURATION ? "Replay 10 minutes" : "Play"}>
          {playing ? "Pause" : t >= DURATION ? "Replay" : "Play"}
        </Button>
      </div>
      <p className="fo-blurb">{SCENARIOS[scenario].blurb}</p>

      <div className={`ui-stage fo-stage${playing && !reduced ? "" : " fo-paused"}`}>
        <div ref={stageRef} className="fo-measure">
          {W > 0 && (
            <>
              <Diagram W={W} tick={tick} t={t} probes={probesByDone} settings={settings} scenario={scenario} flowing={playing && !reduced} />
              <div className="fo-caption" aria-live={playing ? "off" : "polite"}>
                <time>{fmtClock(Math.min(t, DURATION - 0.01))}</time>
                <span className={lastEvent ? `tone-${lastEvent.tone}` : undefined}>{lastEvent ? lastEvent.text : "All quiet. Every check passes and all traffic is on the primary."}</span>
              </div>
              <Timeline W={W} sim={sim} t={t} onScrub={scrub} faultLabel={FAULT_LABEL[scenario]} />
            </>
          )}
        </div>
      </div>

      <div className="fo-stats">
        <StatGrid>
          <Stat label="Primary health" value={tick.upP ? "Healthy" : "Unhealthy"} tone={tick.upP ? "good" : "bad"} sub={tick.upP ? `fails in a row ${Math.min(tick.cfP, settings.failN)}/${settings.failN}` : `passes in a row ${Math.min(tick.csP, settings.passM)}/${settings.passM}`} />
          <Stat label="Traffic on primary" value={fmtPct(tick.shareP)} sub={`secondary ${fmtPct(tick.shareS)}`} tone="accent" />
          <Stat label="Errors served" value={fmtPct(errSoFar, 1)} tone={errTone} sub="of requests so far" />
          <Stat label={detectStat.label} value={detectStat.value} unit={detectStat.unit} tone={detectStat.tone} sub={detectStat.sub} />
          <Stat label="Flips" value={flipsSoFar} tone={flipsSoFar > 2 ? "bad" : "neutral"} sub="primary health changes" />
          <Stat label="Retry load" value={`${fmtNum(peakSoFar[i], 1)}×`} tone={peakSoFar[i] > 1.8 ? "bad" : peakSoFar[i] > 1.25 ? "warn" : "neutral"} sub="peak requests per view" />
        </StatGrid>
      </div>

      {scenario === "checker" && (
        <Callout type="industry">
          A checker that loses its own network sees every target fail at once. It cannot tell "everything is down" from "I am cut off".
          Route 53 handles this case: if every record in a group is unhealthy, it treats all of them as healthy. Turn off <b>Fail open</b> to see what happens without it.
        </Callout>
      )}
    </div>
  );

  const controls = (
    <div className="fo-ctl">
      <div className="fo-sec">Health check</div>
      <div className="fo-ctl-grid">
        <Slider label="Interval" value={settings.interval} min={5} max={60} step={5} onChange={(v) => set("interval", v)} format={(v) => `${v} s`} />
        <Slider label="Timeout" value={settings.timeout} min={1} max={Math.min(10, settings.interval)} onChange={(v) => set("timeout", v)} format={(v) => `${v} s`} />
        <Slider label="Failure threshold" value={settings.failN} min={1} max={10} onChange={(v) => set("failN", v)} format={(v) => `${v} in a row`} hint="Mark down after N failed checks in a row." />
        <Slider label="Recovery threshold" value={settings.passM} min={1} max={10} onChange={(v) => set("passM", v)} format={(v) => `${v} in a row`} hint="Mark up after M passes in a row (hysteresis)." />
        <Slider label="Jitter" value={Math.round(settings.jitter * 100)} min={0} max={50} step={5} onChange={(v) => set("jitter", v / 100)} format={(v) => `±${v}%`} hint="Random spread on each interval." />
      </div>
      <div className="fo-sec">Clients and capacity</div>
      <div className="fo-ctl-grid">
        <Toggle label="Secondary pre-scaled" hint="Static stability: capacity is ready before failover." checked={settings.prescaled} onChange={(v) => set("prescaled", v)} />
        <Toggle label="Fail open" hint="If all look unhealthy, treat all as healthy." checked={settings.failOpen} onChange={(v) => set("failOpen", v)} />
        <Segmented<RetryMode> label="Client retries" value={settings.retries} onChange={(v) => set("retries", v)}
          options={[{ value: "backoff", label: "Backoff + jitter" }, { value: "immediate", label: "Immediate" }]} />
        <div className="fo-reset"><Button size="s" variant="ghost" onClick={() => setSettings(DEFAULTS)}>Reset settings</Button></div>
      </div>
    </div>
  );

  const detectTxt = ch.outageDetect === null ? "not detected" : `${fmtNum(ch.outageDetect)} s`;
  const footer = (
    <section className={`fo-challenge${ch.done ? " done" : ""}`} aria-live="polite">
      <div className="fo-ch-top">
        <span className="fo-sec">Challenge</span>
        {ch.done ? <Chip tone="good">Done</Chip> : <Chip>Live check</Chip>}
      </div>
      <p className="fo-ch-text">Tune the health check so the <b>flapping</b> scenario causes <b>0 flips</b> and a <b>hard outage</b> is detected in <b>under 60 s</b>.</p>
      <div className={`fo-check${ch.flipsOk ? " ok" : ""}`}><i aria-hidden="true" />Flapping: {ch.flapFlips} flip{ch.flapFlips === 1 ? "" : "s"} <span className="fo-need">need 0</span></div>
      <div className={`fo-check${ch.detectOk ? " ok" : ""}`}><i aria-hidden="true" />Hard outage: detected in {detectTxt} <span className="fo-need">need under 60 s</span></div>
      <p className="fo-ch-note">
        {ch.done
          ? `Done. ${settings.failN} failure${settings.failN > 1 ? "s" : ""} in a row at ${settings.interval} s rides out a 20 s blip, and a real outage still trips it in about ${fmtNum(ch.outageDetect ?? 0)} s. That is the trade every health check makes.`
          : "Think: how many checks can land inside a 20 s blip? And how long do N failed checks take when the outage is real?"}
      </p>
    </section>
  );

  return (
    <div className={`fo${compact ? " fo-compact" : ""}`}>
      <WidgetFrame stage={stage} controls={controls} footer={footer} />
    </div>
  );
}
