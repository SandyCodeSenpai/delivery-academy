/**
 * Health-check and failover simulation. Pure and deterministic (seeded), 1-second ticks over 10 minutes.
 *
 * Model (teaching model, numbers ASSUMED):
 * - One health checker probes the primary and the secondary every `interval` s (+/- jitter).
 *   A probe fails if the target is down, returns an error, or answers slower than `timeout`.
 * - A target is marked UNHEALTHY after `failN` failures in a row and HEALTHY again after `passM`
 *   passes in a row (hysteresis).
 * - Routing: all traffic on the primary while it is healthy, else on the secondary. Traffic moves
 *   5% of viewers per second (DNS TTLs and resolver caches), so a full move takes about 20 s.
 *   If both look unhealthy: fail open (treat both as healthy, primary wins) or fail closed (no answer).
 * - Each target has capacity. Load above capacity fails the extra requests.
 *   A secondary that is not pre-scaled starts at 30% capacity and autoscaling adds capacity slowly.
 * - A target that suddenly gets traffic has a cold cache, so some requests miss and fail at first.
 * - Client retries: immediate (3 retries at once) multiply load by 1+f+f^2+f^3 and often hit the
 *   same failure; backoff with jitter plus a 20% retry budget spreads retries out and caps extra load.
 */
import { rng } from "@/lib/hooks";

export type ScenarioId = "outage" | "flapping" | "brownout" | "checker";
export type RetryMode = "backoff" | "immediate";

export interface Settings {
  interval: number; // s
  timeout: number; // s
  failN: number;
  passM: number;
  jitter: number; // 0..0.5, fraction of interval
  prescaled: boolean;
  retries: RetryMode;
  failOpen: boolean;
}

export const DEFAULTS: Settings = { interval: 10, timeout: 4, failN: 1, passM: 1, jitter: 0.1, prescaled: true, retries: "backoff", failOpen: true };

export const DURATION = 600;

export interface Probe { target: 0 | 1; send: number; done: number; ok: boolean }

export interface Tick {
  shareP: number; shareS: number; drop: number;
  err: number; // fraction of viewer requests that failed this second
  mult: number; // attempts per viewer request (retry multiplier)
  upP: boolean; upS: boolean; // health state as the checker sees it
  cfP: number; csP: number; cfS: number; csS: number; // consecutive fail / pass counters
  loadP: number; loadS: number; capP: number; capS: number;
  errP: number; errS: number;
}

export interface SimEvent { t: number; text: string; tone: "good" | "bad" | "warn" | "neutral" }

export interface SimResult {
  ticks: Tick[];
  cumErr: number[]; // cumulative error-seconds at the end of each tick
  probes: Probe[];
  events: SimEvent[];
  flips: number;
  flipTimes: number[];
  detect: number | null; // seconds from fault start to primary marked unhealthy
  detectAt: number | null; // absolute time
  errTotal: number; // fraction of all requests over 10 minutes
  peakMult: number;
  faults: [number, number][];
}

export const SCENARIOS: Record<ScenarioId, { label: string; short: string; blurb: string }> = {
  outage: { label: "Hard outage", short: "Outage", blurb: "At 2:00 the primary stops answering. It comes back at 7:00." },
  flapping: { label: "Flapping", short: "Flapping", blurb: "The primary is borderline: up 40 s, then down 20 s, every minute. While down it fails every health check but only about 1 in 8 viewer requests." },
  brownout: { label: "Brownout", short: "Brownout", blurb: "From 2:00 to 8:00, 30% of probes and requests fail and answers slow to 0.6 to 3 s." },
  checker: { label: "Checker cut off", short: "Checker cut off", blurb: "From 3:00 to 7:00 the health checker loses its own network. Both targets are perfectly fine." },
};

export function faultsFor(sc: ScenarioId): [number, number][] {
  if (sc === "outage") return [[120, 420]];
  if (sc === "brownout") return [[120, 480]];
  if (sc === "checker") return [[180, 420]];
  const w: [number, number][] = [];
  for (let s = 40; s < DURATION; s += 60) w.push([s, s + 20]);
  return w;
}

/** Fraction of viewer requests the primary fails by itself (before load and cache effects). */
function intrinsicP(sc: ScenarioId, t: number): number {
  if (sc === "outage") return t >= 120 && t < 420 ? 1 : 0;
  if (sc === "flapping") return t % 60 >= 40 ? 0.12 : 0;
  if (sc === "brownout") return t >= 120 && t < 480 ? 0.3 : 0;
  return 0;
}

const NORMAL_CAP = 1.2;
const BROWNOUT_CAP = 1.15;
const COLD_PENALTY = 0.2;
const RAMP = 0.05; // share moved per second
const BUDGET = 0.2; // retry budget (extra attempts per request)

const overloadFail = (load: number, cap: number) => (load <= cap || load <= 0 ? 0 : 1 - cap / load);
/** Share of wanted retries the client may send (1 = all). Immediate retries have no budget. */
const allowed = (f: number, mode: RetryMode) => {
  const want = f + f * f + f * f * f;
  return mode === "immediate" || want <= BUDGET ? 1 : BUDGET / want;
};

const fmtClock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
export { fmtClock };

export function simulate(sc: ScenarioId, s: Settings, seed = 7): SimResult {
  const faults = faultsFor(sc);
  const T = Math.min(s.timeout, s.interval);

  // 1. Probes.
  const probes: Probe[] = [];
  for (const target of [0, 1] as const) {
    const r = rng(seed + target * 101 + sc.length * 13);
    let send = r() * s.interval;
    while (send < DURATION) {
      let ok = true, done = send + 0.08;
      const cut = sc === "checker" && send >= 180 && send < 420;
      if (cut) { ok = false; done = send + T; }
      else if (target === 0) {
        if (sc === "outage" && send >= 120 && send < 420) { ok = false; done = send + T; }
        else if (sc === "flapping" && send % 60 >= 40) { ok = false; done = send + T; }
        else if (sc === "brownout" && send >= 120 && send < 480) {
          const a = r(), b = r();
          if (a < 0.3) { ok = false; done = send + 0.5; }
          else { const lat = 0.6 + 2.4 * b * b; if (lat > T) { ok = false; done = send + T; } else done = send + lat; }
        }
      }
      probes.push({ target, send, done, ok });
      send += s.interval * (1 + s.jitter * (2 * r() - 1));
    }
  }
  const queue = [...probes].sort((a, b) => a.done - b.done);

  // 2. Tick loop.
  const ticks: Tick[] = [];
  const cumErr: number[] = [];
  const events: SimEvent[] = [];
  const flipTimes: number[] = [];
  let qi = 0;
  const up = [true, true], cf = [0, 0], cs = [0, 0];
  let shareP = 1, shareS = 0, drop = 0;
  let wP = 1, wS = 0; // cache warmth
  let capS = s.prescaled ? NORMAL_CAP : 0.3;
  let overloadedFor = 0;
  let fP = 0, fS = 0; // previous-tick failure fractions (drive retries)
  let acc = 0, peakMult = 1;
  let lastRoute = "primary";
  let warnedCap = false, warnedStorm = false;
  const name = ["Primary", "Secondary"];

  for (let t = 0; t < DURATION; t++) {
    // Probe results that arrive during this second.
    while (qi < queue.length && queue[qi].done < t + 1) {
      const p = queue[qi++], k = p.target;
      if (p.ok) {
        cf[k] = 0; cs[k]++;
        if (!up[k] && cs[k] >= s.passM) {
          up[k] = true;
          events.push({ t: p.done, text: `${name[k]} marked healthy after ${s.passM} pass${s.passM > 1 ? "es" : ""} in a row.`, tone: "good" });
          if (k === 0) flipTimes.push(p.done);
        }
      } else {
        cs[k] = 0; cf[k]++;
        if (up[k] && cf[k] >= s.failN) {
          up[k] = false;
          events.push({ t: p.done, text: `${name[k]} marked unhealthy after ${s.failN} failed check${s.failN > 1 ? "s" : ""} in a row.`, tone: "bad" });
          if (k === 0) flipTimes.push(p.done);
        }
      }
    }

    // Routing decision.
    let tp = 1, ts = 0, td = 0, route = "primary";
    if (!up[0] && up[1]) { tp = 0; ts = 1; route = "secondary"; }
    else if (!up[0] && !up[1]) {
      if (s.failOpen) route = "open";
      else { tp = 0; td = 1; route = "none"; }
    }
    if (route !== lastRoute) {
      const text = route === "secondary" ? "Traffic moves to the secondary."
        : route === "primary" ? "Traffic moves back to the primary."
        : route === "open" ? "Both look unhealthy, so both are treated as healthy (fail open). Traffic stays on the primary."
        : "Both look unhealthy and the rule fails closed: viewers get no answer.";
      events.push({ t: t + 0.01, text, tone: route === "none" ? "bad" : route === "open" ? "warn" : "neutral" });
      lastRoute = route;
    }
    const step = (cur: number, tgt: number) => cur + Math.max(-RAMP, Math.min(RAMP, tgt - cur));
    shareP = step(shareP, tp); shareS = step(shareS, ts); drop = step(drop, td);
    const sum = shareP + shareS + drop || 1;
    shareP /= sum; shareS /= sum; drop /= sum;

    // Cache warmth follows share: warms in ~30 s, cools in ~5 min.
    wP += (shareP - wP) * (shareP > wP ? 1 / 30 : 1 / 300);
    wS += (shareS - wS) * (shareS > wS ? 1 / 30 : 1 / 300);

    // Load, failures, retries.
    const iP = intrinsicP(sc, t);
    const capP = sc === "brownout" && t >= 120 && t < 480 ? BROWNOUT_CAP : NORMAL_CAP;
    const mult = (f: number) => 1 + allowed(f, s.retries) * (f + f * f + f * f * f);
    const loadP = shareP * mult(fP), loadS = shareS * mult(fS);
    const coldP = shareP > 0.01 ? COLD_PENALTY * Math.max(0, Math.min(1, (shareP - wP) / shareP)) : 0;
    const coldS = shareS > 0.01 ? COLD_PENALTY * Math.max(0, Math.min(1, (shareS - wS) / shareS)) : 0;
    fP = shareP > 0.001 ? 1 - (1 - iP) * (1 - coldP) * (1 - overloadFail(loadP, capP)) : iP;
    fS = shareS > 0.001 ? 1 - (1 - coldS) * (1 - overloadFail(loadS, capS)) : 0;
    const viewerErr = (f: number) => {
      if (s.retries === "immediate") return f * f; // retries in the same instant often hit the same failure
      const a = allowed(f, "backoff"), f4 = f * f * f * f; // spread-out retries are close to independent
      return f4 + (1 - a) * (f - f4);
    };
    const errP = viewerErr(fP), errS = viewerErr(fS);
    const err = shareP * errP + shareS * errS + drop;
    const m = shareP * mult(fP) + shareS * mult(fS) + drop;

    if (!warnedCap && shareS > 0.2 && loadS > capS * 1.02) {
      warnedCap = true;
      events.push({ t: t + 0.02, text: s.prescaled ? "Secondary is over capacity: retries add more load than its headroom." : "Secondary is over capacity. It was not pre-scaled, and autoscaling needs about a minute to add servers.", tone: "warn" });
    }
    if (!warnedStorm && m > 1.8) {
      warnedStorm = true;
      events.push({ t: t + 0.03, text: `Retry storm: clients now send ${m.toFixed(1)} requests for every 1 a viewer needs.`, tone: "warn" });
    }

    // Autoscaling for a secondary that is not pre-scaled: 60 s to notice and boot, then +0.25 every 30 s.
    if (!s.prescaled) {
      if (loadS > capS * 0.9) overloadedFor++; else overloadedFor = Math.max(0, overloadedFor - 1);
      if (overloadedFor > 60) capS = Math.min(2, capS + 0.25 / 30);
    }

    acc += err;
    peakMult = Math.max(peakMult, m);
    ticks.push({ shareP, shareS, drop, err, mult: m, upP: up[0], upS: up[1], cfP: cf[0], csP: cs[0], cfS: cf[1], csS: cs[1], loadP, loadS, capP, capS, errP, errS });
    cumErr.push(acc);
  }

  // Detection: first "primary unhealthy" after a fault starts, measured from that fault's start.
  let detect: number | null = null, detectAt: number | null = null;
  const firstDown = events.find((e) => e.tone === "bad" && e.text.startsWith("Primary marked unhealthy"));
  if (firstDown) {
    const start = [...faults].reverse().find(([a]) => a <= firstDown.t);
    if (start) { detect = firstDown.t - start[0]; detectAt = firstDown.t; }
  }
  return { ticks, cumErr, probes, events: events.sort((a, b) => a.t - b.t), flips: flipTimes.length, flipTimes, detect, detectAt, errTotal: acc / DURATION, peakMult, faults };
}

/** The challenge: flapping causes 0 flips and a hard outage is detected in under 60 s. */
export function challenge(s: Settings) {
  const flap = simulate("flapping", s);
  const out = simulate("outage", s);
  const flipsOk = flap.flips === 0;
  const detectOk = out.detect !== null && out.detect < 60;
  return { flapFlips: flap.flips, outageDetect: out.detect, flipsOk, detectOk, done: flipsOk && detectOk };
}
