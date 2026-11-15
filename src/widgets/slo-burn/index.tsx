/**
 * slo-burn: "Error budgets and burn rates" (Chapter 11, Sections 11.7 and 11.10).
 *
 * The reader sets a playback SLO (99.5%, 99.9% or 99.95% of sessions over 30 days), injects an
 * incident (error rate, who is hit, duration, start time, or a preset), and watches a replay of the
 * error rate, four alert rules and the 30-day error budget. It compares a naive static threshold
 * (errors above 1% for 5 min) with the Google SRE workbook's multi-window, multi-burn-rate alerts
 * (page 14.4x over 1h/5m, page 6x over 6h/30m, ticket 1x over 3d/6h), and shows the book's Datadog
 * Terraform monitor with live values. Four predict-then-check questions drive the default path.
 *
 * Props
 * - onComplete?: () => void
 *     Called exactly once, when the reader has SEEN (the replay playhead has passed the moment it fires)
 *     both (1) a fast-burn page: the 14.4x over 1h/5m rule firing, and (2) a slow-burn ticket: the
 *     1x over 3d/6h ticket firing in an incident where no page fired. The default "Total outage" replay
 *     gives (1); the "One ISP slow burn" preset (or predict question 1) at 99.9% gives (2).
 * - preset?: "outage" | "isp" | "blip"
 *     Incident to open with. Default "outage" (Total outage, 10 min, at 99.9%).
 * - compact?: boolean  (from the lesson player; shorter charts)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { WidgetProps } from "../types";
import { Button, Chip, Icon, Segmented, Slider, Stage, Stat, StatGrid, WidgetFrame, Eyebrow, springs } from "@/ui";
import { fmtNum } from "@/lib/format";
import { useRaf, useReducedMotion } from "@/lib/hooks";
import Timeline, { type View } from "./Timeline";
import Datadog from "./Datadog";
import {
  DUR_STEPS, PRESETS, RATE_STEPS, SESSIONS_PER_MIN, SHARES, SHARE_LABEL, WINDOW_MIN, budgetLeft, burnResult, clock, dur, nearest, pct,
  simulate, sloLabel, staticResult, toIncident, type PresetId, type Scenario, type Share, type Sim, type SloTarget, type StyleResult, type Verdict,
} from "./model";
import "./slo-burn.css";

const SWEEP_S = 2.4;
const ease = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);

/* ---------- Predict questions ---------- */
interface Question {
  id: string;
  prompt: string;
  options: string[];
  sc: Scenario & { slo: SloTarget };
  answer: (s: Sim) => number;
  explain: (s: Sim) => string;
}
const det = (s: Sim, t: number | null) => (t == null ? null : t + 1 - s.inc.start);
const QUESTIONS: Question[] = [
  {
    id: "isp",
    prompt: "One ISP carries about 10% of sessions (assumed). Its viewers fail 2% of the time, for 2 days. Does the static alert (errors above 1% for 5 min) catch it?",
    options: ["Yes, within minutes", "Yes, but hours later", "No, it never fires"],
    sc: { ...PRESETS[1].sc, slo: 0.999 },
    answer: (s) => { const d = det(s, s.rules.static.first); return d == null ? 2 : d < 60 ? 0 : 1; },
    explain: (s) => {
      const t = det(s, s.rules.ticket.first);
      return `Spread over all traffic, 2% of 10% is only ${pct(s.inc.rate * s.inc.share)} errors, far under the 1% line. Yet over 2 days it spends ${pct(s.incSpend)} of the month's budget. ` +
        (t != null ? `The burn-rate ticket notices after ${dur(t)}.` : "At this SLO the burn-rate alerts stay quiet too.");
    },
  },
  {
    id: "blip",
    prompt: "A tiny blip: 3% of all sessions fail for 6 minutes, at 3 a.m. Who gets paged?",
    options: ["Only the static alert", "Only the burn-rate alerts", "Both", "Nobody"],
    sc: { ...PRESETS[2].sc, slo: 0.999 },
    answer: (s) => { const a = staticResult(s).page != null, b = burnResult(s).page != null; return a && !b ? 0 : b && !a ? 1 : a && b ? 2 : 3; },
    explain: (s) => `Only the static alert. The blip spends just ${pct(s.incSpend)} of the budget, so waking someone is a false page. ` +
      `The 1h window averages it down to about ${pct((s.inc.rate * s.inc.share * Math.min(60, s.inc.dur)) / 60)}, under the 14.4x line at ${pct(14.4 * (1 - s.slo))}.`,
  },
  {
    id: "region",
    prompt: "One region (25% of sessions) fails 3% of the time for 6 hours. Which alert fires first?",
    options: ["The static alert, in minutes", "The 6x page, hours in", "Only the ticket", "Nothing fires"],
    sc: { rate: 0.03, share: 0.25, dur: 360, startH: 20 * 24 + 18, slo: 0.999 },
    answer: (s) => (s.rules.static.first != null ? 0 : s.rules.fast.first != null || s.rules.slow.first != null ? 1 : s.rules.ticket.first != null ? 2 : 3),
    explain: (s) => {
      const t = det(s, s.rules.slow.first);
      return `Global errors are about ${pct(s.inc.rate * s.inc.share)}: under the static 1% line, above the 6x line (${pct(6 * (1 - s.slo))}). ` +
        (t != null ? `The 6h window needs time to fill, so the page fires after ${dur(t)}. Slow, but it is a real page for a real problem.` : "The 6h window never fills enough to page.");
    },
  },
  {
    id: "slo",
    prompt: "At 99.9%, the 10-minute total outage spends about 23% of the month's budget. At 99.95%, what does the same outage spend?",
    options: ["About the same, 23%", "About twice as much, 46%", "About half, 12%"],
    sc: { ...PRESETS[0].sc, slo: 0.9995 },
    answer: () => 1,
    explain: (s) => `The 99.95% budget is ${fmtNum(s.budgetMin, 1)} minutes of full outage, half of 43.2. So the same 10 minutes spend ${pct(s.incSpend)}. ` +
      `The burn-rate lines move with the target (14.4x is now ${pct(14.4 * (1 - s.slo))}). The static 1% line does not: it knows nothing about your SLO.`,
  },
];

/* ---------- Verdict copy ---------- */
const VERDICT: Record<Verdict, { label: string; tone: "good" | "bad" | "warn" }> = {
  caught: { label: "Caught", tone: "good" },
  missed: { label: "Missed incident", tone: "bad" },
  "false-page": { label: "False page", tone: "bad" },
  "ticket-only": { label: "Ticket only, too soft", tone: "warn" },
  "noisy-ticket": { label: "Extra ticket", tone: "warn" },
  quiet: { label: "Quiet, correct", tone: "good" },
};
const WORTH: Record<Sim["worth"], string> = { page: "deserves a page", ticket: "deserves a ticket", none: "deserves no alert" };

function scenarioKey(sc: { rate: number; share: number; dur: number; startH: number }) { return `${sc.rate}|${sc.share}|${sc.dur}|${sc.startH}`; }

export default function SloBurn({ onComplete, preset, compact = false }: WidgetProps & { preset?: PresetId }) {
  const reduced = useReducedMotion();
  const initial = (PRESETS.find((p) => p.id === preset) ?? PRESETS[0]).sc;

  const [slo, setSlo] = useState<SloTarget>(0.999);
  const [rateI, setRateI] = useState(nearest(RATE_STEPS, initial.rate));
  const [share, setShare] = useState<Share>(initial.share);
  const [durI, setDurI] = useState(nearest(DUR_STEPS, initial.dur));
  const [startH, setStartH] = useState(initial.startH);
  const [p, setP] = useState(() => (reduced ? 1 : 0));

  const rate = RATE_STEPS[rateI], durM = DUR_STEPS[durI];
  const maxStartH = Math.floor((WINDOW_MIN - durM) / 60);
  const sH = Math.min(startH, maxStartH);
  const sc: Scenario = { rate, share, dur: durM, startH: sH };
  const key = scenarioKey(sc);

  const sim = useMemo(() => simulate(slo, toIncident(sc)), [slo, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const presetSims = useMemo(() => PRESETS.map((pr) => ({ ...pr, sim: simulate(slo, toIncident(pr.sc)) })), [slo]);
  const activePreset = PRESETS.find((pr) => scenarioKey(pr.sc) === key)?.id ?? null;

  // View window around the incident, wide enough for every first fire.
  const view: View = useMemo(() => {
    const s = sim.inc.start, e = s + sim.inc.dur;
    const firsts = Object.values(sim.rules).map((r) => r.first).filter((x): x is number => x != null);
    const lastFire = Math.max(e, ...firsts);
    const pre = Math.max(10, Math.round(sim.inc.dur * 0.2));
    const post = Math.max(20, Math.round(sim.inc.dur * 0.35), Math.round((lastFire - s) * 0.12));
    return { t0: s - pre, t1: Math.min(WINDOW_MIN, Math.max(e, lastFire) + post) };
  }, [sim]);

  // Replay sweep.
  const replay = () => setP(reduced ? 1 : 0);
  useRaf((dt) => setP((q) => Math.min(1, q + dt / SWEEP_S)), p < 1);
  const playT = p >= 1 ? Infinity : view.t0 + ease(p) * (view.t1 - view.t0);
  const seenAt = (t: number | null) => t != null && t <= Math.min(view.t1, playT);

  // Scenario changes.
  const apply = (s: Scenario & { slo?: SloTarget }, animate: boolean) => {
    if (s.slo) setSlo(s.slo);
    setRateI(nearest(RATE_STEPS, s.rate)); setShare(s.share); setDurI(nearest(DUR_STEPS, s.dur)); setStartH(s.startH);
    setP(animate && !reduced ? 0 : 1);
  };
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setP(1); };
  useEffect(() => { if (preset) apply((PRESETS.find((x) => x.id === preset) ?? PRESETS[0]).sc, true); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Completion: a fast-burn page and a slow-burn ticket, each seen firing.
  const [goals, setGoals] = useState({ fast: false, ticket: false });
  const doneRef = useRef(false);
  useEffect(() => {
    const fast = seenAt(sim.rules.fast.first);
    const ticket = seenAt(sim.rules.ticket.first) && sim.rules.fast.first == null && sim.rules.slow.first == null;
    if ((fast && !goals.fast) || (ticket && !goals.ticket)) setGoals((g) => ({ fast: g.fast || fast, ticket: g.ticket || ticket }));
  }); // runs each frame of the sweep; cheap
  useEffect(() => {
    if (goals.fast && goals.ticket && !doneRef.current) { doneRef.current = true; onComplete?.(); }
  }, [goals, onComplete]);

  // Predict flow.
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = QUESTIONS[qi] as Question | undefined;
  const qSim = useMemo(() => (q ? simulate(q.sc.slo, toIncident(q.sc)) : null), [q]);
  const revealed = picked != null && p >= 1;
  const correct = q && qSim ? q.answer(qSim) : -1;
  const pick = (i: number) => {
    if (!q || picked != null) return;
    setPicked(i);
    if (qSim && i === q.answer(qSim)) setScore((s) => s + 1);
    apply(q.sc, true);
  };
  const nextQ = () => { setPicked(null); setQi((i) => i + 1); };
  const restartQ = () => { setPicked(null); setQi(0); setScore(0); };

  const st = staticResult(sim), br = burnResult(sim);
  const endLeft = budgetLeft(sim, WINDOW_MIN);
  const burnFollow = sim.rules.fast.first != null ? "fast" : sim.rules.slow.first != null ? "slow" : sim.rules.ticket.first != null ? "ticket" : null;
  const showResults = p >= 1;

  const rows = [
    ...presetSims.map((x) => ({ id: x.id, label: x.label, sim: x.sim })),
    ...(activePreset ? [] : [{ id: "you", label: "Your incident", sim }]),
  ];
  const tally = (f: (s: Sim) => StyleResult) => {
    let missed = 0, falsePages = 0;
    for (const r of rows) { const v = f(r.sim).verdict; if (v === "missed") missed++; if (v === "false-page") falsePages++; }
    return { missed, falsePages };
  };
  const tStatic = tally(staticResult), tBurn = tally(burnResult);

  const stage = (
    <Stage className="slo-stage">
      <div className="slo-stats">
        <StatGrid>
          <Stat label="Error budget" value={fmtNum(sim.budgetMin, 1)} unit="min" sub={`of full outage per 30 days at ${sloLabel(slo)}`} />
          <Stat label="Failed sessions allowed" value={fmtNum(sim.budgetSessions)} sub={`at ~${fmtNum(Math.round(SESSIONS_PER_MIN / 100) * 100)} sessions a minute (assumed)`} />
          <Stat label="This incident spends" value={pct(sim.incSpend)} tone={sim.incSpend >= 0.1 ? "bad" : sim.incSpend >= 0.02 ? "warn" : "neutral"} sub={`${fmtNum(sim.incFailed)} failed sessions`} />
          <Stat label="Left at day 30" value={pct(endLeft)} tone={endLeft < 0 ? "bad" : endLeft < 0.25 ? "warn" : "good"} sub={endLeft < 0 ? "budget overspent" : "if nothing else breaks"} />
        </StatGrid>
      </div>
      <Timeline sim={sim} view={view} playT={playT} compact={compact} />
      <div className="slo-stagebar">
        <span className="slo-small">Replay of the incident. Thresholds are shown for {sloLabel(slo)}.</span>
        <Button variant="ghost" size="s" onClick={replay} disabled={p < 1}><Icon name="reset" size={16} />Replay</Button>
      </div>
    </Stage>
  );

  const controls = (
    <>
      <div>
        <Segmented<SloTarget> label="SLO target" value={slo} onChange={edit(setSlo)}
          options={[{ value: 0.995, label: "99.5%" }, { value: 0.999, label: "99.9%" }, { value: 0.9995, label: "99.95%" }]} />
        <div className="slo-small slo-mt">Playback availability by session, over 30 days.</div>
      </div>
      <div className="slo-sep" />
      <div className="slo-ctl-title">Inject an incident</div>
      <div className="slo-presets" role="group" aria-label="Incident presets">
        {PRESETS.map((pr) => (
          <Button key={pr.id} size="s" variant={activePreset === pr.id ? "tinted" : "secondary"} aria-pressed={activePreset === pr.id} onClick={() => apply(pr.sc, true)}>{pr.label}</Button>
        ))}
      </div>
      <Slider label="Error rate" value={rateI} min={0} max={RATE_STEPS.length - 1} onChange={edit(setRateI)} format={(i) => pct(RATE_STEPS[i])} hint="Share of sessions that fail, inside the affected traffic." />
      <Segmented<Share> label="Who is hit" value={share} onChange={edit(setShare)} options={SHARES.map((s) => ({ value: s, label: SHARE_LABEL[s] }))} />
      <Slider label="Duration" value={durI} min={0} max={DUR_STEPS.length - 1} onChange={edit(setDurI)} format={(i) => dur(DUR_STEPS[i])} />
      <Slider label="Starts" value={sH} min={0} max={maxStartH} onChange={edit(setStartH)} format={(h) => clock(h * 60)} />
    </>
  );

  const card = (title: string, sub: string, r: StyleResult, kind: "static" | "burn") => {
    const v = VERDICT[r.verdict];
    const pageD = det(sim, r.page), ticketD = det(sim, r.ticket);
    const line =
      r.verdict === "missed" ? `Never fired, but the incident spent ${pct(sim.incSpend)} of the budget.`
      : r.verdict === "false-page" ? `Woke someone for an incident that spent only ${pct(sim.incSpend)} of the budget.`
      : r.verdict === "quiet" ? `Stayed quiet. The incident spent only ${pct(sim.incSpend)} of the budget.`
      : r.verdict === "ticket-only" ? "Only a ticket, for an incident that needed a page."
      : r.verdict === "noisy-ticket" ? "Opened a ticket for an incident that did not need one."
      : pageD != null ? `Paged ${dur(pageD)} after the incident started.` : `Ticket opened ${dur(ticketD!)} after the incident started.`;
    return (
      <div className={`slo-card ${kind}`}>
        <div className="slo-card-head">
          <div><div className="slo-h">{title}</div><div className="slo-small">{sub}</div></div>
          {showResults && <Chip tone={v.tone}>{v.label}</Chip>}
        </div>
        <div className="slo-card-stats">
          <Stat label="Time to page" value={showResults ? (pageD != null ? dur(pageD) : "No page") : "..."} tone={showResults && pageD != null ? "bad" : "neutral"} />
          {kind === "burn" && <Stat label="Time to ticket" value={showResults ? (ticketD != null ? dur(ticketD) : "No ticket") : "..."} tone={showResults && ticketD != null ? "warn" : "neutral"} />}
        </div>
        <p className="slo-line">{showResults ? line : "Replaying..."}</p>
      </div>
    );
  };

  const cell = (s: Sim, r: StyleResult) => {
    const v = VERDICT[r.verdict];
    const pd = det(s, r.page), td = det(s, r.ticket);
    const text = r.verdict === "missed" ? "missed" : r.verdict === "false-page" ? `false page, ${dur(pd!)}` : r.verdict === "quiet" ? "quiet"
      : pd != null ? `page, ${dur(pd)}` : td != null ? `ticket, ${dur(td)}` : v.label;
    return <Chip tone={v.tone}>{text}</Chip>;
  };

  const footer = (
    <div className="slo-footer">
      <div className="slo-worth">
        <span className="slo-small">This incident <strong>{WORTH[sim.worth]}</strong>.</span>
        <span className="slo-small slo-muted">Rule of thumb from the SRE workbook: page if it spends 2% of the budget in 1 hour or 5% in 6 hours; ticket if 10% in 3 days.</span>
      </div>
      <div className="slo-cards">
        {card("(a) Static threshold", "Errors above 1% for 5 minutes", st, "static")}
        {card("(b) Burn-rate alerts", "14.4x and 6x pages, 1x ticket", br, "burn")}
      </div>

      <div className="slo-board">
        <div className="slo-h">Scoreboard at {sloLabel(slo)}</div>
        <table>
          <thead><tr><th scope="col">Incident</th><th scope="col">(a) Static</th><th scope="col">(b) Burn-rate</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={(activePreset ?? "you") === r.id ? "on" : ""}>
                <th scope="row">{r.label}<span>{WORTH[r.sim.worth]}</span></th>
                <td>{cell(r.sim, staticResult(r.sim))}</td>
                <td>{cell(r.sim, burnResult(r.sim))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">Total</th>
              <td>{tStatic.missed} missed, {tStatic.falsePages} false {tStatic.falsePages === 1 ? "page" : "pages"}</td>
              <td>{tBurn.missed} missed, {tBurn.falsePages} false {tBurn.falsePages === 1 ? "page" : "pages"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Datadog sim={sim} follow={burnFollow} />
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={`slo ${compact ? "compact" : "full"}`}>
        <div className="slo-top">
          <div className="slo-goals" aria-label="Goals">
            <span className="slo-small">Goal:</span>
            <Chip tone={goals.fast ? "good" : "neutral"}>{goals.fast && <Icon name="check" size={14} stroke={2.4} />}See a fast-burn page</Chip>
            <Chip tone={goals.ticket ? "good" : "neutral"}>{goals.ticket && <Icon name="check" size={14} stroke={2.4} />}See a slow-burn ticket</Chip>
          </div>
        </div>

        {q ? (
          <section className="slo-predict" aria-label="Predict">
            <Eyebrow dot="var(--p5)">Predict, then watch · {qi + 1} of {QUESTIONS.length}</Eyebrow>
            <p className="slo-q">{q.prompt}</p>
            <div className="slo-opts">
              {q.options.map((o, i) => {
                const state = revealed ? (i === correct ? "right" : i === picked ? "wrong" : "") : i === picked ? "picked" : "";
                return (
                  <button key={i} type="button" className={`slo-opt ${state}`} disabled={picked != null} aria-pressed={picked === i} onClick={() => pick(i)}>
                    <span>{o}</span>
                    {state === "right" && <Icon name="check" size={18} stroke={2.4} />}
                    {state === "wrong" && <Icon name="x" size={18} stroke={2.4} />}
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {picked != null && !revealed && (
                <motion.div key="run" className="slo-running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="slo-pulse" aria-hidden="true" />Watch the timeline below.
                </motion.div>
              )}
              {revealed && qSim && (
                <motion.div key="fb" className={`slo-fb ${picked === correct ? "good" : "bad"}`} role="status"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.smooth}>
                  <strong>{picked === correct ? "Correct." : "Not quite."}</strong> {q.explain(qSim)}
                  <div className="slo-fb-actions">
                    <Button variant="primary" size="s" onClick={nextQ}>{qi + 1 < QUESTIONS.length ? "Next question" : "Finish"}<Icon name="arrow-right" size={16} /></Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <section className="slo-predict done" aria-label="Predict">
            <Eyebrow dot="var(--p5)">Predict, then watch</Eyebrow>
            <p className="slo-q">You predicted {score} of {QUESTIONS.length}. Now try your own incidents with the controls.</p>
            <div><Button variant="ghost" size="s" onClick={restartQ}><Icon name="reset" size={16} />Start the questions again</Button></div>
          </section>
        )}

        <WidgetFrame stage={stage} controls={controls} footer={footer} />
      </div>
    </MotionConfig>
  );
}
