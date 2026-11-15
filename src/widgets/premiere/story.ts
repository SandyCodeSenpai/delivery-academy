import type { Tone } from "@/content/types";
import { fmtBps, fmtNum, fmtPct } from "@/lib/format";
import { AUTH_CAP, COUNTDOWN_SHARE, HOT_OBJECTS, LIC_CAP, ORIGIN_CAP, QUOTA_GBPS, type Cfg, type PresetId, type Sample, type Summary } from "./sim";

export interface Beat { t: number; text: string; tone: Tone }

export const fmtK = (v: number) => (v >= 1e6 ? `${fmtNum(v / 1e6, v >= 1e7 ? 0 : 1)}M` : v >= 1e4 ? `${fmtNum(v / 1e3, 0)}k` : v >= 1e3 ? `${fmtNum(v / 1e3, 1)}k` : fmtNum(v, 0));
export const fmtClock = (t: number) => {
  const a = Math.abs(Math.round(t)), m = Math.floor(a / 60), s = a % 60;
  return `T${t < 0 ? "−" : "+"}${m}:${String(s).padStart(2, "0")}`;
};
const dur = (s: number) => (s < 90 ? `${Math.round(s)} s` : `${fmtNum(s / 60, 0)} min`);

export function phaseOf(t: number, started: boolean): string {
  if (!started) return "Waiting for launch";
  if (t < -60) return "Before the bell";
  if (t < 0) return "Final minute";
  if (t < 120) return "The wall";
  if (t < 600) return "The climb";
  return "The long tail";
}

/** Narration beats for one run, in time order. Numbers come from the simulation, never hard-coded. */
export function buildBeats(c: Cfg, s: Summary, samples: Sample[]): Beat[] {
  const at = (t: number) => samples[Math.max(0, Math.min(samples.length - 1, t + 1800))];
  const P = c.peak / 2, need = s.peakNeed, total = s.totalReserved;
  const b: Beat[] = [];
  b.push({ t: -1800, tone: "neutral", text: "The episode is packaged and on every origin, but not visible yet. This is staged publish." });
  b.push(c.prewarm > 0
    ? { t: -1200, tone: "good", text: `Pre-warm: the first ${c.prewarm} segments (${c.prewarm * 4} s of video) are pushed ${c.shield ? "to every CDN shield" : "to the edges that test probes can reach. With no shield, many PoPs stay cold"}.` }
    : { t: -1200, tone: "warn", text: "No pre-warm. Every cache in the world will be cold at T0." });
  b.push(c.protect
    ? { t: -600, tone: "good", text: "Apps refresh sessions at random times over these 10 minutes and prefetch playback info. Sign-in work moves before T0." }
    : { t: -600, tone: "warn", text: `${fmtK(P * COUNTDOWN_SHARE)} fans sit on the countdown screen with old sessions. They will all press play at T0.` });
  const capOk = s.cdnSatT === null;
  b.push({ t: -60, tone: capOk ? "good" : "bad",
    text: `Reserved ${fmtBps(total)} on ${c.cdns} CDN${c.cdns > 1 ? "s" : ""}. Forecast peak: ${fmtBps(need)}. A default quota is only ${QUOTA_GBPS} Gbps per CDN.` });
  const s0 = at(0);
  b.push({ t: 0, tone: "neutral", text: `T0: the episode is visible. ${fmtK(s0.starts)} starts in the first second. ${c.jitter > 0 ? `Jitter spreads the countdown crowd over ${c.jitter} s.` : "No jitter, so the countdown crowd lands in about 2 s."}` });
  const coldFetches = s.coldAtT0 * s.fetchersPerObject;
  if (s.originMeltT !== null && s.originMeltT >= 0) {
    b.push({ t: s.originMeltT + 1, tone: "bad", text: `Origin at ${fmtNum(s.peakOrigin / ORIGIN_CAP, 1)}x capacity. ${s.coldAtT0} cold objects x ${fmtNum(s.fetchersPerObject)} cache servers each fetching = ${fmtK(coldFetches)} requests. It is melting.` });
  } else {
    b.push({ t: 2, tone: "good", text: s.coldAtT0 === 0
      ? "Origin calm. Pre-warm means no hot object is cold at T0."
      : `Origin calm: ${s.coldAtT0} cold objects x ${fmtNum(s.fetchersPerObject)} fetcher${s.fetchersPerObject > 1 ? "s" : ""} = only ${fmtNum(coldFetches)} origin requests.` });
  }
  if (s.authFailT !== null) b.push({ t: s.authFailT + 2, tone: "bad", text: `Sign-in failing: ${fmtK(s.peakAuth)} auth calls/s against ${fmtK(AUTH_CAP)}. In January 2022, 44% of Downdetector reports were sign-in.` });
  if (s.licFailT !== null) b.push(c.protect
    ? { t: s.licFailT + 3, tone: "warn", text: `Licenses hit the ${fmtK(LIC_CAP)}/s limit. Extra requests wait in a queue and players back off, so few fail.` }
    : { t: s.licFailT + 3, tone: "bad", text: `License storm: ${fmtK(s.peakLic)} requests/s against a ${fmtK(LIC_CAP)}/s limit. Nobody can start, even with healthy CDNs.` });
  if (s.storm) b.push({ t: 8, tone: "bad", text: `Retry storm: failed players retry at once. Attempts reach ${fmtNum(s.maxAttemptRatio, 0)}x real demand (Netflix measured 10x).` });
  if (s.recoverT !== null && s.recoverT < 1790) b.push({ t: s.recoverT, tone: "good", text: `Recovered: the error rate is back under 0.5% after ${dur(s.recoverT)}.` });
  if (s.cdnSatT !== null) b.push({ t: Math.max(-1799, s.cdnSatT), tone: "bad",
    text: `${c.cdns > 1 ? "The largest CDN" : "The CDN"} is full: ${fmtBps(at(Math.max(-1799, s.cdnSatT)).egress)} needed, more than was reserved. Viewers start to buffer.` });
  if (s.peakReachedT !== null) b.push({ t: s.peakReachedT, tone: "neutral", text: `Near peak: ${fmtK(at(s.peakReachedT).watching)} watching, ${fmtBps(at(s.peakReachedT).egress)} of egress. Licenses renew at ${fmtK(at(s.peakReachedT).renew)}/s.` });
  b.push(s.peakErr < 0.005
    ? { t: 1799, tone: "good", text: `Clean premiere. Peak error rate ${fmtPct(s.peakErr, 2)}.` }
    : { t: 1799, tone: "bad", text: `Premiere over. Peak error rate ${fmtPct(s.peakErr, 0)} at ${fmtClock(s.peakErrT)}.` });
  return b.sort((x, y) => x.t - y.t);
}

export interface Predict { q: string; options: string[]; answer: string; explain: string }

export function predictFor(kind: PresetId | "custom", c: Cfg, s: Summary): Predict {
  if (kind === "naive") {
    const share = fmtPct(s.signInShare, 0);
    return {
      q: "Everything is off. At T0, what will most viewers complain about?",
      options: ["Video buffering", "Sign-in fails", "Nothing breaks"],
      answer: "Sign-in fails",
      explain: `In this run, sign-in was the broken step for ${share} of failed starts. Sign-in cannot be cached, so it breaks first. In January 2022, Downdetector reports were 44% sign-in, 29% buffering and 16% crashing.`,
    };
  }
  if (kind === "playbook") {
    return {
      q: "Shields and collapsing are on, on 3 CDNs. If the 48 hot objects were still cold at T0, how many requests would reach the origin?",
      options: ["432,000", "14,400", "144"],
      answer: "144",
      explain: `One fetch per object per CDN shield: 3 x ${HOT_OBJECTS} = 144. Without shield and collapsing it would be 300 PoPs x 30 servers x 48 = 432,000. Pre-warm makes it ${s.coldAtT0 === 0 ? "zero" : fmtNum(s.coldAtT0 * s.fetchersPerObject)} in this run.`,
    };
  }
  const band = s.peakErr < 0.005 ? "Under 0.5%" : s.peakErr < 0.05 ? "0.5% to 5%" : "Over 5%";
  const why: string[] = [];
  if (s.originMeltT !== null) why.push("the origin was overloaded by cold misses");
  if (s.authFailT !== null) why.push("sign-in was overloaded");
  if (s.licFailT !== null && !c.protect) why.push("the license service was overloaded");
  if (s.cdnSatT !== null) why.push("a CDN ran out of reserved capacity");
  return {
    q: "Your own launch plan. What will the peak error rate be?",
    options: ["Under 0.5%", "0.5% to 5%", "Over 5%"],
    answer: band,
    explain: `Peak error rate: ${fmtPct(s.peakErr, s.peakErr < 0.05 ? 2 : 0)}. ${why.length ? `It went up because ${why.join(", ")}.` : "Every layer stayed under its capacity."}`,
  };
}
