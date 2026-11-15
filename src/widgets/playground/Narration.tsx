/** Plain-English narration of the request, hop by hop, with running latency. */
import { AnimatePresence, motion } from "framer-motion";
import type { Hop, RequestTrace } from "./model";

const TONE: Record<Hop["result"], string> = { hit: "good", miss: "warn", bypass: "warn", fail: "bad", timeout: "bad", "404": "bad", ok: "neutral" };

/** Running time to first byte after `revealed` hops (steering is shown apart: it happens once per session). */
export function runningMs(trace: RequestTrace | null, revealed: number) {
  if (!trace) return 0;
  return trace.hops.slice(0, revealed).reduce((s, h) => s + (h.controlPlane ? 0 : h.ms), 0);
}

export function Narration({ trace, revealed, reduced, compact, dense }: { trace: RequestTrace | null; revealed: number; reduced: boolean; compact?: boolean; dense?: boolean }) {
  if (!trace || revealed === 0) {
    return <div className="pg-narr-empty">{compact ? "Press Run to watch the request travel." : "Press Play request. Each hop will appear here in plain English, with the time it adds."}</div>;
  }
  const shown = trace.hops.slice(0, revealed);
  const total = runningMs(trace, revealed);
  if (compact) {
    const h = shown[shown.length - 1];
    return (
      <div className="pg-narr-line" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={revealed} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <span className={`pg-tag tone-${TONE[h.result]}`}>{h.badge}</span>
            <b>{h.title}.</b> {h.text}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
  return (
    <div className="pg-narr">
      <div className="pg-narr-head">
        <span>What happened</span>
        <span className="pg-ttfb" aria-live="polite">{trace.hops[0] && revealed >= 1 ? `TTFB ${Math.round(total)} ms` : ""}</span>
      </div>
      <ol className="pg-narr-list">
        {shown.map((h, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: reduced ? 0 : 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className={i === shown.length - 1 ? "cur" : ""}>
            <div className="pg-narr-top">
              <span className={`pg-tag tone-${TONE[h.result]}`}>{h.badge}</span>
              <b>{h.title}</b>
              <span className="pg-ms">{h.controlPlane ? (h.ms ? `${h.ms} ms, once` : "") : h.ms ? `+${Math.round(h.ms)} ms` : ""}</span>
            </div>
            {(!dense || i === shown.length - 1) && <p>{h.text}</p>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
