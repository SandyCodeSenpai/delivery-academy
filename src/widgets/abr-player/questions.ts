/** Predict-then-check questions. Answers are computed from the simulation, never hard-coded. */
import { ALGOS, DROP_AT, DURATION, LADDER, TUNNEL, presetTrace, qoeAt, sampleAt, simulate, stallIn, type AlgoKey, type Params, type Run, type TraceKey } from "./model";

export interface Row { algo: AlgoKey; value: string; hit: boolean; note?: string }
export interface Verdict { correct: AlgoKey[]; rows: Row[]; why: string; watch: [AlgoKey, AlgoKey] }

export interface Question {
  id: string;
  trace: TraceKey;
  multi: boolean;
  prompt: string;
  hint: string;
  metric: string;
  /** default-settings answer the "why" text is written for */
  expect: AlgoKey[];
  whyText: string;
  evaluate: (runs: Record<AlgoKey, Run>) => Omit<Verdict, "why" | "watch">;
}

const fmtS = (s: number) => `${s.toFixed(1)} s`;
const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export const QUESTIONS: Question[] = [
  {
    id: "tunnel", trace: "train", multi: true,
    prompt: `The train enters a tunnel at ${mm(TUNNEL[0])} and the signal almost disappears for ${TUNNEL[1] - TUNNEL[0]} seconds. Which algorithms rebuffer in the tunnel? Tap every one you expect.`,
    hint: "Every player has some buffer. Think about the segment each one is downloading when the signal goes. How big is it?",
    metric: "Stall in tunnel",
    expect: ["bba"],
    whyText: "BBA picks its rung from the buffer alone. Just before the tunnel its buffer sat in the cushion, so it was fetching a big 6 Mbps segment (24 Mbit) with less buffer than the others. At 0.15 Mbps that segment could not finish, and the buffer ran dry while it waited. The other rules had smaller segments in flight and more seconds saved. This simple player never abandons a slow download. Real players such as hls.js do, for exactly this reason.",
    evaluate: (runs) => {
      const rows = ALGOS.map(({ key }) => {
        const r = runs[key];
        const s = stallIn(r, TUNNEL[0], TUNNEL[1] + 12);
        const inflight = r.segs.find((g) => g.reqT <= TUNNEL[0] && (isNaN(g.doneT) || g.doneT > TUNNEL[0]));
        const b = sampleAt(r, TUNNEL[0])?.buf ?? 0;
        const note = `${fmtS(b)} buffer at the tunnel${inflight ? `, ${LADDER[inflight.rung].kbps} kbps segment in flight` : ""}`;
        return { algo: key, value: s > 0.05 ? fmtS(s) : "none", hit: s > 0.05, note };
      });
      return { correct: rows.filter((r) => r.hit).map((r) => r.algo), rows };
    },
  },
  {
    id: "stable", trace: "stable", multi: false,
    prompt: "On a stable 8 Mbps line, which algorithm gets the highest average bitrate over two minutes?",
    hint: "Look at the safety factor. Which rule spends only 70% of what it measures?",
    metric: "Average bitrate",
    expect: ["bba"],
    whyText: "The throughput rule spends 0.7 x 8 = 5.6 Mbps, so it settles on the 4.5 Mbps rung and stays there. BBA ignores the measurement and climbs to the top rung once the buffer is full. The safety factor is quality you give up to stay safe, and it is a cost lever too (book 10.11.2).",
    evaluate: (runs) => {
      const vals = ALGOS.map(({ key }) => ({ key, v: qoeAt(runs[key], DURATION).avgKbps ?? 0 }));
      const best = Math.max(...vals.map((x) => x.v));
      const rows = vals.map(({ key, v }) => ({ algo: key, value: `${(v / 1000).toFixed(2)} Mbps`, hit: v >= best * 0.99 }));
      return { correct: rows.filter((r) => r.hit).map((r) => r.algo), rows };
    },
  },
  {
    id: "drop", trace: "drop", multi: false,
    prompt: `At ${mm(DROP_AT)} the line falls from 8 to 1.5 Mbps and stays there. Which algorithm switches quality the most?`,
    hint: "1.5 Mbps sits between two rungs (1.1 and 2.0 Mbps). Which rule looks at the buffer, which goes up and down all the time?",
    metric: "Quality switches",
    expect: ["bba"],
    whyText: "After the drop, BBA keeps high rungs while its buffer drains, then oscillates: the buffer grows on the 1.1 Mbps rung, enters the cushion, BBA picks 2 Mbps, the buffer shrinks, and around it goes. The throughput rule drops within one segment and stays put. Buffer-based logic avoids stalls, but it can trade away stability, which viewers also notice.",
    evaluate: (runs) => {
      const vals = ALGOS.map(({ key }) => ({ key, v: qoeAt(runs[key], DURATION).switches }));
      const best = Math.max(...vals.map((x) => x.v));
      const rows = vals.map(({ key, v }) => ({ algo: key, value: String(v), hit: v === best }));
      return { correct: rows.filter((r) => r.hit).map((r) => r.algo), rows };
    },
  },
];

const cache = new Map<string, Record<AlgoKey, Run>>();
export function runsFor(trace: TraceKey, params: Params): Record<AlgoKey, Run> {
  const k = `${trace}|${params.target}|${params.safety}`;
  let v = cache.get(k);
  if (!v) {
    const t = presetTrace(trace);
    v = Object.fromEntries(ALGOS.map(({ key }) => [key, simulate(t, key, params)])) as Record<AlgoKey, Run>;
    cache.set(k, v);
  }
  return v;
}

export function verdict(q: Question, params: Params): Verdict {
  const { correct, rows } = q.evaluate(runsFor(q.trace, params));
  const same = correct.length === q.expect.length && correct.every((c) => q.expect.includes(c));
  const why = same ? q.whyText : "With your buffer target and safety factor the result differs from the default settings. Read the numbers above, then press Watch it to see why.";
  const first = correct[0] ?? "throughput";
  const other: AlgoKey = first === "throughput" ? "bba" : "throughput";
  return { correct, rows, why, watch: [other, first] };
}

export function isRight(q: Question, picked: AlgoKey[], v: Verdict): boolean {
  if (q.multi) return picked.length === v.correct.length && picked.every((p) => v.correct.includes(p));
  return picked.length === 1 && v.correct.includes(picked[0]);
}
