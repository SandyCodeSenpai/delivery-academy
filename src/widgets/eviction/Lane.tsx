import { memo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Chip } from "@/ui";
import { useWidth } from "@/lib/hooks";
import { fmtPct, clamp } from "@/lib/format";
import { POLICY_NAME, POLICY_COLOR, POLICY_BLURB, kindOf, labelOf, smallCap, type Trace, type PolicyId } from "./sim";

const GAP = 4;

/** Columns for K tiles in a lane `w` px wide: aim for ~40px tiles, prefer a count that fills every row. */
function pickCols(K: number, w: number): number {
  const target = clamp(w / 40, 4, 16);
  let best = 4, score = Infinity;
  for (let c = 4; c <= Math.min(16, K); c++) {
    const tile = (w - GAP * (c - 1)) / c;
    if (tile < 22 && c > 4) continue;
    const s = Math.abs(c - target) + (K % c ? 2.5 : 0) + (tile > 52 ? 2 : 0);
    if (s < score) { score = s; best = c; }
  }
  return Math.min(K, best);
}

interface LaneProps {
  trace: Trace;
  /** requests processed so far (state shown = after request t-1) */
  t: number;
  step: boolean;
  reduced: boolean;
  /** hit ratio with the admission rule flipped, shown when the race is finished */
  other?: number;
  rank?: number;
  done: boolean;
  /** key of request t-1 */
  reqKey: number;
  /** racing: many tiles turn over per second, so use a short, quiet transition */
  fast: boolean;
}

function outcomeChip(tr: Trace, i: number) {
  const o = tr.outcome[i];
  if (o === "hit") return <Chip tone="good">HIT</Chip>;
  if (o === "bypass") return <Chip tone="warn">MISS, not stored</Chip>;
  return <Chip tone="bad">MISS, stored</Chip>;
}

export const Lane = memo(function Lane({ trace: tr, t, step, reduced, other, rank, done, reqKey, fast }: LaneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const K = tr.cap;
  const cols = pickCols(K, w || 280);
  const tile = w ? (w - GAP * (cols - 1)) / cols : 32;
  const showLabels = tile >= 30;
  const i = t - 1;
  const base = i >= 0 ? i * K : -1;
  const ratio = t > 0 ? tr.cum[i] / t : 0;
  const changed = step && i >= 0 ? tr.slotAt[i] : -1;
  const s3 = tr.policy === "s3fifo";
  const stepHit = step && i >= 0 && tr.outcome[i] === "hit";
  const gCap = K - smallCap(K);
  const ghosts = i >= 0 ? tr.ghosts[i] : 0;

  const tiles = [];
  for (let s = 0; s < K; s++) {
    const key = base >= 0 ? tr.slots[base + s] : -1;
    const flag = base >= 0 && s3 ? tr.flags[base + s] : 0;
    const hit = stepHit && key === reqKey;
    tiles.push(
      <div key={s} className="ev-slot">
        <AnimatePresence initial={false}>
          {key >= 0 && (
            <motion.div
              key={key}
              className={`ev-tile ev-k-${kindOf(key)}${flag === 1 ? " q-small" : ""}${s === changed ? " is-new" : ""}${hit ? " is-hit" : ""}`}
              initial={reduced ? false : fast ? { opacity: 0.35, scale: 0.85 } : { opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : fast ? { opacity: 0, scale: 0.8, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.4, y: 6, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
              transition={reduced ? { duration: 0 } : fast ? { duration: 0.12 } : { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {showLabels && <span>{labelOf(key)}</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>,
    );
  }

  return (
    <section className="ev-lane" style={{ ["--lane" as string]: POLICY_COLOR[tr.policy] }} aria-label={`${POLICY_NAME[tr.policy]} cache`}>
      <header className="ev-lane-head">
        <div className="ev-lane-name">
          <i aria-hidden="true" />
          <div>
            <strong>{POLICY_NAME[tr.policy]}</strong>
            <small>{POLICY_BLURB[tr.policy]}</small>
          </div>
        </div>
        <div className="ev-lane-score">
          <span className="ev-lane-pct">{fmtPct(ratio, 1)}</span>
          <small>{done && rank === 0 ? <Chip tone="good">Winner</Chip> : "hit ratio"}</small>
        </div>
      </header>
      <div ref={ref} className="ev-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }} role="img"
        aria-label={`${POLICY_NAME[tr.policy]}: ${K} slots, hit ratio ${fmtPct(ratio, 1)}`}>
        {tiles}
      </div>
      {s3 && (
        <div className="ev-ghost" title="Ghost queue: keys only, no data">
          <span>Ghost keys</span>
          <div className="ev-ghost-bar"><div style={{ width: `${(ghosts / Math.max(1, gCap)) * 100}%` }} /></div>
          <span className="ev-num">{ghosts}/{gCap}</span>
        </div>
      )}
      {step && i >= 0 && (
        <div className="ev-why" aria-live="polite">
          <div className="ev-why-top">{outcomeChip(tr, i)}<span className="ev-num">request {i + 1}</span></div>
          <p>{tr.outcome[i] === "hit" ? hitNote(tr.policy) : tr.note[i]}</p>
        </div>
      )}
      {done && other !== undefined && !step && (
        <div className="ev-other">{tr.admit ? "Without" : "With"} admit-on-second-hit: <b>{fmtPct(other, 1)}</b></div>
      )}
    </section>
  );
});

function hitNote(p: PolicyId): string {
  switch (p) {
    case "lru": return "Already in the cache. LRU moves it to the most-recent end, so it is now the last candidate for eviction.";
    case "lfu": return "Already in the cache. LFU adds one to its request count, which makes it harder to evict.";
    case "fifo": return "Already in the cache. FIFO changes nothing on a hit: it will still leave in arrival order.";
    case "s3fifo": return "Already in the cache. S3-FIFO only bumps a small counter (capped at 3). Nothing moves, so no lock is needed.";
  }
}
