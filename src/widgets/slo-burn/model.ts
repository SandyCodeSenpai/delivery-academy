/**
 * Simulation model for the slo-burn widget. Pure functions, no React.
 *
 * Time is in minutes. Minute 0 is the start of the 30-day SLO window. We also keep 3 days of
 * history before minute 0 so the 3-day alert window is always full.
 *
 * Assumptions (book Section 11.7.4): ~600M playback sessions a month, spread evenly, so about
 * 13,900 sessions start every minute. Background failures are about 0.02% of sessions (assumed).
 */
import { rng } from "@/lib/hooks";

export const WINDOW_MIN = 30 * 24 * 60; // 43,200 minutes in the SLO window
export const PRE_MIN = 3 * 24 * 60; // history kept before minute 0
export const SESSIONS_PER_MONTH = 600e6;
export const SESSIONS_PER_MIN = SESSIONS_PER_MONTH / WINDOW_MIN;
export const BASELINE = 0.0002;
export const STATIC_RATE = 0.01;
export const STATIC_FOR = 5;

export type SloTarget = 0.995 | 0.999 | 0.9995;

export interface Incident {
  /** error rate inside the affected slice, 0..1 */
  rate: number;
  /** share of all sessions in the slice, 0..1 */
  share: number;
  /** minutes */
  dur: number;
  /** minute in the 30-day window when it starts */
  start: number;
}

export type RuleId = "static" | "fast" | "slow" | "ticket";
export interface Rule {
  id: RuleId;
  kind: "page" | "ticket";
  title: string;
  /** burn-rate rules only */
  burn?: number; long?: number; short?: number; budgetShare?: number;
}

export const RULES: Rule[] = [
  { id: "static", kind: "page", title: "Errors above 1% for 5 min" },
  { id: "fast", kind: "page", title: "Page: 14.4x over 1h and 5m", burn: 14.4, long: 60, short: 5, budgetShare: 0.02 },
  { id: "slow", kind: "page", title: "Page: 6x over 6h and 30m", burn: 6, long: 360, short: 30, budgetShare: 0.05 },
  { id: "ticket", kind: "ticket", title: "Ticket: 1x over 3d and 6h", burn: 1, long: 4320, short: 360, budgetShare: 0.1 },
];

/** Datadog's burn-rate UI takes long windows of 1h to 48h (book 11.10.2), so the ticket uses 48h / 4h there. */
export const DD_TICKET: Rule = { id: "ticket", kind: "ticket", title: "Ticket: 1x over 48h and 4h", burn: 1, long: 2880, short: 240 };

const N = PRE_MIN + WINDOW_MIN;

/** Background error rate per minute: a slow, seeded wander around 0.02%. Shared by every run. */
const BASE: Float64Array = (() => {
  const r = rng(11), a = new Float64Array(N);
  let z = 0;
  for (let i = 0; i < N; i++) { z = 0.97 * z + 0.12 * (r() - 0.5); a[i] = BASELINE * Math.exp(z + 0.18 * (r() - 0.5)); }
  return a;
})();

export interface Interval { from: number; to: number }
export interface RuleResult { rule: Rule; intervals: Interval[]; first: number | null }

export interface Sim {
  slo: SloTarget;
  inc: Incident;
  /** error rate per minute, index = minute + PRE_MIN */
  err: Float64Array;
  /** prefix sums of err, length N + 1 */
  pre: Float64Array;
  rules: Record<RuleId, RuleResult>;
  dd: RuleResult;
  budgetMin: number;
  budgetSessions: number;
  /** budget spent by the incident itself (excess over background), as a share of the budget */
  incSpend: number;
  incFailed: number;
  worth: "page" | "ticket" | "none";
}

const idx = (t: number) => t + PRE_MIN;

function evalRule(rule: Rule, err: Float64Array, pre: Float64Array, b: number, from: number, to: number): RuleResult {
  const intervals: Interval[] = [];
  let on = -1, run = 0;
  const avg = (i: number, w: number) => (pre[i + 1] - pre[i + 1 - w]) / w;
  for (let t = from; t < to; t++) {
    const i = idx(t);
    let fire: boolean;
    if (rule.id === "static") { run = err[i] > STATIC_RATE ? run + 1 : 0; fire = run >= STATIC_FOR; }
    else { const th = rule.burn! * b; fire = avg(i, rule.long!) >= th && avg(i, rule.short!) >= th; }
    if (fire && on < 0) on = t;
    if (!fire && on >= 0) { intervals.push({ from: on, to: t }); on = -1; }
  }
  if (on >= 0) intervals.push({ from: on, to: to });
  return { rule, intervals, first: intervals.length ? intervals[0].from : null };
}

export function simulate(slo: SloTarget, inc: Incident): Sim {
  const b = 1 - slo;
  const err = new Float64Array(N);
  const s = idx(inc.start), e = idx(Math.min(WINDOW_MIN, inc.start + inc.dur));
  const add = inc.rate * inc.share;
  for (let i = 0; i < N; i++) err[i] = i >= s && i < e ? Math.min(1, BASE[i] + add) : BASE[i];
  const pre = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) pre[i + 1] = pre[i] + err[i];
  // Only background can fire before the incident, and it never crosses any threshold, so evaluate
  // from a little before the start to well after the end (the 3d window decays for up to 3 days).
  const from = Math.max(0, inc.start - 60), to = Math.min(WINDOW_MIN, inc.start + inc.dur + 4320 + 60);
  const rules = Object.fromEntries(RULES.map((r) => [r.id, evalRule(r, err, pre, b, from, to)])) as Record<RuleId, RuleResult>;
  const dd = evalRule(DD_TICKET, err, pre, b, from, to);
  const budgetMin = b * WINDOW_MIN;
  const incSpend = (add * inc.dur) / budgetMin;
  const within = (w: number) => (add * Math.min(inc.dur, w)) / budgetMin;
  const worth = within(60) >= 0.02 || within(360) >= 0.05 ? "page" : within(4320) >= 0.1 ? "ticket" : "none";
  return { slo, inc, err, pre, rules, dd, budgetMin, budgetSessions: b * SESSIONS_PER_MONTH, incSpend, incFailed: add * inc.dur * SESSIONS_PER_MIN, worth };
}

/** Share of the budget left at minute t (can go below 0). */
export const budgetLeft = (sim: Sim, t: number) => 1 - (sim.pre[idx(Math.round(Math.max(0, Math.min(WINDOW_MIN, t))))] - sim.pre[idx(0)]) / sim.budgetMin;

/** Max error rate in [t0, t1). */
export function maxErr(sim: Sim, t0: number, t1: number): number {
  let m = 0;
  const a = Math.max(0, idx(Math.floor(t0))), z = Math.min(sim.err.length, idx(Math.ceil(t1)));
  for (let i = a; i < z; i++) if (sim.err[i] > m) m = sim.err[i];
  return m || sim.err[Math.max(0, Math.min(sim.err.length - 1, idx(Math.floor(t0))))];
}

export type Verdict = "caught" | "missed" | "false-page" | "ticket-only" | "noisy-ticket" | "quiet";
export interface StyleResult { page: number | null; ticket: number | null; verdict: Verdict }

export function staticResult(sim: Sim): StyleResult {
  const page = sim.rules.static.first;
  return { page, ticket: null, verdict: judge(sim.worth, page, null) };
}
export function burnResult(sim: Sim): StyleResult {
  const f = sim.rules.fast.first, s = sim.rules.slow.first;
  const page = f == null ? s : s == null ? f : Math.min(f, s);
  const ticket = sim.rules.ticket.first;
  return { page, ticket, verdict: judge(sim.worth, page, ticket) };
}
function judge(worth: Sim["worth"], page: number | null, ticket: number | null): Verdict {
  if (worth === "page") return page != null ? "caught" : ticket != null ? "ticket-only" : "missed";
  if (worth === "ticket") return page != null || ticket != null ? "caught" : "missed";
  return page != null ? "false-page" : ticket != null ? "noisy-ticket" : "quiet";
}

/* ---------- Input scales and presets ---------- */

export const RATE_STEPS = [0.0005, 0.001, 0.0015, 0.002, 0.003, 0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1];
export const DUR_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 960, 1440, 2160, 2880, 4320];
export const SHARES = [1, 0.25, 0.1] as const;
export type Share = (typeof SHARES)[number];
export const SHARE_LABEL: Record<Share, string> = { 1: "Everyone", 0.25: "One region, 25%", 0.1: "One ISP, 10%" };

export const nearest = (steps: number[], v: number) => steps.reduce((bi, s, i) => (Math.abs(Math.log(s / v)) < Math.abs(Math.log(steps[bi] / v)) ? i : bi), 0);

export interface Scenario { rate: number; share: Share; dur: number; startH: number; slo?: SloTarget }
export type PresetId = "outage" | "isp" | "blip";
export const PRESETS: { id: PresetId; label: string; sc: Scenario }[] = [
  { id: "outage", label: "Total outage, 10 min", sc: { rate: 1, share: 1, dur: 10, startH: 12 * 24 + 20 } },
  { id: "isp", label: "One ISP slow burn, 2% for 2 days", sc: { rate: 0.02, share: 0.1, dur: 2880, startH: 9 * 24 + 18 } },
  { id: "blip", label: "Tiny blip", sc: { rate: 0.03, share: 1, dur: 6, startH: 16 * 24 + 3 } },
];

export const toIncident = (sc: Scenario): Incident => ({ rate: sc.rate, share: sc.share, dur: sc.dur, start: sc.startH * 60 });

/* ---------- Formatting ---------- */

export function pct(v: number): string {
  const x = v * 100;
  if (x === 0) return "0%";
  const s = Math.abs(x) >= 10 ? x.toFixed(0) : Math.abs(x) >= 1 ? String(Number(x.toFixed(2))) : String(Number(x.toPrecision(2)));
  return `${s}%`;
}
export function dur(min: number): string {
  if (min < 1) return "under 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${Number(h.toFixed(h < 10 ? 1 : 0))} h`;
  return `${Number((h / 24).toFixed(1))} days`;
}
export function clock(startMin: number): string {
  const h = Math.floor(startMin / 60);
  return `Day ${Math.floor(h / 24) + 1}, ${String(h % 24).padStart(2, "0")}:00`;
}
export const sloLabel = (s: SloTarget) => (s === 0.9995 ? "99.95%" : s === 0.999 ? "99.9%" : "99.5%");
