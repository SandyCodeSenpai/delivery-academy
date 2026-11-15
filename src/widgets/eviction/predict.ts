/**
 * Predict questions. Each one sets up a race; the answer is read from the simulation
 * after the race finishes, never hard-coded.
 */
import { fmtPct } from "@/lib/format";
import { POLICY_NAME, kindOf, type PolicyId, type Stream, type Trace } from "./sim";

export interface Setup { ohw: number; admit: boolean; simulcast: boolean; lanes: PolicyId[] }
export interface Ctx { stream: Stream; traces: Record<PolicyId, Trace>; /** hit ratio with admission flipped */ other: Record<PolicyId, number> }
export interface Verdict { correct: string[]; headline: string; body: string }
export interface Question { id: string; prompt: string; setup: Setup; options: { value: string; label: string }[]; judge: (c: Ctx) => Verdict }

const pts = (a: number, b: number) => `${Math.abs((a - b) * 100).toFixed(1)} points`;
const list = (ids: PolicyId[], c: Ctx) => ids.map((id) => `${POLICY_NAME[id]} ${fmtPct(c.traces[id].hitRatio, 1)}`).join(", ");
const ranked = (ids: PolicyId[], c: Ctx) => [...ids].sort((a, b) => c.traces[b].hitRatio - c.traces[a].hitRatio);

const ALL: PolicyId[] = ["lru", "lfu", "fifo", "s3fifo"];

export const QUESTIONS: Question[] = [
  {
    id: "ohw60",
    prompt: "With 60% one-hit wonders, which policy wins?",
    setup: { ohw: 0.6, admit: false, simulcast: true, lanes: ALL },
    options: ALL.map((id) => ({ value: id, label: POLICY_NAME[id] })),
    judge: (c) => {
      const r = ranked(ALL, c);
      const top = c.traces[r[0]].hitRatio;
      const correct = r.filter((id) => top - c.traces[id].hitRatio < 0.0005);
      const why: Record<PolicyId, string> = {
        s3fifo: "Most new objects are never asked for again. S3-FIFO puts every new object in a small probation queue (10% of slots), so a one-hit wonder leaves after a short stay and never pushes out a popular episode. LRU and FIFO let every one-hit wonder walk through the whole cache.",
        lfu: "A new object starts with a count of 1, so LFU evicts it first. One-hit wonders churn through one or two slots while popular episodes keep their high counts.",
        lru: "Recency happened to protect the hot set best on this stream.",
        fifo: "Arrival order happened to work best on this stream.",
      };
      return { correct, headline: `${POLICY_NAME[r[0]]} wins: ${list(r, c)}.`, body: `${why[r[0]]} Note that every one-hit wonder is a miss for every policy, so no policy can go above 40% here.` };
    },
  },
  {
    id: "admit",
    prompt: "Still 60% one-hit wonders. Now we turn on admit on second hit. What happens to LRU?",
    setup: { ohw: 0.6, admit: true, simulcast: true, lanes: ["lru", "s3fifo"] },
    options: [{ value: "up", label: "Hit ratio goes up" }, { value: "same", label: "Within 1 point" }, { value: "down", label: "Hit ratio goes down" }],
    judge: (c) => {
      const on = c.traces.lru.hitRatio, off = c.other.lru;
      const s3on = c.traces.s3fifo.hitRatio, s3off = c.other.s3fifo;
      const v = on - off > 0.01 ? "up" : off - on > 0.01 ? "down" : "same";
      const head = v === "up" ? `LRU goes up ${pts(on, off)}` : v === "down" ? `LRU goes down ${pts(on, off)}` : "LRU barely moves";
      return {
        correct: [v],
        headline: `${head}: ${fmtPct(off, 1)} without the rule, ${fmtPct(on, 1)} with it.`,
        body: `One-hit wonders are no longer stored, so they stop pushing popular episodes out. The cost: every object misses twice before it is stored. S3-FIFO moves only from ${fmtPct(s3off, 1)} to ${fmtPct(s3on, 1)}, because its small queue is already an admission filter.`,
      };
    },
  },
  {
    id: "zero",
    prompt: "No one-hit wonders at all. Does S3-FIFO still beat LRU?",
    setup: { ohw: 0, admit: false, simulcast: true, lanes: ["lru", "s3fifo"] },
    options: [{ value: "s3", label: "Yes, by more than 1 point" }, { value: "tie", label: "They are within 1 point" }, { value: "lru", label: "No, LRU wins" }],
    judge: (c) => {
      const a = c.traces.s3fifo.hitRatio, b = c.traces.lru.hitRatio;
      const v = a - b > 0.01 ? "s3" : b - a > 0.01 ? "lru" : "tie";
      return {
        correct: [v],
        headline: v === "s3" ? `Yes. S3-FIFO ${fmtPct(a, 1)}, LRU ${fmtPct(b, 1)}.` : v === "lru" ? `No. LRU ${fmtPct(b, 1)}, S3-FIFO ${fmtPct(a, 1)}.` : `About even: S3-FIFO ${fmtPct(a, 1)}, LRU ${fmtPct(b, 1)}.`,
        body: v === "s3"
          ? "Even with no true one-hit wonders, a small cache sees catalog-tail episodes that are requested once and not again before they would be evicted. To the cache they look the same. The S3-FIFO paper found that about 72% of objects are not reused before eviction when the cache holds 10% of the footprint."
          : "Without one-hit wonders the probation queue has less to filter, so the gap closes. Which policy wins depends on the trace, which is why the S3-FIFO paper tested 6,594 of them.",
      };
    },
  },
  {
    id: "dead",
    prompt: "The premiere burst ends, and its segments are never asked for again. 200 requests later, which policy has cleared them out best?",
    setup: { ohw: 0.3, admit: false, simulcast: true, lanes: ["lru", "lfu", "s3fifo"] },
    options: (["lru", "lfu", "s3fifo"] as PolicyId[]).map((id) => ({ value: id, label: POLICY_NAME[id] })),
    judge: (c) => {
      const ids: PolicyId[] = ["lru", "lfu", "s3fifo"];
      const end = c.stream.burst ? c.stream.burst[1] : 0;
      const at = Math.min(c.stream.keys.length - 1, end + 199);
      const dead = Object.fromEntries(ids.map((id) => {
        const tr = c.traces[id]; let d = 0;
        for (let s = 0; s < tr.cap; s++) { const k = tr.slots[at * tr.cap + s]; if (k >= 0 && kindOf(k) === "sim") d++; }
        return [id, d];
      })) as Record<PolicyId, number>;
      const min = Math.min(...ids.map((id) => dead[id]));
      const correct = ids.filter((id) => dead[id] === min);
      const cap = c.traces.lru.cap;
      return {
        correct,
        headline: `Dead premiere segments still cached: ${ids.map((id) => `${POLICY_NAME[id]} ${dead[id]} of ${cap}`).join(", ")}.`,
        body: "Premiere segments collect many hits in a few minutes. LFU keeps those counts forever, so old favorites linger (real LFU needs counter aging). S3-FIFO's counter is capped at 3, so a segment survives a few passes of the main queue before it goes. LRU only looks at recency, so it forgets the premiere as soon as viewers move on. Every policy pays for something: recency forgets fast, frequency adapts slowly.",
      };
    },
  },
];
