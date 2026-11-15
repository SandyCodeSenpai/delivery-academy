/**
 * Guided scenarios, Brilliant style: set up the state, ask the reader to predict,
 * run it, then explain what happened and the staff-level lesson.
 */
import { INITIAL, NO_FAULTS, logFromViewers, type Faults, type PgState, type RequestTrace, type TrafficStats } from "./model";

export interface RunCtx { before: TrafficStats; after: TrafficStats; trace: RequestTrace | null }
export interface ScenarioPatch { state?: Partial<Omit<PgState, "faults">>; faults?: Partial<Faults> }
export interface Scenario {
  id: number;
  title: string;
  /** One line that says what is already set up on the stage. */
  setup: string;
  start: ScenarioPatch;
  view: "request" | "traffic";
  question: (before: TrafficStats) => string;
  options: { text: string; correct?: boolean }[];
  /** What changes when the reader presses Run (inject a fault, switch steering). */
  change?: ScenarioPatch;
  run: "request" | "traffic";
  outcome: (c: RunCtx) => string;
  lesson: string;
  /** Optional follow-up the reader can try after the reveal. */
  next?: { label: string; change: ScenarioPatch; run: "request" | "traffic"; outcome: (c: RunCtx) => string };
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (v: number, d = 1) => (v < 0.00005 ? "almost none" : `${(v * 100).toFixed(v < 0.001 ? 2 : d)}%`);
const money = (v: number) => `$${n(v)}`;
const msf = (v: number) => (Number.isFinite(v) ? `${n(v)} ms` : "n/a");

/** Build a fresh state for a scenario: everything back to defaults, then the patch. */
export function applyPatch(base: PgState, p?: ScenarioPatch): PgState {
  if (!p) return base;
  return { ...base, ...(p.state ?? {}), faults: { ...base.faults, ...(p.faults ?? {}) } };
}
export const freshState = (p: ScenarioPatch): PgState => applyPatch({ ...INITIAL, faults: NO_FAULTS, filled: [] }, p);

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    title: "A cache hit",
    setup: "A viewer in Tokyo. A popular show. Every cache is warm.",
    start: { state: { region: "tokyo", content: "popular", edgeWarm: true, shieldWarm: true } },
    view: "request",
    question: () => "The viewer presses play. Where does the first video segment come from?",
    options: [
      { text: "The CDN's edge PoP in Tokyo", correct: true },
      { text: "The CDN's shield, near the origin in Oregon" },
      { text: "The S3 origin in us-west-2" },
    ],
    run: "request",
    outcome: ({ trace, before }) =>
      `Edge HIT. The Tokyo PoP answered in ${msf(trace?.ttfbMs ?? 0)}. A trip to the shield would have added about 110 ms. Across 1M viewers like this one, only ${n(before.originRps)} requests per second reach the origin.`,
    lesson: "Most bytes never leave the edge. That is why staff engineers watch origin offload by bytes as the headline number: it says how well the origin is protected, which one blended hit ratio does not.",
  },
  {
    id: 2,
    title: "A miss the shield catches",
    setup: "A viewer in Sao Paulo. An old long-tail episode. Edge and shield caches are warm.",
    start: { state: { region: "saopaulo", content: "longtail", edgeWarm: true, shieldWarm: true } },
    view: "request",
    question: () => "Viewers in other cities watched this old episode last night on the same CDN, but nobody in Sao Paulo did. Where is it served from?",
    options: [
      { text: "The Sao Paulo edge" },
      { text: "The CDN's shield", correct: true },
      { text: "The S3 origin" },
    ],
    run: "request",
    outcome: ({ trace }) =>
      `Edge MISS, shield HIT, in ${msf(trace?.ttfbMs ?? 0)}. Slower than an edge hit, because the shield sits near the origin, but the origin was not asked at all. Press Play again: now the Sao Paulo edge has a copy and answers in about 25 ms.`,
    lesson: "One shield collects the misses of every PoP of its CDN. A 95% edge hit ratio and an 80% shield hit ratio mean only 5% × 20% = 1% of bytes reach the origin. Shield hit ratios look low because the shield only sees the hard requests; they are still doing their job.",
  },
  {
    id: 3,
    title: "Cold premiere herd",
    setup: "A new simulcast episode goes live. 2M viewers. Every cache is cold.",
    start: { state: { content: "premiere", edgeWarm: false, shieldWarm: false, viewersLog: logFromViewers(2_000_000) } },
    view: "traffic",
    question: () => "At T0, viewers everywhere ask for segment 1 in the same few seconds. No cache has it. How many times does the origin get asked for that one segment?",
    options: [
      { text: "About 2 million times: once per viewer" },
      { text: "About 160 times: once per edge PoP" },
      { text: "About 2 times: once per CDN", correct: true },
    ],
    run: "traffic",
    outcome: ({ after }) =>
      `Each brand-new segment was fetched ${after.originBurst} times, once per CDN shield. Request collapsing makes every viewer who asks during the fetch wait for that one request. Origin peaks around ${n(after.originRps)} requests per second, well below what S3 handles on one prefix.`,
    lesson: "In a premiere the danger is not bytes. It is millions of synchronized requests for objects no cache has. Shields plus request collapsing turn them into a handful. Teams also warm the shields 30 minutes before T0. That is safe because no tokens or licenses exist before T0.",
    next: {
      label: "Now take shield A down",
      change: { faults: { shieldADown: true } },
      run: "traffic",
      outcome: ({ after }) =>
        `Without shield A, every CDN A PoP goes to the origin on its own: ${after.originBurst} fetches per new segment and about ${n(after.originRps)} requests per second on one S3 prefix. Error rate: ${pct(after.errorRate, 2)}. A cold or missing shield is a herd target.`,
    },
  },
  {
    id: 4,
    title: "CDN A goes down",
    setup: "A viewer in Los Angeles on CDN A. 1M viewers. Caches are warm.",
    start: { state: { region: "la", content: "popular", viewersLog: logFromViewers(1_000_000) } },
    view: "request",
    question: () => "CDN A suddenly answers every request with an error, as Fastly did on June 8, 2021. What does this viewer notice?",
    options: [
      { text: "Playback stops until CDN A is fixed" },
      { text: "A short stall at most: the player retries on CDN B", correct: true },
      { text: "Nothing at all: the error never reaches the player" },
    ],
    change: { faults: { cdnAOutage: true } },
    run: "request",
    outcome: ({ trace, after }) =>
      `The player got a 503, waited 250 ms, and got the segment from CDN B: ${msf(trace?.ttfbMs ?? 0)} in total. Across 1M viewers, ${pct(after.firstTryFail, 0)} of first tries failed, but after retries ${pct(after.errorRate, 2)} did. Steering drains CDN A within 1 to 3 minutes.`,
    lesson: "Multi-CDN works only if the survivor is warm and big enough. Keep at least 10% of traffic on every CDN in every region so its caches stay warm, and reserve capacity for \"N minus one CDN\".",
    next: {
      label: "Try it at a 2M premiere",
      change: { state: { viewersLog: logFromViewers(2_000_000) } },
      run: "traffic",
      outcome: ({ after }) =>
        `Now CDN B must carry ${(after.loadB / 1e12).toFixed(1)} Tbps against a 6 Tbps reservation. Error rate: ${pct(after.errorRate, 1)}. At 2M viewers × 4 Mbps = 8 Tbps, one CDN cannot carry everything. Size reservations so any one CDN can fail.`,
    },
  },
  {
    id: 5,
    title: "The origin region fails",
    setup: "A viewer in Tokyo. The new episode is still copying to GCS. Caches are cold.",
    start: { state: { region: "tokyo", content: "premiere", edgeWarm: false, shieldWarm: false, viewersLog: logFromViewers(1_000_000) }, faults: { replLag: true } },
    view: "request",
    question: () => "Now AWS us-west-2 goes down. The request misses every cache. What happens?",
    options: [
      { text: "The shield fails over to GCS and the viewer gets the segment" },
      { text: "The shield fails over to GCS, gets a 404, and the viewer sees an error", correct: true },
      { text: "The edge serves an older copy of the episode" },
    ],
    change: { faults: { awsDown: true } },
    run: "request",
    outcome: ({ trace, after }) =>
      `S3 did not answer, so the shield waited 2 s and tried GCS. GCS said 404: the copy was not there yet. The viewer got an error after ${msf(trace?.ttfbMs ?? 0)}. With cold caches, ${pct(after.errorRate, 0)} of requests for this episode fail, because no cache can fill.`,
    lesson: "A second origin is only as good as replication. Treat replication lag as a delivery SLO and put a publish gate in code: the Playback API returns no URLs until the episode is verified in two origins. Do not fail over on 404 to hide it; alert on it.",
    next: {
      label: "Add a publish gate",
      change: { faults: { replLag: false } },
      run: "request",
      outcome: ({ trace }) =>
        `With the gate, the episode went live only after it was in both origins. Same AWS outage, and the viewer gets the segment from GCS in ${msf(trace?.ttfbMs ?? 0)}: slower, because of the 2 s timeout, but it plays. After health checks mark S3 as down, later misses skip the timeout.`,
    },
  },
  {
    id: 6,
    title: "Make it cheaper",
    setup: "1M viewers on a popular show. Steering by performance.",
    start: { state: { content: "popular", steer: "performance", viewersLog: logFromViewers(1_000_000) } },
    view: "traffic",
    question: (b) => `Delivery costs about ${money(b.costHour)} per hour. Finance asks for less. You switch steering from performance to cost. What happens?`,
    options: [
      { text: "Cost drops a lot, and time to first byte gets a little worse", correct: true },
      { text: "Cost drops and nothing else changes" },
      { text: "Cost goes up, because the cheaper CDN misses more" },
    ],
    change: { state: { steer: "cost" } },
    run: "traffic",
    outcome: ({ before, after }) =>
      `Cost per hour: ${money(before.costHour)} → ${money(after.costHour)} (${Math.round((1 - after.costHour / before.costHour) * 100)}% less). p95 time to first byte: ${msf(before.p95Ms)} → ${msf(after.p95Ms)}. CDN B is cheaper per GB and pulls from S3 for free. CDN A keeps 10% to stay warm.`,
    lesson: "CDN delivery is most of the bill, so price per GB and byte hit ratio matter far more than storage. Steer on cost only where quality is close, keep a warm share on every CDN, and watch commits and 95th-percentile billing: a premiere spike can set the month's bill.",
  },
];
