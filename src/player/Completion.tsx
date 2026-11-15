/** Lesson complete: three count-up stats, a short particle burst, and the review offer. */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { IconBolt, IconBulb, IconClock, IconRetry, IconTarget, DrawCheck } from "./icons";

function useCountUp(target: number, ms: number, delay: number, reduced: boolean) {
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay, reduced]);
  return v;
}

const fmtTime = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function Burst({ color }: { color: string }) {
  const parts = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : -0.08);
    const d = 64 + ((i * 37) % 5) * 14;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 5 + (i % 3) * 2, delay: (i % 4) * 0.02, round: i % 3 !== 0 };
  }), []);
  return (
    <div className="lc-burst" aria-hidden="true">
      {parts.map((p, i) => (
        <motion.span key={i} className={p.round ? "round" : "pill"}
          style={{ width: p.s, height: p.round ? p.s : p.s * 0.5, background: color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.6], rotate: p.round ? 0 : (i * 47) % 180 }}
          transition={{ duration: 0.72, delay: 0.18 + p.delay, ease: [0.16, 0.9, 0.3, 1], times: [0, 0.15, 0.6, 1] }} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, delay, reduced }: { icon: React.ReactNode; label: string; value: string; delay: number; reduced: boolean }) {
  return (
    <motion.div className="lc-stat"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 28, delay }}>
      <div className="lc-stat-label"><span className="lc-stat-icon">{icon}</span>{label}</div>
      <div className="lc-stat-value tnum">{value}</div>
    </motion.div>
  );
}

export interface CompletionProps {
  lessonTitle: string;
  xp: number;
  accuracy: number | null;   // 0..1, null when the lesson had no questions
  timeMs: number;
  /** how many questions the reader asked to be taught (main pass) */
  taught: number;
  missed: number;
  review: { right: number; total: number } | null; // set after a review round
  partColor: string;
  reduced: boolean;
  onReview: () => void;
}

export function Completion(p: CompletionProps) {
  const xp = useCountUp(p.xp, 700, 250, p.reduced);
  const acc = useCountUp(p.accuracy === null ? 0 : p.accuracy * 100, 700, 350, p.reduced);
  const time = useCountUp(p.timeMs, 700, 450, p.reduced);
  const perfect = p.accuracy === 1;
  return (
    <div className="lc">
      <div className="lc-hero">
        {!p.reduced && !p.review && <Burst color={p.partColor} />}
        <motion.div className="lc-badge"
          initial={p.reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={p.reduced ? { duration: 0.15 } : { type: "spring", stiffness: 250, damping: 18 }}>
          <DrawCheck size={34} reduced={p.reduced} delay={0.15} />
        </motion.div>
      </div>
      <h1 className="lc-title">{p.review ? "Review complete" : "Lesson complete"}</h1>
      <p className="lc-sub">{p.lessonTitle}</p>
      {perfect && !p.review && <div className="lc-chip">No mistakes</div>}
      {p.review && (
        <p className="lc-review-note">
          {p.review.right} of {p.review.total} right this time.{" "}
          {p.missed === 0 ? "Nothing left to review." : `${p.missed} still to practise.`}
        </p>
      )}
      {p.taught > 0 && !p.review && (
        <p className="lc-taught">
          <IconBulb size={16} />
          <span>You asked for help {p.taught === 1 ? "once" : `${p.taught} times`}. That is how learning works.</span>
        </p>
      )}
      <div className="lc-stats">
        <StatCard icon={<IconBolt size={15} />} label="XP earned" value={`+${Math.round(xp)}`} delay={0.2} reduced={p.reduced} />
        <StatCard icon={<IconTarget size={15} />} label="First try" value={p.accuracy === null ? "n/a" : `${Math.round(acc)}%`} delay={0.28} reduced={p.reduced} />
        <StatCard icon={<IconClock size={15} />} label="Time" value={fmtTime(time)} delay={0.36} reduced={p.reduced} />
      </div>
      {p.missed > 0 && (
        <motion.div className="lc-missed"
          initial={p.reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: p.reduced ? 0 : 0.5, duration: 0.3 }}>
          <div>
            <div className="lc-missed-title">{p.missed === 1 ? "1 step to review" : `${p.missed} steps to review`}</div>
            <div className="lc-missed-text">Answer them again now, while the lesson is fresh. It takes about a minute.</div>
          </div>
          <button type="button" data-own-enter="" className="lc-review-btn" onClick={p.onReview}><IconRetry size={16} />Review missed</button>
        </motion.div>
      )}
    </div>
  );
}
